import {
  Controller,
  Get,
  Param,
  UseGuards,
  NotFoundException,
} from "@nestjs/common";
import { AllowAnonymous } from "@thallesp/nestjs-better-auth";
import { ApiSecurity, ApiTags } from "@nestjs/swagger";
import { PromptsService } from "../services/prompts.service";
import { PromptVersionsService } from "../services/prompt-versions.service";
import {
  PromptResponseDto,
  PromptVersionResponseDto,
  ListResponseDto,
  ResponseDto,
} from "../dto/response/prompt-response.dto";
import { ProjectApiKeyGuard } from "../../projects/guards/project-api-key.guard";
import {
  ProjectApiKeyContext,
  ProjectApiKeyContextData,
} from "../../common/decorators/project-api-key-context.decorator";

@Controller("api/public/prompts")
@ApiTags("public-prompts")
@ApiSecurity("apiKey")
@AllowAnonymous()
@UseGuards(ProjectApiKeyGuard)
export class PromptsPublicController {
  constructor(
    private readonly promptsService: PromptsService,
    private readonly promptVersionsService: PromptVersionsService,
  ) {}

  @Get()
  async findAll(
    @ProjectApiKeyContext() ctx: ProjectApiKeyContextData,
  ): Promise<ListResponseDto<PromptResponseDto>> {
    return this.promptsService.findAll(ctx.projectId);
  }

  @Get(":prompt_identifier")
  async findOne(
    @ProjectApiKeyContext() ctx: ProjectApiKeyContextData,
    @Param("prompt_identifier") promptIdentifier: string,
  ): Promise<ResponseDto<PromptResponseDto>> {
    const prompt = await this.promptsService.findOne(
      ctx.projectId,
      promptIdentifier,
    );
    if (!prompt) {
      throw new NotFoundException(`Prompt not found: ${promptIdentifier}`);
    }
    return { data: prompt };
  }

  @Get(":prompt_identifier/versions")
  async findVersions(
    @ProjectApiKeyContext() ctx: ProjectApiKeyContextData,
    @Param("prompt_identifier") promptIdentifier: string,
  ): Promise<ListResponseDto<PromptVersionResponseDto>> {
    return this.promptVersionsService.findVersions(
      ctx.projectId,
      promptIdentifier,
    );
  }

  @Get(":prompt_identifier/latest")
  async findLatestVersion(
    @ProjectApiKeyContext() ctx: ProjectApiKeyContextData,
    @Param("prompt_identifier") promptIdentifier: string,
  ): Promise<ResponseDto<PromptVersionResponseDto>> {
    return this.promptVersionsService.findLatestVersion(
      ctx.projectId,
      promptIdentifier,
    );
  }
}
