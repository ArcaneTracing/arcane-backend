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
import { ProjectsService } from "../services/projects.service";
import { CreateProjectDto } from "../dto/request/create-project.dto";
import { UpdateProjectDto } from "../dto/request/update-project.dto";
import { DeleteUserDto, InviteUserDto } from "../dto/request/project-user.dto";
import { ProjectResponseDto } from "../dto/response/project.dto";
import { ProjectMessageResponseDto } from "../dto/response/project-message-response.dto";
import { OrgPermissionGuard } from "../../rbac/guards/org-permission.guard";
import { OrgProjectPermissionGuard } from "../../rbac/guards/org-project-permission.guard";
import { Permission } from "../../rbac/decorators/permission.decorator";
import { PROJECT_PERMISSIONS } from "../../rbac/permissions/permissions";
import { AssignRoleRequestDto } from "../../rbac/dto/request/assign-role-request.dto";
import { RoleResponseDto } from "../../rbac/dto/response/role-response.dto";
import { ProjectUserWithRolesResponseDto } from "../dto/response/project-user-with-roles.dto";
import { Session, UserSession } from "@thallesp/nestjs-better-auth";
import { ProjectRbacService } from "../services/project-rbac.service";
import { AuditService } from "../../audit/audit.service";
import { EnterpriseLicenseGuard } from "../../license/guards/enterprise-license.guard";
import { PaginatedAuditLogsResponseDto } from "../../audit/dto/response/paginated-audit-logs-response.dto";
import { ApiBearerAuth, ApiTags, ApiQuery, ApiResponse } from "@nestjs/swagger";

@Controller("v1/organisations/:organisationId/projects")
@ApiTags("projects")
@ApiBearerAuth("bearer")
@UseGuards(OrgPermissionGuard)
export class ProjectsController {
  constructor(
    private readonly projectsService: ProjectsService,
    private readonly projectRbacService: ProjectRbacService,
    private readonly auditService: AuditService,
  ) {}

  @Post()
  @Permission(PROJECT_PERMISSIONS.CREATE)
  @HttpCode(HttpStatus.CREATED)
  @UsePipes(new ValidationPipe({ transform: true }))
  async create(
    @Param("organisationId", ParseUUIDPipe) organisationId: string,
    @Body() createProjectDto: CreateProjectDto,
    @Session() userSession: UserSession,
  ): Promise<ProjectResponseDto> {
    return this.projectsService.create(
      organisationId,
      createProjectDto,
      userSession.user.id,
    );
  }

  @Delete(":projectId")
  @UseGuards(OrgProjectPermissionGuard)
  @Permission(PROJECT_PERMISSIONS.DELETE)
  @HttpCode(HttpStatus.NO_CONTENT)
  @UsePipes(new ValidationPipe({ transform: true }))
  async remove(
    @Param("organisationId", ParseUUIDPipe) organisationId: string,
    @Param("projectId", ParseUUIDPipe) projectId: string,
    @Session() userSession: UserSession,
  ): Promise<ProjectMessageResponseDto> {
    return this.projectsService.remove(
      organisationId,
      projectId,
      userSession?.user?.id,
    );
  }

  @Put(":projectId")
  @UseGuards(OrgProjectPermissionGuard)
  @Permission(PROJECT_PERMISSIONS.UPDATE)
  @UsePipes(new ValidationPipe({ transform: true }))
  async update(
    @Param("organisationId", ParseUUIDPipe) organisationId: string,
    @Param("projectId", ParseUUIDPipe) projectId: string,
    @Body() updateProjectDto: UpdateProjectDto,
    @Session() userSession: UserSession,
  ): Promise<ProjectResponseDto> {
    return this.projectsService.update(
      organisationId,
      projectId,
      updateProjectDto,
      userSession.user.id,
    );
  }

  @Post(":projectId/members")
  @UseGuards(OrgProjectPermissionGuard)
  @Permission(PROJECT_PERMISSIONS.MEMBERS_CREATE)
  @HttpCode(HttpStatus.CREATED)
  @UsePipes(new ValidationPipe({ transform: true }))
  async inviteUser(
    @Param("organisationId", ParseUUIDPipe) organisationId: string,
    @Param("projectId", ParseUUIDPipe) projectId: string,
    @Body() inviteUserDto: InviteUserDto,
    @Session() userSession: UserSession,
  ): Promise<ProjectMessageResponseDto> {
    return this.projectsService.inviteUser(
      organisationId,
      projectId,
      inviteUserDto.email,
      inviteUserDto.roleId,
      userSession?.user?.id,
    );
  }

