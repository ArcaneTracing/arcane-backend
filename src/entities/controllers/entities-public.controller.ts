import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  UseGuards,
} from "@nestjs/common";
import { AllowAnonymous } from "@thallesp/nestjs-better-auth";
import { ApiSecurity, ApiTags } from "@nestjs/swagger";
import { EntitiesService } from "../services/entities.service";
import { EntityResponseDto } from "../dto/response/entity-response.dto";
import { ProjectApiKeyGuard } from "../../projects/guards/project-api-key.guard";
import {
  ProjectApiKeyContext,
  ProjectApiKeyContextData,
} from "../../common/decorators/project-api-key-context.decorator";

@Controller("api/public/entities")
@ApiTags("public-entities")
@ApiSecurity("apiKey")
@AllowAnonymous()
@UseGuards(ProjectApiKeyGuard)
export class EntitiesPublicController {
  constructor(private readonly entitiesService: EntitiesService) {}

  @Get()
  async findAll(
    @ProjectApiKeyContext() ctx: ProjectApiKeyContextData,
  ): Promise<EntityResponseDto[]> {
    return this.entitiesService.findAll(ctx.organisationId);
  }

  @Get(":id")
  async findOne(
    @ProjectApiKeyContext() ctx: ProjectApiKeyContextData,
    @Param("id", new ParseUUIDPipe()) id: string,
  ): Promise<EntityResponseDto> {
    return this.entitiesService.findOne(ctx.organisationId, id);
  }
}
