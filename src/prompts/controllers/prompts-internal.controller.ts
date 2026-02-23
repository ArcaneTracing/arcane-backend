import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  UseGuards,
} from "@nestjs/common";
import { AllowAnonymous } from "@thallesp/nestjs-better-auth";
import { ApiKeyGuard } from "../../auth/guards/api-key.guard";
import { ApiSecurity, ApiTags } from "@nestjs/swagger";
import { PromptVersionResponseDto } from "../dto/response/prompt-response.dto";
import { PromptVersionMapper } from "../mappers/prompt-version.mapper";
import { PromptVersionsService } from "../services/prompt-versions.service";

@Controller("/internal/prompts")
@ApiTags("internal-prompts")
@ApiSecurity("apiKey")
@AllowAnonymous()
@UseGuards(ApiKeyGuard)
export class PromptsInternalController {
  constructor(private readonly promptVersionsService: PromptVersionsService) {}

  @Get(":promptId/latest-version")
  async getLatestVersion(
    @Param("promptId", ParseUUIDPipe) promptId: string,
  ): Promise<PromptVersionResponseDto> {
    const version =
      await this.promptVersionsService.getLatestVersionByPromptId(promptId);
    return PromptVersionMapper.toDto(version, true);
  }
}
