export class NumericDatasetStatisticsResponseDto {
  mean: number | null;
  variance: number | null;
  std: number | null;
  p50: number | null;
  p10: number | null;
  p90: number | null;
  ci95_mean: {
    lower: number | null;
    upper: number | null;
  };
  n_total: number;
  n_scored: number;
}

export class NumericEvaluationStatisticsResponseDto {
  mean: number | null;
  variance: number | null;
  std: number | null;
  p50: number | null;
  p10: number | null;
  p90: number | null;
  ci95_mean: {
    lower: number | null;
    upper: number | null;
  };
  n_total: number;
  n_scored: number;
}
