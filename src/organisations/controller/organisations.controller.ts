import {
  Controller,
  Post,
  Delete,
  Body,
  Param,
  ParseUUIDPipe,
  UseGuards,
  Get,
  Put,
  HttpCode,
  HttpStatus,
  UsePipes,
  ValidationPipe,
  Query,
} from "@nestjs/common";
import { OrganisationsService } from "../services/organisations.service";
import { CreateOrganisationRequestDto } from "../dto/request/create-organisation.dto";
import { UpdateOrganisationRequestDto } from "../dto/request/update-organisation.dto";
import { Session, UserSession } from "@thallesp/nestjs-better-auth";
import { OrganisationResponseDto } from "../dto/response/organisation.dto";
import { OrganisationMessageResponseDto } from "../dto/response/organisation-message-response.dto";
import { OrganisationUserWithRoleResponseDto } from "../dto/response/organisation-user-with-role.dto";
import { AddUserToOrganisationRequestDto } from "../dto/request/add-user-to-organisation.dto";
import { RemoveUserFromOrganisationRequestDto } from "../dto/request/remove-user-from-organisation.dto";
import { OrgPermissionGuard } from "../../rbac/guards/org-permission.guard";
import { Permission } from "../../rbac/decorators/permission.decorator";
import { ORGANISATION_PERMISSIONS } from "../../rbac/permissions/permissions";
import { AssignRoleRequestDto } from "../../rbac/dto/request/assign-role-request.dto";
import { RoleResponseDto } from "../../rbac/dto/response/role-response.dto";
import { OrganisationRbacService } from "../services/organisation-rbac.service";
import { ApiTags, ApiBearerAuth, ApiQuery, ApiResponse } from "@nestjs/swagger";
import { AuditService } from "../../audit/audit.service";
import { EnterpriseLicenseGuard } from "../../license/guards/enterprise-license.guard";
import { PaginatedAuditLogsResponseDto } from "../../audit/dto/response/paginated-audit-logs-response.dto";

