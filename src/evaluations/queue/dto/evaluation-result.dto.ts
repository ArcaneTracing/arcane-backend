export interface EvaluationResultQueueDto {
  evaluationId: string;
  scoreId: string;
  datasetRowId?: string | null;
  experimentResultId?: string | null;
  score: number | string;
  metric?: string;
  metricId?: string;
  reasoning?: string | null;
  messageId?: string;
}
