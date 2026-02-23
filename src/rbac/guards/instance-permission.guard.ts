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
import { PERMISSION_KEY } from "../decorators/permission.decorator";

@Injectable()
export class InstancePermissionGuard implements CanActivate {
  private readonly logger = new Logger(InstancePermissionGuard.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly permissionService: RbacPermissionService,
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

    if (!requiredPermission) {
      return true;
    }

    await this.permissionService.checkPermission(
      session.user.id,
      requiredPermission,
    );

    return true;
  }
}
