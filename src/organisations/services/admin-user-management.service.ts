import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import {
  ERROR_MESSAGES,
  formatError,
} from "../../common/constants/error-messages.constants";
import { BetterAuthUser } from "../../auth/entities/user.entity";
import { BetterAuthUserService } from "../../auth/services/better-auth-user.service";
import { RbacMembershipService } from "../../rbac/services/rbac-membership.service";
import { InstanceOwnerService } from "../../rbac/services/instance-owner.service";
import { AuditService } from "../../audit/audit.service";
import { Organisation } from "../entities/organisation.entity";
import { Project } from "../../projects/entities/project.entity";

@Injectable()
export class AdminUserManagementService {
  private readonly logger = new Logger(AdminUserManagementService.name);

  constructor(
    @InjectRepository(BetterAuthUser)
    private readonly userRepository: Repository<BetterAuthUser>,
    @InjectRepository(Organisation)
    private readonly organisationRepository: Repository<Organisation>,
    @InjectRepository(Project)
    private readonly projectRepository: Repository<Project>,
    private readonly betterAuthUserService: BetterAuthUserService,
    private readonly membershipService: RbacMembershipService,
    private readonly instanceOwnerService: InstanceOwnerService,
    private readonly auditService: AuditService,
  ) {}

  async removeUserFromSystem(userId: string, actorId: string): Promise<void> {
    const user = await this.betterAuthUserService.getUserById(userId);
    if (!user) {
      throw new NotFoundException(
        formatError(ERROR_MESSAGES.USER_NOT_FOUND, userId),
      );
    }

    if (userId === actorId) {
      throw new BadRequestException(
        formatError(ERROR_MESSAGES.CANNOT_REMOVE_YOURSELF),
      );
    }

    const isInstanceAdmin = await this.instanceOwnerService.isOwner(userId);
    if (isInstanceAdmin) {
      throw new BadRequestException(
        formatError(ERROR_MESSAGES.CANNOT_REMOVE_INSTANCE_ADMIN),
      );
    }

    const organisationIds =
      await this.membershipService.getUserOrganisationIds(userId);
    const projectIds = await this.membershipService.getUserProjectIds(userId);
    const beforeState = {
      userId,
      email: user.email,
      organisationIds,
      projectIds,
    };

    await this.userRepository.manager.transaction(async (manager) => {
      for (const orgId of organisationIds) {
        await manager.query(
          `DELETE FROM organisation_users WHERE organisation_id = $1 AND user_id = $2`,
          [orgId, userId],
        );
      }

      for (const projectId of projectIds) {
        await manager.query(
          `DELETE FROM project_users WHERE project_id = $1 AND user_id = $2`,
          [projectId, userId],
        );
      }

      await manager.query(`DELETE FROM user_roles WHERE user_id = $1`, [
        userId,
      ]);
    });

    this.logger.log(
      `Removed user ${userId} (${user.email}) from all organizations, projects, and roles`,
    );

    await this.auditService.record({
      action: "user.removed_from_system",
      actorId,
      actorType: "user",
      resourceType: "user",
      resourceId: userId,
      beforeState,
      afterState: null,
      metadata: {
        userId,
        email: user.email,
        removedOrganisationIds: organisationIds,
        removedProjectIds: projectIds,
        removedById: actorId,
      },
    });
  }
}
