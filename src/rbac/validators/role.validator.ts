import { BadRequestException, Injectable } from "@nestjs/common";
import {
  ERROR_MESSAGES,
  formatError,
} from "../../common/constants/error-messages.constants";
import { ALL_PERMISSIONS } from "../permissions/permissions";

@Injectable()
export class RoleValidator {
  validatePermissions(permissions: string[]): void {
    for (const permission of permissions) {
      if (!ALL_PERMISSIONS.includes(permission as any)) {
        throw new BadRequestException(
          formatError(
            ERROR_MESSAGES.INVALID_PERMISSION,
            permission,
            ALL_PERMISSIONS.join(", "),
          ),
        );
      }
    }
  }

  validateRoleScope(organisationId: string, projectId?: string): void {
    if (projectId && !organisationId) {
      throw new BadRequestException(
        formatError(
          ERROR_MESSAGES.PROJECT_SPECIFIC_ROLES_REQUIRE_ORGANISATION_ID,
        ),
      );
    }
  }
}