  @Delete(":projectId/members")
  @UseGuards(OrgProjectPermissionGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  @UsePipes(new ValidationPipe({ transform: true }))
  async removeUser(
    @Param("organisationId", ParseUUIDPipe) organisationId: string,
    @Param("projectId", ParseUUIDPipe) projectId: string,
    @Body() deleteUserDto: DeleteUserDto,
    @Session() userSession: UserSession,
  ): Promise<ProjectMessageResponseDto> {
    return this.projectsService.removeUser(
      organisationId,
      projectId,
      deleteUserDto.email,
      userSession?.user?.id,
    );
  }

  @Get()
  @Permission(PROJECT_PERMISSIONS.READ)
  @UsePipes(new ValidationPipe({ transform: true }))
  async findAll(
    @Param("organisationId", ParseUUIDPipe) organisationId: string,
    @Session() userSession: UserSession,
  ): Promise<ProjectResponseDto[]> {
    return this.projectsService.findAll(organisationId, userSession.user.id);
  }

  @Get(":projectId")
  @UseGuards(OrgProjectPermissionGuard)
  @Permission(PROJECT_PERMISSIONS.READ)
  @UsePipes(new ValidationPipe({ transform: true }))
  async findOne(
    @Param("organisationId", ParseUUIDPipe) organisationId: string,
    @Param("projectId", ParseUUIDPipe) projectId: string,
  ): Promise<ProjectResponseDto> {
    return this.projectsService.findOne(organisationId, projectId);
  }

  @Put(":projectId/members/:userId/role")
  @UseGuards(OrgProjectPermissionGuard)
  @Permission(PROJECT_PERMISSIONS.ROLES_ASSIGN, { allowProjectCreator: true })
  @HttpCode(HttpStatus.OK)
  @UsePipes(new ValidationPipe({ transform: true }))
  async assignProjectRole(
    @Param("organisationId", ParseUUIDPipe) organisationId: string,
    @Param("projectId", ParseUUIDPipe) projectId: string,
    @Param("userId", ParseUUIDPipe) userId: string,
    @Body() assignRoleDto: AssignRoleRequestDto,
    @Session() userSession: UserSession,
  ): Promise<ProjectMessageResponseDto> {
    await this.projectRbacService.assignProjectRole(
      projectId,
      userId,
      assignRoleDto.roleId,
      organisationId,
      userSession?.user?.id,
    );
    return { message: "Project role assigned successfully" };
  }

  @Get(":projectId/members/:userId/role")
  @UseGuards(OrgProjectPermissionGuard)
  @Permission(PROJECT_PERMISSIONS.MEMBERS_READ)
  @UsePipes(new ValidationPipe({ transform: true }))
  async getUserProjectRole(
    @Param("organisationId", ParseUUIDPipe) organisationId: string,
    @Param("projectId", ParseUUIDPipe) projectId: string,
    @Param("userId", ParseUUIDPipe) userId: string,
  ): Promise<RoleResponseDto | null> {
    return await this.projectRbacService.getUserProjectRole(
      organisationId,
      projectId,
      userId,
    );
  }

  @Delete(":projectId/members/:userId/role")
  @UseGuards(OrgProjectPermissionGuard)
  @Permission(PROJECT_PERMISSIONS.ROLES_REMOVE, { allowProjectCreator: true })
  @HttpCode(HttpStatus.NO_CONTENT)
  @UsePipes(new ValidationPipe({ transform: true }))
  async removeProjectRole(
    @Param("organisationId", ParseUUIDPipe) organisationId: string,
    @Param("projectId", ParseUUIDPipe) projectId: string,
    @Param("userId", ParseUUIDPipe) userId: string,
    @Session() userSession: UserSession,
  ): Promise<ProjectMessageResponseDto> {
    await this.projectRbacService.removeProjectRole(
      projectId,
      userId,
      organisationId,
      userSession?.user?.id,
    );
    return { message: "Project role removed successfully" };
  }

  @Get(":projectId/members")
  @UseGuards(OrgProjectPermissionGuard)
  @Permission(PROJECT_PERMISSIONS.MEMBERS_READ)
  @UsePipes(new ValidationPipe({ transform: true }))
  async getUsersWithRoles(
    @Param("organisationId", ParseUUIDPipe) organisationId: string,
    @Param("projectId", ParseUUIDPipe) projectId: string,
  ): Promise<ProjectUserWithRolesResponseDto[]> {
    return await this.projectRbacService.getUsersWithRoles(
      organisationId,
      projectId,
    );
  }

  @Get(":projectId/members/available")
  @UseGuards(OrgProjectPermissionGuard)
  @Permission(PROJECT_PERMISSIONS.MEMBERS_READ)
  @UsePipes(new ValidationPipe({ transform: true }))
  async listAvailableUsers(
    @Param("organisationId", ParseUUIDPipe) organisationId: string,
    @Param("projectId", ParseUUIDPipe) projectId: string,
  ): Promise<Array<{ id: string; email: string; name: string }>> {
    return await this.projectsService.findUsersNotInProject(
      organisationId,
      projectId,
    );
  }

  @Get(":projectId/audit-logs")
  @UseGuards(OrgProjectPermissionGuard, EnterpriseLicenseGuard)
  @Permission(PROJECT_PERMISSIONS.MEMBERS_READ)
  @ApiQuery({
    name: "action",
    required: false,
    description: "Filter by action (e.g., project.*, project_member.*)",
  })
  @ApiQuery({
    name: "cursor",
    required: false,
    description: "timestamp ISO string for pagination",
  })
  @ApiQuery({ name: "limit", required: false })
  @ApiResponse({ status: 200, type: PaginatedAuditLogsResponseDto })
  @UsePipes(new ValidationPipe({ transform: true }))
  async getProjectAuditLogs(
    @Param("organisationId", ParseUUIDPipe) organisationId: string,
    @Param("projectId", ParseUUIDPipe) projectId: string,
    @Query("action") action?: string,
    @Query("cursor") cursor?: string,
    @Query("limit") limit?: string,
  ): Promise<PaginatedAuditLogsResponseDto> {
    return this.auditService.findLogsPaginated({
      organisationId,
      projectId,
      action,
      cursor,
      limit: limit ? Number(limit) : undefined,
    });
  }
}
