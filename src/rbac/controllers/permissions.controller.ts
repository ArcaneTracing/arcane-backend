import { Controller, Get, Query } from "@nestjs/common";
import { Session, UserSession } from "@thallesp/nestjs-better-auth";
import { RbacPermissionService } from "../services/rbac-permission.service";
import { PermissionsResponseDto } from "../dto/response/permissions-response.dto";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";

@Controller("v1/users/me")
@ApiTags("permissions")
@ApiBearerAuth("bearer")
export class PermissionsController {
  constructor(private readonly permissionService: RbacPermissionService) {}

  @Get("permissions")
  async getPermissions(
    @Session() userSession: UserSession,
    @Query("organisationId") organisationId?: string,
    @Query("projectId") projectId?: string,
  ): Promise<PermissionsResponseDto> {
    return await this.permissionService.getUserPermissionsWithContext(
      userSession.user.id,
      organisationId,
      projectId,
    );
  }
}