@Controller("v1/organisations")
@ApiTags("organisations")
@ApiBearerAuth("bearer")
export class OrganisationsController {
  constructor(
    private readonly organisationsService: OrganisationsService,
    private readonly organisationRbacService: OrganisationRbacService,
    private readonly auditService: AuditService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UsePipes(new ValidationPipe({ transform: true }))
  async create(
    @Body() createOrganisationDto: CreateOrganisationRequestDto,
    @Session() userSession: UserSession,
  ): Promise<OrganisationResponseDto> {
    return this.organisationsService.create(
      createOrganisationDto,
      userSession.user.id,
    );
  }

  @Get()
  @UsePipes(new ValidationPipe({ transform: true }))
  async findAll(
    @Session() userSession: UserSession,
  ): Promise<OrganisationResponseDto[]> {
    return this.organisationsService.findAll(userSession.user.id);
  }

  @Get(":organisationId")
  @UseGuards(OrgPermissionGuard)
  @UsePipes(new ValidationPipe({ transform: true }))
  async findOne(
    @Param("organisationId", ParseUUIDPipe) organisationId: string,
  ): Promise<OrganisationResponseDto> {
    const organisation =
      await this.organisationsService.findById(organisationId);
    return organisation;
  }

  @Put(":organisationId")
  @UseGuards(OrgPermissionGuard)
  @UsePipes(new ValidationPipe({ transform: true }))
  async update(
    @Param("organisationId", ParseUUIDPipe) organisationId: string,
    @Body() updateOrganisationDto: UpdateOrganisationRequestDto,
  ): Promise<OrganisationResponseDto> {
    return this.organisationsService.update(
      organisationId,
      updateOrganisationDto,
    );
  }

  @Delete(":organisationId")
  @UseGuards(OrgPermissionGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  @UsePipes(new ValidationPipe({ transform: true }))
  async remove(
    @Param("organisationId", ParseUUIDPipe) organisationId: string,
  ): Promise<OrganisationMessageResponseDto> {
    return this.organisationsService.remove(organisationId);
  }

  @Get(":organisationId/users")
  @UseGuards(OrgPermissionGuard)
  @Permission(ORGANISATION_PERMISSIONS.MEMBERS_READ)
  @UsePipes(new ValidationPipe({ transform: true }))
  async getUsers(
    @Param("organisationId", ParseUUIDPipe) organisationId: string,
  ): Promise<OrganisationUserWithRoleResponseDto[]> {
    return this.organisationsService.getUsersWithRoles(organisationId);
  }

  @Post(":organisationId/users")
  @UseGuards(OrgPermissionGuard)
  @HttpCode(HttpStatus.CREATED)
  @UsePipes(new ValidationPipe({ transform: true }))
  async addUser(
    @Param("organisationId", ParseUUIDPipe) organisationId: string,
    @Body() addUserDto: AddUserToOrganisationRequestDto,
    @Session() userSession: UserSession,
  ): Promise<OrganisationMessageResponseDto> {
    return this.organisationsService.addUser(
      organisationId,
      addUserDto.email,
      userSession.user.id,
      addUserDto.roleId,
    );
  }

  @Delete(":organisationId/users")
  @UseGuards(OrgPermissionGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  @UsePipes(new ValidationPipe({ transform: true }))
  async removeUser(
    @Param("organisationId", ParseUUIDPipe) organisationId: string,
    @Body() removeUserDto: RemoveUserFromOrganisationRequestDto,
  ): Promise<OrganisationMessageResponseDto> {
    return this.organisationsService.removeUser(
      organisationId,
      removeUserDto.email,
    );
  }

  @Put(":organisationId/users/:userId/role")
  @Permission(ORGANISATION_PERMISSIONS.MEMBERS_UPDATE)
  @HttpCode(HttpStatus.OK)
  @UsePipes(new ValidationPipe({ transform: true }))
  async assignRole(
    @Param("organisationId", ParseUUIDPipe) organisationId: string,
    @Param("userId", ParseUUIDPipe) userId: string,
    @Body() assignRoleDto: AssignRoleRequestDto,
  ): Promise<OrganisationMessageResponseDto> {
    await this.organisationRbacService.assignRole(
      organisationId,
      userId,
      assignRoleDto.roleId,
    );
    return { message: "Role assigned successfully" };
  }

  @Get(":organisationId/users/:userId/role")
  @Permission(ORGANISATION_PERMISSIONS.MEMBERS_READ)
  @UsePipes(new ValidationPipe({ transform: true }))
  async getUserRole(
    @Param("organisationId", ParseUUIDPipe) organisationId: string,
    @Param("userId", ParseUUIDPipe) userId: string,
  ): Promise<RoleResponseDto | null> {
    return await this.organisationRbacService.getUserRole(
      organisationId,
      userId,
    );
  }

  @Get(":organisationId/audit-logs")
  @UseGuards(OrgPermissionGuard, EnterpriseLicenseGuard)
  @Permission(ORGANISATION_PERMISSIONS.READ)
  @ApiQuery({
    name: "action",
    required: false,
    description: "Filter by action (e.g., organisation.*)",
  })
  @ApiQuery({
    name: "cursor",
    required: false,
    description: "timestamp ISO string for pagination",
  })
  @ApiQuery({ name: "limit", required: false })
  @ApiResponse({ status: 200, type: PaginatedAuditLogsResponseDto })
  @UsePipes(new ValidationPipe({ transform: true }))
  async getAuditLogs(
    @Param("organisationId", ParseUUIDPipe) organisationId: string,
    @Query("action") action?: string,
    @Query("cursor") cursor?: string,
    @Query("limit") limit?: string,
  ): Promise<PaginatedAuditLogsResponseDto> {
    return this.auditService.findLogsPaginated({
      organisationId,
      action,
      cursor,
      limit: limit ? Number(limit) : undefined,
    });
  }
}
