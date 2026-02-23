import { Injectable, UnprocessableEntityException } from "@nestjs/common";
import { ModelProvider, TemplateType } from "../dto/prompt-types";

@Injectable()
export class PromptConfigValidator {
  validateTemplateType(
    templateType: TemplateType,
    template: { type: string },
  ): void {
    if (templateType === TemplateType.CHAT && template.type !== "chat") {
      throw new UnprocessableEntityException(
        'Template type CHAT requires template.type to be "chat"',
      );
    }
    if (templateType === TemplateType.STR && template.type !== "string") {
      throw new UnprocessableEntityException(
        'Template type STR requires template.type to be "string"',
      );
    }
  }

  validateInvocationParameters(
    modelProvider: ModelProvider,
    invocationParameters: { type: string },
  ): void {
    const providerTypeMap: Record<ModelProvider, string[]> = {
      [ModelProvider.OPENAI]: ["openai"],
      [ModelProvider.AZURE_OPENAI]: ["azure_openai"],
      [ModelProvider.ANTHROPIC]: ["anthropic"],
      [ModelProvider.GOOGLE]: ["google-vertex-ai", "google-ai-studio"],
      [ModelProvider.DEEPSEEK]: ["deepseek"],
      [ModelProvider.XAI]: ["xai"],
      [ModelProvider.OLLAMA]: ["ollama"],
      [ModelProvider.AWS]: ["bedrock"],
    };

    const validTypes = providerTypeMap[modelProvider];
    if (!validTypes?.includes(invocationParameters.type)) {
      throw new UnprocessableEntityException(
        `Invocation parameters type "${invocationParameters.type}" does not match model provider "${modelProvider}"`,
      );
    }
  }
}
