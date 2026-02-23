import { PromptVersion } from "../entities/prompt-version.entity";
import { PromptVersionResponseDto } from "../dto/response/prompt-response.dto";
import { CreatePromptVersionRequestDto } from "../dto/request/create-prompt-request.dto";
import { ModelConfiguration } from "../../model-configuration/entities/model-configuration.entity";
import { Prompt } from "../entities/prompt.entity";

export class PromptVersionMapper {
  static toEntity(params: {
    promptId: string;
    prompt: Prompt;
    userId: string;
    modelConfiguration: ModelConfiguration;
    version: CreatePromptVersionRequestDto;
  }): Partial<PromptVersion> {
    return {
      promptId: params.promptId,
      prompt: params.prompt,
      userId: params.userId,
      versionName: params.version.versionName || null,
      description: params.version.description || null,
      modelConfigurationId: params.version.modelConfigurationId,
      modelConfiguration: params.modelConfiguration,
      templateType: params.version.templateType,
      templateFormat: params.version.templateFormat,
      template: params.version.template,
      invocationParameters: params.version.invocationParameters,
      tools: params.version.tools || null,
      responseFormat: params.version.responseFormat || null,
    };
  }

  static toDto(
    version: PromptVersion,
    includePromptInfo = false,
  ): PromptVersionResponseDto {
    return {
      id: version.id,
      promptId: includePromptInfo
        ? version.prompt?.id || version.promptId
        : version.promptId,
      promptName: includePromptInfo ? version.prompt?.name || "" : "",
      versionName: version.versionName,
      description: version.description,
      modelConfigurationId: version.modelConfigurationId,
      template: version.template as any,
      templateType: version.templateType,
      templateFormat: version.templateFormat,
      invocationParameters: version.invocationParameters as any,
      tools: (version.tools as any) || null,
      responseFormat: (version.responseFormat as any) || null,
      createdAt: version.createdAt.toISOString(),
      updatedAt: version.updatedAt.toISOString(),
    };
  }
}
