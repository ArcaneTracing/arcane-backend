import {
  Controller,
  Get,
  Put,
  Delete,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
  Query,
} from "@nestjs/common";
import { InstancePermissionGuard } from "../guards/instance-permission.guard";
import { Permission } from "../decorators/permission.decorator";
import { INSTANCE_PERMISSIONS } from "../permissions/permissions";
import { Session, UserSession } from "@thallesp/nestjs-better-auth";
import { InstanceOwnerService } from "../services/instance-owner.service";
import { InstanceOwnerMessageResponseDto } from "../dto/response/instance-owner-message-response.dto";
import { InstanceOwnersWithDetailsResponseDto } from "../dto/response/instance-owners-with-details-response.dto";
import { ApiBearerAuth, ApiTags, ApiQuery, ApiResponse } from "@nestjs/swagger";
import { AuditService } from "../../audit/audit.service";
import { PaginatedAuditLogsResponseDto } from "../../audit/dto/response/paginated-audit-logs-response.dto";
import {
  BetterAuthUserService,
  BetterAuthUserDto,
} from "../../auth/services/better-auth-user.service";

@Controller("v1/users")
@ApiTags("instance-owners")
@ApiBearerAuth("bearer")
@UseGuards(InstancePermissionGuard)
export class InstanceOwnerController {
  constructor(
    private readonly instanceOwnerService: InstanceOwnerService,
    private readonly auditService: AuditService,
    private readonly betterAuthUserService: BetterAuthUserService,
  ) {}

  @Put(":userId/instance-role/owner")
  @Permission(INSTANCE_PERMISSIONS.ALL)
  @HttpCode(HttpStatus.OK)
  async assignOwnerRole(
    @Param("userId") userId: string,
    @Session() userSession: UserSession,
  ): Promise<InstanceOwnerMessageResponseDto> {
    await this.instanceOwnerService.assignOwnerRole(
      userId,
      userSession?.user?.id,
    );
    return { message: "Owner role assigned successfully" };
  }

  @Delete(":userId/instance-role/owner")
  @Permission(INSTANCE_PERMISSIONS.ALL)
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeOwnerRole(
    @Param("userId") userId: string,
    @Session() userSession: UserSession,
  ): Promise<InstanceOwnerMessageResponseDto> {
    await this.instanceOwnerService.removeOwnerRole(
      userId,
      userSession?.user?.id,
    );
    return { message: "Owner role removed successfully" };
  }

  @Get("instance-owners")
  @Permission(INSTANCE_PERMISSIONS.ALL)
  async listOwners(): Promise<InstanceOwnersWithDetailsResponseDto> {
    const users = await this.instanceOwnerService.listOwnersWithDetails();
    return { users };
  }

  @Get("audit-logs")
  @Permission(INSTANCE_PERMISSIONS.ALL)
  @ApiQuery({
    name: "action",
    required: false,
    description: "Filter by action (e.g., instance_owner.*)",
  })
  @ApiQuery({
    name: "cursor",
    required: false,
    description: "timestamp ISO string for pagination",
  })
  @ApiQuery({ name: "limit", required: false })
  @ApiResponse({ status: 200, type: PaginatedAuditLogsResponseDto })
  async getAuditLogs(
    @Query("action") action?: string,
    @Query("cursor") cursor?: string,
    @Query("limit") limit?: string,
  ): Promise<PaginatedAuditLogsResponseDto> {
    return this.auditService.findLogsPaginated({
      action: action || "instance_owner.*",
      cursor,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Get("search")
  @Permission(INSTANCE_PERMISSIONS.ALL)
  @ApiQuery({
    name: "email",
    required: true,
    description: "Email search term (partial match, case-insensitive)",
  })
  @ApiQuery({
    name: "limit",
    required: false,
    description: "Maximum number of results (default: 50)",
  })
  async searchUsers(
    @Query("email") email: string,
    @Query("limit") limit?: string,
  ): Promise<BetterAuthUserDto[]> {
    return this.betterAuthUserService.searchUsersByEmail(
      email,
      limit ? Number(limit) : 50,
    );
  }
}
