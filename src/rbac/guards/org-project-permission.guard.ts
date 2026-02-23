import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Logger,
} from "@nestjs/common";
import {
  ERROR_MESSAGES,
  formatError,
} from "../../common/constants/error-messages.constants";
import { Reflector } from "@nestjs/core";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Project } from "../../projects/entities/project.entity";
import { RbacPermissionService } from "../services/rbac-permission.service";
import { RbacMembershipService } from "../services/rbac-membership.service";
import {
  PERMISSION_KEY,
  ALLOW_PROJECT_CREATOR_KEY,
} from "../decorators/permission.decorator";

@Injectable()
export class OrgProjectPermissionGuard implements CanActivate {
  private readonly logger = new Logger(OrgProjectPermissionGuard.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly permissionService: RbacPermissionService,
    private readonly membershipService: RbacMembershipService,
    @InjectRepository(Project)
    private readonly projectRepository: Repository<Project>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredPermission =
      this.reflector.get<string>(PERMISSION_KEY, context.getHandler()) ||
      this.reflector.get<string>(PERMISSION_KEY, context.getClass());
    const allowProjectCreator =
      this.reflector.get<boolean>(
        ALLOW_PROJECT_CREATOR_KEY,
        context.getHandler(),
      ) ??
      this.reflector.get<boolean>(
        ALLOW_PROJECT_CREATOR_KEY,
        context.getClass(),
      );

    const request = context.switchToHttp().getRequest();
    const { user, organisationId, projectId } =
      this.extractRequestContext(request);
    if (!user)
      throw new ForbiddenException(
        formatError(ERROR_MESSAGES.USER_NOT_AUTHENTICATED),
      );
    if (!organisationId || !projectId)
      throw new ForbiddenException(
        formatError(ERROR_MESSAGES.ORGANISATION_AND_PROJECT_CONTEXT_REQUIRED),
      );

    await this.validateOrgMembership(organisationId, user.id);
    const isProjectMember = await this.membershipService.isProjectMember(
      projectId,
      user.id,
    );

    if (!isProjectMember) {
      if (
        await this.isProjectCreatorFallback(
          projectId,
          user.id,
          allowProjectCreator,
        )
      )
        return true;
      this.logger.warn(
        `Project membership denied for user ${user.id} in project ${projectId}`,
      );
      throw new ForbiddenException(
        formatError(ERROR_MESSAGES.USER_DOES_NOT_BELONG_TO_PROJECT),
      );
    }

    if (!requiredPermission) return true;
    return this.checkPermissionWithCreatorFallback(
      user.id,
      requiredPermission,
      organisationId,
      projectId,
      allowProjectCreator,
    );
  }

  private extractRequestContext(request: any): {
    user?: { id: string };
    organisationId?: string;
    projectId?: string;
  } {
    return {
      user: request.session?.user,
      organisationId: request.params?.organisationId,
      projectId: request.params?.projectId || request.params?.projectUUID,
    };
  }

  private async validateOrgMembership(
    organisationId: string,
    userId: string,
  ): Promise<void> {
    const isOrgMember = await this.membershipService.isMember(
      organisationId,
      userId,
    );
    if (!isOrgMember) {
      this.logger.warn(
        `Organisation membership denied for user ${userId} in org ${organisationId}`,
      );
      throw new ForbiddenException(
        formatError(ERROR_MESSAGES.USER_NOT_IN_ORGANISATION),
      );
    }
  }

  private async isProjectCreatorFallback(
    projectId: string,
    userId: string,
    allowProjectCreator: boolean,
  ): Promise<boolean> {
    if (!allowProjectCreator) return false;
    const project = await this.projectRepository.findOne({
      where: { id: projectId },
    });
    return project?.createdById === userId;
  }

  private async checkPermissionWithCreatorFallback(
    userId: string,
    requiredPermission: string,
    organisationId: string,
    projectId: string,
    allowProjectCreator: boolean,
  ): Promise<boolean> {
    try {
      await this.permissionService.checkPermission(
        userId,
        requiredPermission,
        organisationId,
        projectId,
      );
      return true;
    } catch (error) {
      if (
        await this.isProjectCreatorFallback(
          projectId,
          userId,
          allowProjectCreator,
        )
      )
        return true;
      throw error;
    }
  }
}
