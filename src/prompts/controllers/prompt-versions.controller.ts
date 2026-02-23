import {
  Controller,
  Get,
  Param,
  UseGuards,
  ParseUUIDPipe,
} from "@nestjs/common";
import { PromptVersionsService } from "../services/prompt-versions.service";
import {
  PromptVersionResponseDto,
  ResponseDto,
} from "../dto/response/prompt-response.dto";
import { OrgProjectPermissionGuard } from "../../rbac/guards/org-project-permission.guard";
import { Permission } from "../../rbac/decorators/permission.decorator";
import { PROMPT_PERMISSIONS } from "../../rbac/permissions/permissions";

@Controller(
  "v1/organisations/:organisationId/projects/:projectId/prompt_versions",
)
@UseGuards(OrgProjectPermissionGuard)
export class PromptVersionsController {
  constructor(private readonly promptVersionsService: PromptVersionsService) {}

  @Get(":id")
  @Permission(PROMPT_PERMISSIONS.READ)
  async findVersionById(
    @Param("projectId", new ParseUUIDPipe({ version: "4" })) projectId: string,
    @Param("id", new ParseUUIDPipe({ version: "4" })) id: string,
  ): Promise<ResponseDto<PromptVersionResponseDto>> {
    return this.promptVersionsService.findVersionById(projectId, id);
  }
}
