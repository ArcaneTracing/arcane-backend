import { ModelProvider } from "../dto/prompt-types";

export class ModelProviderMapper {
  static fromAdapter(adapter: string): ModelProvider {
    const adapterMap: Record<string, ModelProvider> = {
      openai: ModelProvider.OPENAI,
      azure: ModelProvider.AZURE_OPENAI,
      anthropic: ModelProvider.ANTHROPIC,
      "google-vertex-ai": ModelProvider.GOOGLE,
      "google-ai-studio": ModelProvider.GOOGLE,
      bedrock: ModelProvider.AWS,
      deepseek: ModelProvider.DEEPSEEK,
      xai: ModelProvider.XAI,
      ollama: ModelProvider.OLLAMA,
    };
    return adapterMap[adapter] || ModelProvider.OPENAI;
  }
}
