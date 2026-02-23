import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
} from "@nestjs/common";
import { OrgPermissionGuard } from "../guards/org-permission.guard";
import { EnterpriseLicenseGuard } from "../../license/guards/enterprise-license.guard";
import { OrgProjectPermissionGuard } from "../guards/org-project-permission.guard";
import { Permission } from "../decorators/permission.decorator";
import {
  ORGANISATION_PERMISSIONS,
  PROJECT_PERMISSIONS,
} from "../permissions/permissions";
import { Session, UserSession } from "@thallesp/nestjs-better-auth";
import { RolesService } from "../services/roles.service";
import { CreateRoleRequestDto } from "../dto/request/create-role-request.dto";
import { UpdateRoleRequestDto } from "../dto/request/update-role-request.dto";
import { RoleResponseDto } from "../dto/response/role-response.dto";
import { RoleMessageResponseDto } from "../dto/response/role-message-response.dto";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";

@Controller("v1/organisations/:organisationId/roles")
@ApiTags("roles")
@ApiBearerAuth("bearer")
@UseGuards(OrgPermissionGuard)
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @Get()
  @Permission(ORGANISATION_PERMISSIONS.ROLES_READ)
  async findAll(
    @Param("organisationId", new ParseUUIDPipe({ version: "4" }))
    organisationId: string,
  ): Promise<RoleResponseDto[]> {
    return await this.rolesService.findAll(organisationId);
  }

  @Post()
  @UseGuards(EnterpriseLicenseGuard)
  @Permission(ORGANISATION_PERMISSIONS.ROLES_CREATE)
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Param("organisationId", new ParseUUIDPipe({ version: "4" }))
    organisationId: string,
    @Body() createRoleDto: CreateRoleRequestDto,
    @Session() userSession: UserSession,
  ): Promise<RoleResponseDto> {
    return await this.rolesService.create(
      organisationId,
      createRoleDto,
      userSession?.user?.id,
    );
  }

  @Get(":roleId")
  @Permission(ORGANISATION_PERMISSIONS.ROLES_READ)
  async findOne(
    @Param("roleId", new ParseUUIDPipe({ version: "4" })) roleId: string,
  ): Promise<RoleResponseDto> {
    return await this.rolesService.findOneDto(roleId);
  }

  @Put(":roleId")
  @UseGuards(EnterpriseLicenseGuard)
  @Permission(ORGANISATION_PERMISSIONS.ROLES_UPDATE)
  async update(
    @Param("organisationId", new ParseUUIDPipe({ version: "4" }))
    organisationId: string,
    @Param("roleId", new ParseUUIDPipe({ version: "4" })) roleId: string,
    @Body() updateRoleDto: UpdateRoleRequestDto,
    @Session() userSession: UserSession,
  ): Promise<RoleResponseDto> {
    return await this.rolesService.update(
      organisationId,
      roleId,
      updateRoleDto,
      userSession?.user?.id,
    );
  }

  @Delete(":roleId")
  @UseGuards(EnterpriseLicenseGuard)
  @Permission(ORGANISATION_PERMISSIONS.ROLES_DELETE)
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(
    @Param("organisationId", new ParseUUIDPipe({ version: "4" }))
    organisationId: string,
    @Param("roleId", new ParseUUIDPipe({ version: "4" })) roleId: string,
    @Session() userSession: UserSession,
  ): Promise<RoleMessageResponseDto> {
    await this.rolesService.delete(
      organisationId,
      roleId,
      userSession?.user?.id,
    );
    return { message: "Role deleted successfully" };
  }
}

@Controller("v1/organisations/:organisationId/projects/:projectId/roles")
@ApiTags("project-roles")
@ApiBearerAuth("bearer")
@UseGuards(OrgProjectPermissionGuard)
export class ProjectRolesController {
  constructor(private readonly rolesService: RolesService) {}

  @Get()
  @Permission(PROJECT_PERMISSIONS.ROLES_READ, { allowProjectCreator: true })
  async findAll(
    @Param("organisationId", new ParseUUIDPipe({ version: "4" }))
    organisationId: string,
    @Param("projectId", new ParseUUIDPipe({ version: "4" })) projectId: string,
  ): Promise<RoleResponseDto[]> {
    return await this.rolesService.findAll(organisationId, projectId);
  }

  @Post()
  @UseGuards(EnterpriseLicenseGuard)
  @Permission(PROJECT_PERMISSIONS.ROLES_CREATE, { allowProjectCreator: true })
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Param("organisationId", new ParseUUIDPipe({ version: "4" }))
    organisationId: string,
    @Param("projectId", new ParseUUIDPipe({ version: "4" })) projectId: string,
    @Body() createRoleDto: CreateRoleRequestDto,
    @Session() userSession: UserSession,
  ): Promise<RoleResponseDto> {
    return await this.rolesService.create(
      organisationId,
      createRoleDto,
      userSession?.user?.id,
      projectId,
    );
  }

  @Get(":roleId")
  @Permission(PROJECT_PERMISSIONS.ROLES_READ, { allowProjectCreator: true })
  async findOne(
    @Param("roleId", new ParseUUIDPipe({ version: "4" })) roleId: string,
  ): Promise<RoleResponseDto> {
    return await this.rolesService.findOneDto(roleId);
  }

  @Put(":roleId")
  @UseGuards(EnterpriseLicenseGuard)
  @Permission(PROJECT_PERMISSIONS.ROLES_UPDATE, { allowProjectCreator: true })
  async update(
    @Param("organisationId", new ParseUUIDPipe({ version: "4" }))
    organisationId: string,
    @Param("projectId", new ParseUUIDPipe({ version: "4" })) projectId: string,
    @Param("roleId", new ParseUUIDPipe({ version: "4" })) roleId: string,
    @Body() updateRoleDto: UpdateRoleRequestDto,
    @Session() userSession: UserSession,
  ): Promise<RoleResponseDto> {
    return await this.rolesService.update(
      organisationId,
      roleId,
      updateRoleDto,
      userSession?.user?.id,
      projectId,
    );
  }

  @Delete(":roleId")
  @UseGuards(EnterpriseLicenseGuard)
  @Permission(PROJECT_PERMISSIONS.ROLES_DELETE, { allowProjectCreator: true })
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(
    @Param("organisationId", new ParseUUIDPipe({ version: "4" }))
    organisationId: string,
    @Param("projectId", new ParseUUIDPipe({ version: "4" })) projectId: string,
    @Param("roleId", new ParseUUIDPipe({ version: "4" })) roleId: string,
    @Session() userSession: UserSession,
  ): Promise<RoleMessageResponseDto> {
    await this.rolesService.delete(
      organisationId,
      roleId,
      userSession?.user?.id,
      projectId,
    );
    return { message: "Role deleted successfully" };
  }
}
