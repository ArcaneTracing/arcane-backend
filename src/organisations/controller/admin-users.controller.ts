import {
  Controller,
  Get,
  Delete,
  Param,
  ParseUUIDPipe,
  UseGuards,
  HttpCode,
  HttpStatus,
  UsePipes,
  ValidationPipe,
  Session,
} from "@nestjs/common";
import { UserSession } from "@thallesp/nestjs-better-auth";
import { InstancePermissionGuard } from "../../rbac/guards/instance-permission.guard";
import { Permission } from "../../rbac/decorators/permission.decorator";
import { INSTANCE_PERMISSIONS } from "../../rbac/permissions/permissions";
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
} from "@nestjs/swagger";
import {
  BetterAuthUserService,
  BetterAuthUserDto,
} from "../../auth/services/better-auth-user.service";
import { AdminUserManagementService } from "../services/admin-user-management.service";
import { OrganisationMessageResponseDto } from "../dto/response/organisation-message-response.dto";

@Controller("v1/admin/users")
@ApiTags("admin")
@ApiBearerAuth("bearer")
@UseGuards(InstancePermissionGuard)
export class AdminUsersController {
  constructor(
    private readonly betterAuthUserService: BetterAuthUserService,
    private readonly adminUserManagementService: AdminUserManagementService,
  ) {}

  @Get()
  @Permission(INSTANCE_PERMISSIONS.ALL)
  @UsePipes(new ValidationPipe({ transform: true }))
  @ApiOperation({
    summary: "List all users",
    description:
      "Get a list of all users in the system. Requires instance admin permissions.",
  })
  @ApiResponse({
    status: 200,
    description: "List of users",
    schema: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          email: { type: "string" },
          name: { type: "string" },
        },
      },
    },
  })
  async getAllUsers(): Promise<BetterAuthUserDto[]> {
    return this.betterAuthUserService.getAllUsers();
  }

  @Delete(":userId")
  @Permission(INSTANCE_PERMISSIONS.ALL)
  @HttpCode(HttpStatus.NO_CONTENT)
  @UsePipes(new ValidationPipe({ transform: true }))
  @ApiOperation({
    summary: "Remove user from system",
    description:
      "Remove a user from all organizations, projects, and roles. Cannot remove instance admins.",
  })
  @ApiResponse({
    status: 204,
    description: "User removed successfully",
  })
  async removeUser(
    @Param("userId", ParseUUIDPipe) userId: string,
    @Session() userSession: UserSession,
  ): Promise<OrganisationMessageResponseDto> {
    await this.adminUserManagementService.removeUserFromSystem(
      userId,
      userSession.user.id,
    );
    return { message: "User removed from system successfully" };
  }
}
