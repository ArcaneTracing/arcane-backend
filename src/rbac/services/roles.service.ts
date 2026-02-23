import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from "@nestjs/common";
import {
  ERROR_MESSAGES,
  formatError,
} from "../../common/constants/error-messages.constants";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, DataSource } from "typeorm";
import { Role } from "../entities/role.entity";
import { CreateRoleRequestDto } from "../dto/request/create-role-request.dto";
import { UpdateRoleRequestDto } from "../dto/request/update-role-request.dto";
import { RoleResponseDto } from "../dto/response/role-response.dto";
import { RoleMapper } from "../mappers/role.mapper";
import { RoleValidator } from "../validators/role.validator";
import { AuditService } from "../../audit/audit.service";
import { RbacAssignmentService } from "./rbac-assignment.service";

@Injectable()
export class RolesService {
  private readonly logger = new Logger(RolesService.name);

  constructor(
    @InjectRepository(Role)
    private readonly roleRepository: Repository<Role>,
    private readonly roleValidator: RoleValidator,
    private readonly auditService: AuditService,
    private readonly assignmentService: RbacAssignmentService,
    private readonly dataSource: DataSource,
  ) {}

  private toAuditState(r: Role): Record<string, unknown> {
    return {
      id: r.id,
      name: r.name,
      description: r.description ?? null,
      permissions: r.permissions ?? [],
      organisationId: r.organisationId,
      projectId: r.projectId,
      isSystemRole: r.isSystemRole,
      isInstanceLevel: r.isInstanceLevel,
    };
  }

  async findAll(
    organisationId: string,
    projectId?: string,
  ): Promise<RoleResponseDto[]> {
    const roles: Role[] = [];

    if (projectId) {
      const systemRoles = await this.roleRepository.find({
        where: {
          isSystemRole: true,
          organisationId,
          projectId,
        },
      });
      roles.push(...systemRoles);

      const projectRoles = await this.roleRepository.find({
        where: {
          organisationId,
          projectId,
          isSystemRole: false,
        },
      });
      roles.push(...projectRoles);
      return roles.map((role) => RoleMapper.toDto(role));
    }

    const systemRoles = await this.roleRepository.find({
      where: {
        isSystemRole: true,
        organisationId,
        projectId: null,
      },
    });
    roles.push(...systemRoles);

    const orgRoles = await this.roleRepository.find({
      where: {
        organisationId,
        projectId: null,
        isSystemRole: false,
      },
    });
    roles.push(...orgRoles);

    return roles.map((role) => RoleMapper.toDto(role));
  }

  async findOne(roleId: string): Promise<Role> {
    const role = await this.roleRepository.findOne({
      where: { id: roleId },
    });

    if (!role) {
      throw new NotFoundException(
        formatError(ERROR_MESSAGES.ROLE_NOT_FOUND, roleId),
      );
    }

    return role;
  }

  async findOneDto(roleId: string): Promise<RoleResponseDto> {
    const role = await this.findOne(roleId);
    return RoleMapper.toDto(role);
  }

  async create(
    organisationId: string,
    createRoleDto: CreateRoleRequestDto,
    userId: string,
    projectId?: string,
  ): Promise<RoleResponseDto> {
    this.roleValidator.validatePermissions(createRoleDto.permissions);

    this.roleValidator.validateRoleScope(organisationId, projectId);

    const existingRole = await this.roleRepository.findOne({
      where: {
        name: createRoleDto.name,
        organisationId,
        projectId: projectId || null,
      },
    });

    if (existingRole) {
      throw new BadRequestException(
        formatError(
          ERROR_MESSAGES.ROLE_NAME_ALREADY_EXISTS,
          createRoleDto.name,
        ),
      );
    }

    const role = this.roleRepository.create(
      RoleMapper.toEntity({
        name: createRoleDto.name,
        description: createRoleDto.description,
        permissions: createRoleDto.permissions,
        organisationId,
        projectId: projectId || null,
        isSystemRole: false,
        isInstanceLevel: false,
      }),
    );

    const savedRole = await this.roleRepository.save(role);

    await this.auditService.record({
      action: "role.created",
      actorId: userId,
      actorType: "user",
      resourceType: "role",
      resourceId: savedRole.id,
      organisationId,
      projectId: projectId ?? undefined,
      afterState: this.toAuditState(savedRole),
      metadata: {
        creatorId: userId,
        organisationId,
        projectId: projectId ?? null,
      },
    });

    return RoleMapper.toDto(savedRole);
  }

