export class NominalStatisticsResponseDto {
  scoreId?: string;
  n_total: number;
  n_scored: number;
  counts_by_code: Record<string, number>;
  proportions_by_code: Record<string, number>;
  ci_proportion_by_code: Record<string, { lower: number; upper: number }>;
  mode_code: string | null;
  entropy: number | null;
  num_distinct_categories: number;
}
