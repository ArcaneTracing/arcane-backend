export interface EvaluationJobDto {
  evaluationId: string;
  ragasModelConfigurationId: string | null;
  scoreId: string;
  scoringType: string;
  datasetRowId: string | null;
  experimentResultId: string | null;
  scoreMapping: Record<string, unknown>;
  ragasScoreKey: string | null;
  promptId?: string | null;

  messageId?: string;
}
