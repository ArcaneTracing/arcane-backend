export interface ExperimentJobDto {
  experimentId: string;
  datasetRowId: string;

  promptId: string;
  inputs: Record<string, unknown>;

  messageId?: string;
}
