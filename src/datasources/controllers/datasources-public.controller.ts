import { Controller, Get, UseGuards } from "@nestjs/common";
import { AllowAnonymous } from "@thallesp/nestjs-better-auth";
import { ApiSecurity, ApiTags } from "@nestjs/swagger";
import { DatasourcesService } from "../services/datasources.service";
import { DatasourceListItemResponseDto } from "../dto/response/datasource-list-item-response.dto";
import { ProjectApiKeyGuard } from "../../projects/guards/project-api-key.guard";
import {
  ProjectApiKeyContext,
  ProjectApiKeyContextData,
} from "../../common/decorators/project-api-key-context.decorator";

@Controller("api/public/datasources")
@ApiTags("public-datasources")
@ApiSecurity("apiKey")
@AllowAnonymous()
@UseGuards(ProjectApiKeyGuard)
export class DatasourcesPublicController {
  constructor(private readonly datasourcesService: DatasourcesService) {}

  @Get()
  async findAll(
    @ProjectApiKeyContext() ctx: ProjectApiKeyContextData,
  ): Promise<DatasourceListItemResponseDto[]> {
    return this.datasourcesService.findAllListItems(ctx.organisationId);
  }
}
