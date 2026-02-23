import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  ParseUUIDPipe,
  UseGuards,
  HttpCode,
  HttpStatus,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { ProjectApiKeyService } from "../services/project-api-key.service";
import { OrgProjectPermissionGuard } from "../../rbac/guards/org-project-permission.guard";
import { Permission } from "../../rbac/decorators/permission.decorator";
import { PROJECT_API_KEY_PERMISSIONS } from "../../rbac/permissions/permissions";
import { Session, UserSession } from "@thallesp/nestjs-better-auth";

@Controller("v1/organisations/:organisationId/projects/:projectId/api-keys")
@ApiTags("api-keys")
@ApiBearerAuth("bearer")
@UseGuards(OrgProjectPermissionGuard)
export class ApiKeysController {
  constructor(private readonly projectApiKeyService: ProjectApiKeyService) {}

  @Get()
  @Permission(PROJECT_API_KEY_PERMISSIONS.READ)
  async getStatus(@Param("projectId", new ParseUUIDPipe()) projectId: string) {
    return this.projectApiKeyService.findByProject(projectId);
  }

  @Post()
  @Permission(PROJECT_API_KEY_PERMISSIONS.MANAGE)
  @HttpCode(HttpStatus.CREATED)
  async createOrRegenerate(
    @Param("projectId", new ParseUUIDPipe()) projectId: string,
    @Session() userSession: UserSession,
  ) {
    return this.projectApiKeyService.createOrRegenerate(
      projectId,
      userSession?.user?.id ?? "",
    );
  }

  @Delete()
  @Permission(PROJECT_API_KEY_PERMISSIONS.MANAGE)
  @HttpCode(HttpStatus.NO_CONTENT)
  async revoke(
    @Param("projectId", new ParseUUIDPipe()) projectId: string,
  ): Promise<void> {
    await this.projectApiKeyService.revoke(projectId);
  }
}
