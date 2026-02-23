import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from "@nestjs/common";
import {
  ERROR_MESSAGES,
  formatError,
} from "../../common/constants/error-messages.constants";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Role } from "../entities/role.entity";
import { RbacPermissionService } from "./rbac-permission.service";
import { RbacAssignmentService } from "./rbac-assignment.service";
import { AuditService } from "../../audit/audit.service";
import {
  BetterAuthUserService,
  BetterAuthUserDto,
} from "../../auth/services/better-auth-user.service";

@Injectable()
export class InstanceOwnerService {
  private readonly logger = new Logger(InstanceOwnerService.name);

  constructor(
    @InjectRepository(Role)
    private readonly roleRepository: Repository<Role>,
    private readonly permissionService: RbacPermissionService,
    private readonly assignmentService: RbacAssignmentService,
    private readonly auditService: AuditService,
    private readonly betterAuthUserService: BetterAuthUserService,
  ) {}

  async assignOwnerRole(userId: string, requesterId: string): Promise<void> {
    const hasPermission = await this.permissionService.hasPermissionForUser(
      requesterId,
      "*",
    );
    if (!hasPermission) {
      throw new ForbiddenException(
        formatError(ERROR_MESSAGES.ONLY_OWNERS_CAN_ASSIGN_OWNER_ROLE),
      );
    }

    const ownerRole = await this.roleRepository.findOne({
      where: {
        name: "Owner",
        isSystemRole: true,
        isInstanceLevel: true,
        organisationId: null,
        projectId: null,
      },
    });

    if (!ownerRole) {
      throw new NotFoundException(
        formatError(ERROR_MESSAGES.OWNER_ROLE_NOT_FOUND),
      );
    }

    await this.assignmentService.assignRole(userId, ownerRole.id);

    await this.auditService.record({
      action: "instance_owner.assigned",
      actorId: requesterId,
      actorType: "user",
      resourceType: "instance_owner",
      resourceId: userId,
      afterState: {
        assignedToUserId: userId,
        roleName: "Owner",
        roleId: ownerRole.id,
      },
      metadata: { assignedById: requesterId },
    });
  }

  async removeOwnerRole(userId: string, requesterId: string): Promise<void> {
    const hasPermission = await this.permissionService.hasPermissionForUser(
      requesterId,
      "*",
    );
    if (!hasPermission) {
      throw new ForbiddenException(
        formatError(ERROR_MESSAGES.ONLY_OWNERS_CAN_REMOVE_OWNER_ROLE),
      );
    }

    const owners = await this.listOwners();
    if (owners.length === 1 && owners[0] === userId) {
      throw new BadRequestException(
        formatError(ERROR_MESSAGES.CANNOT_REMOVE_LAST_OWNER),
      );
    }

    if (userId === requesterId && owners.length === 1) {
      throw new BadRequestException(
        formatError(ERROR_MESSAGES.CANNOT_REMOVE_YOURSELF_IF_LAST_OWNER),
      );
    }

    const ownerRole = await this.roleRepository.findOne({
      where: {
        name: "Owner",
        isSystemRole: true,
        isInstanceLevel: true,
        organisationId: null,
        projectId: null,
      },
    });

    if (!ownerRole) {
      throw new NotFoundException(
        formatError(ERROR_MESSAGES.OWNER_ROLE_NOT_FOUND),
      );
    }

    const beforeState = {
      assignedToUserId: userId,
      roleName: "Owner",
      roleId: ownerRole.id,
    };

    await this.assignmentService.removeRole(userId, ownerRole.id);

    await this.auditService.record({
      action: "instance_owner.removed",
      actorId: requesterId,
      actorType: "user",
      resourceType: "instance_owner",
      resourceId: userId,
      beforeState,
      afterState: null,
      metadata: { removedById: requesterId },
    });
  }

  async listOwners(): Promise<string[]> {
    const ownerRole = await this.roleRepository.findOne({
      where: {
        name: "Owner",
        isSystemRole: true,
        isInstanceLevel: true,
        organisationId: null,
        projectId: null,
      },
    });

    if (!ownerRole) {
      return [];
    }

    return this.assignmentService.getUserIdsForRole(ownerRole.id);
  }

  async listOwnersWithDetails(): Promise<BetterAuthUserDto[]> {
    const userIds = await this.listOwners();
    if (userIds.length === 0) {
      return [];
    }
    return this.betterAuthUserService.getUsersByIds(userIds);
  }

  async isOwner(userId: string): Promise<boolean> {
    return await this.permissionService.hasPermissionForUser(userId, "*");
  }
}
