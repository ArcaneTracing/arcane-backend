export class NumericComparisonResponseDto {
  n_paired: number;
  mean_a: number | null;
  mean_b: number | null;
  delta_mean: number | null;
  ci95_delta: {
    lower: number | null;
    upper: number | null;
  };
  p_value_permutation: number | null;
  cohens_dz: number | null;
  win_rate: number | null;
  loss_rate: number | null;
  tie_rate: number | null;
}
