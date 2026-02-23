export interface ExperimentResultQueueDto {
  experimentId: string;
  datasetRowId: string;
  result: string;
  metadata?: {
    execution_time_ms?: number;
    tokens_used?: number;
    [key: string]: unknown;
  };
  error?: string;
  messageId?: string;
}
