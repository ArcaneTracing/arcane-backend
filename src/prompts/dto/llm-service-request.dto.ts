import { ModelConfigurationData } from "../../model-configuration/dto/model-configuration-types";
import { PromptVersionResponseDto } from "./response/prompt-response.dto";

export interface LLMServiceRequestDto {
  model_configuration: {
    id: string;
    name: string;
    configuration: ModelConfigurationData & {
      apiKey: string;
    };
    createdAt: Date;
    updatedAt: Date;
  };
  prompt_version: PromptVersionResponseDto;
  inputs: Record<string, unknown>;
}
export interface LLMServiceResponseDto {
  output: string;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  model?: {
    id: string;
    name: string;
  };
  metadata?: {
    execution_time_ms: number;
    finish_reason?: string;
  };
  tool_calls?: Array<{
    id: string;
    name: string;
    arguments: Record<string, unknown>;
  }>;
}
