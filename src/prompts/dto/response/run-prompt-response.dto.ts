export interface RunPromptResponseDto {
  output: string;
  modelConfigurationId: string;
  promptVersionId: string;
  inputs: Record<string, unknown>;
  metadata?: {
    tokensUsed?: number;
    executionTimeMs?: number;
  };
}