  async update(
    organisationId: string,
    roleId: string,
    updateRoleDto: UpdateRoleRequestDto,
    userId: string,
    projectId?: string,
  ): Promise<RoleResponseDto> {
    const role = await this.findOne(roleId);

    if (role.isSystemRole) {
      throw new ForbiddenException(
        formatError(ERROR_MESSAGES.CANNOT_UPDATE_SYSTEM_ROLES),
      );
    }

    if (role.organisationId !== organisationId) {
      throw new ForbiddenException(
        formatError(ERROR_MESSAGES.ROLE_DOES_NOT_BELONG_TO_ORGANISATION),
      );
    }

    if (projectId && role.projectId !== projectId) {
      throw new ForbiddenException(
        formatError(ERROR_MESSAGES.ROLE_DOES_NOT_BELONG_TO_PROJECT),
      );
    }

    const beforeState = this.toAuditState(role);

    if ("permissions" in updateRoleDto && updateRoleDto.permissions) {
      this.roleValidator.validatePermissions(updateRoleDto.permissions);
    }

    Object.assign(role, updateRoleDto);
    const updatedRole = await this.roleRepository.save(role);

    await this.auditService.record({
      action: "role.updated",
      actorId: userId,
      actorType: "user",
      resourceType: "role",
      resourceId: roleId,
      organisationId,
      projectId: projectId ?? undefined,
      beforeState,
      afterState: this.toAuditState(updatedRole),
      metadata: {
        changedFields: Object.keys(updateRoleDto),
        organisationId,
        projectId: projectId ?? null,
      },
    });

    return RoleMapper.toDto(updatedRole);
  }

  async delete(
    organisationId: string,
    roleId: string,
    userId: string,
    projectId?: string,
  ): Promise<void> {
    const role = await this.findOne(roleId);

    if (role.isSystemRole) {
      throw new ForbiddenException(
        formatError(ERROR_MESSAGES.CANNOT_DELETE_SYSTEM_ROLES),
      );
    }

    if (role.organisationId === null) {
      throw new ForbiddenException(
        formatError(ERROR_MESSAGES.CANNOT_DELETE_GLOBAL_ROLES),
      );
    }

    if (role.organisationId !== organisationId) {
      throw new ForbiddenException("Role does not belong to this organisation");
    }

    if (projectId && role.projectId !== projectId) {
      throw new ForbiddenException(
        formatError(ERROR_MESSAGES.ROLE_DOES_NOT_BELONG_TO_PROJECT),
      );
    }

    const beforeState = this.toAuditState(role);

    await this.deleteRoleWithUserReassignment(role, organisationId, projectId);

    await this.auditService.record({
      action: "role.deleted",
      actorId: userId,
      actorType: "user",
      resourceType: "role",
      resourceId: roleId,
      organisationId: role.organisationId ?? undefined,
      projectId: role.projectId ?? undefined,
      beforeState,
      afterState: null,
      metadata: {
        organisationId: role.organisationId,
        projectId: role.projectId,
      },
    });
  }

  private async deleteRoleWithUserReassignment(
    role: Role,
    organisationId: string,
    projectId?: string,
  ): Promise<void> {
    const userIdsWithRole = await this.assignmentService.getUserIdsForRole(
      role.id,
    );

    if (userIdsWithRole.length > 0) {
      this.logger.log(
        `Role ${role.name} (${role.id}) is assigned to ${userIdsWithRole.length} user(s). Reassigning to default role before deletion.`,
      );

      let defaultRole: Role | null = null;

      if (projectId) {
        defaultRole = await this.roleRepository.findOne({
          where: {
            name: "Member",
            isSystemRole: true,
            organisationId: organisationId,
            projectId: projectId,
          },
        });

        if (!defaultRole) {
          throw new NotFoundException(
            formatError(
              ERROR_MESSAGES.DEFAULT_MEMBER_ROLE_NOT_FOUND,
              projectId,
            ),
          );
        }
      } else {
        defaultRole = await this.roleRepository.findOne({
          where: {
            name: "Organisation Member",
            isSystemRole: true,
            organisationId: organisationId,
            projectId: null,
          },
        });

        if (!defaultRole) {
          throw new NotFoundException(
            formatError(
              ERROR_MESSAGES.DEFAULT_ORGANISATION_MEMBER_ROLE_NOT_FOUND,
              organisationId,
            ),
          );
        }
      }

      await this.dataSource.transaction(async (manager) => {
        const roleRepo = manager.getRepository(Role);

        for (const userId of userIdsWithRole) {
          await this.assignmentService.removeRole(userId, role.id, manager);
          await this.assignmentService.assignRole(
            userId,
            defaultRole.id,
            manager,
          );
        }

        await roleRepo.remove(role);
      });

      this.logger.log(
        `Successfully reassigned ${userIdsWithRole.length} user(s) from role ${role.name} (${role.id}) to default role ${defaultRole.name} (${defaultRole.id}) and deleted the role.`,
      );
    } else {
      this.logger.log(
        `Role ${role.name} (${role.id}) has no assigned users. Deleting directly.`,
      );
      await this.roleRepository.remove(role);
    }
  }

  async isSystemRole(roleId: string): Promise<boolean> {
    const role = await this.findOne(roleId);
    return role.isSystemRole;
  }

  async getSystemRoles(): Promise<Role[]> {
    return await this.roleRepository.find({
      where: {
        isSystemRole: true,
        organisationId: null,
        projectId: null,
      },
    });
  }
}
