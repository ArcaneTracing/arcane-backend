import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Param,
  ParseUUIDPipe,
  UseGuards,
  HttpCode,
  HttpStatus,
  UsePipes,
  ValidationPipe,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { AttributeVisibilityRuleService } from "../services/attribute-visibility-rule.service";
import { CreateAttributeVisibilityRuleDto } from "../dto/request/create-attribute-visibility-rule.dto";
import { AddRolesToVisibilityRuleDto } from "../dto/request/add-roles-to-visibility-rule.dto";
import { RemoveRolesFromVisibilityRuleDto } from "../dto/request/remove-roles-from-visibility-rule.dto";
import { AttributeVisibilityRuleResponseDto } from "../dto/response/attribute-visibility-rule-response.dto";
import { OrgProjectPermissionGuard } from "../../rbac/guards/org-project-permission.guard";
import { EnterpriseLicenseGuard } from "../../license/guards/enterprise-license.guard";
import { Permission } from "../../rbac/decorators/permission.decorator";
import { ATTRIBUTE_VISIBILITY_RULE_PERMISSIONS } from "../../rbac/permissions/permissions";
import { Session, UserSession } from "@thallesp/nestjs-better-auth";

@Controller(
  "v1/organisations/:organisationId/projects/:projectId/attribute-visibility-rules",
)
@ApiTags("attribute-visibility-rules")
@ApiBearerAuth("bearer")
@UseGuards(OrgProjectPermissionGuard, EnterpriseLicenseGuard)
@UsePipes(new ValidationPipe({ transform: true }))
export class AttributeVisibilityRuleController {
  constructor(
    private readonly visibilityRuleService: AttributeVisibilityRuleService,
  ) {}

  @Post()
  @Permission(ATTRIBUTE_VISIBILITY_RULE_PERMISSIONS.MANAGE)
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Param("organisationId", new ParseUUIDPipe({ version: "4" }))
    organisationId: string,
    @Param("projectId", new ParseUUIDPipe({ version: "4" })) projectId: string,
    @Body() dto: CreateAttributeVisibilityRuleDto,
    @Session() userSession: UserSession,
  ): Promise<AttributeVisibilityRuleResponseDto> {
    return this.visibilityRuleService.create(
      projectId,
      organisationId,
      dto,
      userSession?.user?.id ?? "",
    );
  }

  @Get()
  @Permission(ATTRIBUTE_VISIBILITY_RULE_PERMISSIONS.READ)
  async findAll(
    @Param("projectId", new ParseUUIDPipe({ version: "4" })) projectId: string,
  ): Promise<AttributeVisibilityRuleResponseDto[]> {
    return this.visibilityRuleService.findAll(projectId);
  }

  @Post(":id/roles")
  @Permission(ATTRIBUTE_VISIBILITY_RULE_PERMISSIONS.MANAGE)
  async addRoles(
    @Param("organisationId", new ParseUUIDPipe({ version: "4" }))
    organisationId: string,
    @Param("projectId", new ParseUUIDPipe({ version: "4" })) projectId: string,
    @Param("id", new ParseUUIDPipe({ version: "4" })) id: string,
    @Body() dto: AddRolesToVisibilityRuleDto,
    @Session() userSession: UserSession,
  ): Promise<AttributeVisibilityRuleResponseDto> {
    return this.visibilityRuleService.addRoles(
      projectId,
      organisationId,
      id,
      dto,
      userSession?.user?.id ?? "",
    );
  }

  @Post(":id/roles/remove")
  @Permission(ATTRIBUTE_VISIBILITY_RULE_PERMISSIONS.MANAGE)
  async removeRoles(
    @Param("organisationId", new ParseUUIDPipe({ version: "4" }))
    organisationId: string,
    @Param("projectId", new ParseUUIDPipe({ version: "4" })) projectId: string,
    @Param("id", new ParseUUIDPipe({ version: "4" })) id: string,
    @Body() dto: RemoveRolesFromVisibilityRuleDto,
    @Session() userSession: UserSession,
  ): Promise<AttributeVisibilityRuleResponseDto> {
    return this.visibilityRuleService.removeRoles(
      projectId,
      organisationId,
      id,
      dto,
      userSession?.user?.id ?? "",
    );
  }

  @Delete(":id")
  @Permission(ATTRIBUTE_VISIBILITY_RULE_PERMISSIONS.MANAGE)
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(
    @Param("organisationId", new ParseUUIDPipe({ version: "4" }))
    organisationId: string,
    @Param("projectId", new ParseUUIDPipe({ version: "4" })) projectId: string,
    @Param("id", new ParseUUIDPipe({ version: "4" })) id: string,
    @Session() userSession: UserSession,
  ): Promise<void> {
    await this.visibilityRuleService.delete(
      projectId,
      organisationId,
      id,
      userSession?.user?.id ?? "",
    );
  }
}
