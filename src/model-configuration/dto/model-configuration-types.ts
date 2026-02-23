export type AdapterType =
  | "anthropic"
  | "openai"
  | "azure"
  | "bedrock"
  | "google-vertex-ai"
  | "google-ai-studio";

export interface BaseModelConfiguration {
  adapter: AdapterType;
  modelName: string;
  apiKey: string;
  inputCostPerToken?: number;
  outputCostPerToken?: number;

  temperature?: number;
  maxTokens?: number;
  topP?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
  stopSequences?: string[];

  config?: Record<string, unknown>;
}

export interface AzureConfig {
  endpoint: string;
  apiVersion?: string;
  deploymentName?: string;
}

export interface BedrockConfig {
  region: string;
  endpointUrl?: string;
  awsAccessKeyId?: string;
  awsSecretAccessKey?: string;
}

export interface GoogleVertexConfig {
  project?: string;
  location?: string;
  credentials?: Record<string, unknown>;
}

export interface GoogleStudioConfig {
  project?: string;
  baseUrl?: string;
}

export interface AnthropicConfig {
  baseUrl?: string;
  timeout?: number;
}

export type ModelConfigurationData = BaseModelConfiguration;
