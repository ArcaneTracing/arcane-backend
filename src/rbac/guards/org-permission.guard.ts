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
import { RbacPermissionService } from "../services/rbac-permission.service";
import { RbacMembershipService } from "../services/rbac-membership.service";
import { PERMISSION_KEY } from "../decorators/permission.decorator";

@Injectable()
export class OrgPermissionGuard implements CanActivate {
  private readonly logger = new Logger(OrgPermissionGuard.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly permissionService: RbacPermissionService,
    private readonly membershipService: RbacMembershipService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const handlerPermission = this.reflector.get<string>(
      PERMISSION_KEY,
      context.getHandler(),
    );
    const controllerPermission = this.reflector.get<string>(
      PERMISSION_KEY,
      context.getClass(),
    );
    const requiredPermission = handlerPermission || controllerPermission;

    const request = context.switchToHttp().getRequest();
    const session = request.session;

    if (!session?.user) {
      throw new ForbiddenException(
        formatError(ERROR_MESSAGES.USER_NOT_AUTHENTICATED),
      );
    }

    const user = session.user;
    const organisationId = request.params?.organisationId;

    if (!organisationId) {
      if (requiredPermission) {
        throw new ForbiddenException(
          formatError(ERROR_MESSAGES.ORGANISATION_CONTEXT_REQUIRED),
        );
      }
      return true;
    }

    const isMember = await this.membershipService.isMember(
      organisationId,
      user.id,
    );
    if (!isMember) {
      this.logger.warn(
        `Organisation membership denied for user ${user.id} in org ${organisationId}`,
      );
      throw new ForbiddenException(
        formatError(ERROR_MESSAGES.USER_NOT_IN_ORGANISATION),
      );
    }

    if (!requiredPermission) {
      return true;
    }

    await this.permissionService.checkPermission(
      user.id,
      requiredPermission,
      organisationId,
    );

    return true;
  }
}
