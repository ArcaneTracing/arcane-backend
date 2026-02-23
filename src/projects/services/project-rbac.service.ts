import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import {
  ERROR_MESSAGES,
  formatError,
} from "../../common/constants/error-messages.constants";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Project } from "../entities/project.entity";
import { RbacService } from "../../rbac/services/rbac.service";
import { Role } from "../../rbac/entities/role.entity";
import { RoleResponseDto } from "../../rbac/dto/response/role-response.dto";
import { RoleMapper } from "../../rbac/mappers/role.mapper";
import { ProjectUserWithRolesResponseDto } from "../dto/response/project-user-with-roles.dto";
import { BetterAuthUserService } from "../../auth/services/better-auth-user.service";
import { RbacAssignmentService } from "../../rbac/services/rbac-assignment.service";
import { RbacMembershipService } from "../../rbac/services/rbac-membership.service";
import { AuditService } from "../../audit/audit.service";

@Injectable()
export class ProjectRbacService {
  private readonly logger = new Logger(ProjectRbacService.name);

  constructor(
    @InjectRepository(Project)
    private readonly projectRepository: Repository<Project>,
    private readonly rbacService: RbacService,
    private readonly betterAuthUserService: BetterAuthUserService,
    private readonly assignmentService: RbacAssignmentService,
    private readonly membershipService: RbacMembershipService,
    private readonly auditService: AuditService,
  ) {}

  private async getByIdAndOrganisationOrThrow(
    organisationId: string,
    projectId: string,
  ): Promise<Project> {
    const project = await this.projectRepository.findOne({
      where: { id: projectId, organisationId },
    });

    if (!project) {
      throw new NotFoundException(
        formatError(ERROR_MESSAGES.PROJECT_NOT_FOUND, projectId),
      );
    }

    return project;
  }

  private async getProjectMemberIds(projectId: string): Promise<string[]> {
    const members = await this.projectRepository
      .createQueryBuilder("project")
      .innerJoin("project.users", "user")
      .select("user.id", "id")
      .where("project.id = :projectId", { projectId })
      .getRawMany();
    return members.map((row) => row.id);
  }

  async assignProjectRole(
    projectId: string,
    userId: string,
    roleId: string,
    organisationId?: string,
    actorId?: string,
  ): Promise<void> {
    const existingRole = await this.rbacService.getUserProjectRole(
      projectId,
      userId,
    );
    const beforeState = existingRole
      ? {
          userId,
          previousRoleId: existingRole.id,
          previousRoleName: existingRole.name,
        }
      : { userId, previousRoleId: null, previousRoleName: null };

    if (existingRole && existingRole.id !== roleId) {
      await this.assignmentService.removeRole(userId, existingRole.id);
    }

    await this.assignmentService.assignRole(userId, roleId);

    await this.auditService.record({
      action: "project_role.assigned",
      actorId,
      actorType: "user",
      resourceType: "project_role",
      resourceId: projectId,
      organisationId: organisationId ?? undefined,
      projectId,
      beforeState,
      afterState: { userId, roleId },
      metadata: {
        projectId,
        organisationId: organisationId ?? null,
        assignedBy: actorId ?? null,
      },
    });
  }

  async assignProjectRoleByEmail(
    projectId: string,
    email: string,
    roleId: string,
  ): Promise<void> {
    const userId = await this.betterAuthUserService.getUserIdByEmail(email);
    if (!userId) {
      throw new NotFoundException(
        formatError(ERROR_MESSAGES.USER_NOT_FOUND_BY_EMAIL, email),
      );
    }

    await this.assignProjectRole(projectId, userId, roleId);
  }

  async removeProjectRole(
    projectId: string,
    userId: string,
    organisationId?: string,
    actorId?: string,
  ): Promise<void> {
    const role = await this.rbacService.getUserProjectRole(projectId, userId);
    const beforeState = role
      ? { userId, roleId: role.id, roleName: role.name }
      : { userId, roleId: null, roleName: null };

    if (role) {
      await this.assignmentService.removeRole(userId, role.id);
    }

    await this.auditService.record({
      action: "project_role.removed",
      actorId,
      actorType: "user",
      resourceType: "project_role",
      resourceId: projectId,
      organisationId: organisationId ?? undefined,
      projectId,
      beforeState,
      afterState: null,
      metadata: {
        projectId,
        organisationId: organisationId ?? null,
        removedBy: actorId ?? null,
      },
    });
  }

  async getUserProjectRole(
    organisationId: string,
    projectId: string,
    userId: string,
  ): Promise<RoleResponseDto | null> {
    await this.getByIdAndOrganisationOrThrow(organisationId, projectId);
    const role = await this.rbacService.getUserProjectRole(projectId, userId);
    return role ? RoleMapper.toDto(role) : null;
  }

  async getDefaultProjectRole(
    organisationId: string,
    projectId: string,
  ): Promise<Role> {
    return this.rbacService.getDefaultProjectRole(organisationId, projectId);
  }

  async getUsersWithRoles(
    organisationId: string,
    projectId: string,
  ): Promise<ProjectUserWithRolesResponseDto[]> {
    const project = await this.getByIdAndOrganisationOrThrow(
      organisationId,
      projectId,
    );

    const userIds = new Set<string>();

    if (project.createdById) {
      userIds.add(project.createdById);
    }

    const memberIds = await this.getProjectMemberIds(projectId);
    memberIds.forEach((memberId) => userIds.add(memberId));

    const usersWithProjectAccess =
      await this.membershipService.getUsersWithProjectAccess(projectId);
    usersWithProjectAccess.forEach((userId) => userIds.add(userId));

    this.logger.debug(
      `[getUsersWithRoles] Found ${usersWithProjectAccess.length} users with project access via roles`,
    );

    const allUserIds = Array.from(userIds);
    const allUsersData =
      await this.betterAuthUserService.getUsersByIds(allUserIds);
    const allUsersMap = new Map<
      string,
      { id: string; email: string; name: string }
    >();

    allUsersData.forEach((user) => {
      allUsersMap.set(user.id, {
        id: user.id,
        email: user.email,
        name: user.name,
      });
    });

    const allUsersList = Array.from(allUsersMap.values());
    this.logger.debug(
      `[getUsersWithRoles] Total unique users found: ${allUsersList.length}`,
    );

    const usersWithRoles: ProjectUserWithRolesResponseDto[] = await Promise.all(
      allUsersList.map(async (user) => {
        const allRoles: Role[] = [];

        const instanceRole = await this.rbacService.getUserInstanceRole(
          user.id,
        );
        if (instanceRole) {
          allRoles.push(instanceRole);
          this.logger.debug(
            `[getUsersWithRoles] User ${user.id} has instance role: ${instanceRole.name}`,
          );
        }

        const projectRoles = await this.rbacService.getUserProjectRoles(
          projectId,
          user.id,
        );
        allRoles.push(...projectRoles);
        if (projectRoles.length > 0) {
          this.logger.debug(
            `[getUsersWithRoles] User ${user.id} has ${projectRoles.length} project roles`,
          );
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          roles: allRoles.map((role) => RoleMapper.toDto(role)),
        };
      }),
    );

    this.logger.debug(
      `[getUsersWithRoles] Returning ${usersWithRoles.length} users with roles`,
    );

    return usersWithRoles;
  }
}
