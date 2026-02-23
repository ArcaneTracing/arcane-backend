export class NominalComparisonResponseDto {
  n_paired: number;
  distribution_comparison: Record<
    string,
    {
      proportion_a: number;
      proportion_b: number;
      delta_proportion: number;
      ci_delta: { lower: number; upper: number };
    }
  >;
  bowker_test: {
    chi_squared: number | null;
    p_value: number | null;
    degrees_of_freedom: number | null;
  };
  cramers_v: number | null;
  entropy_difference: number | null;
  category_changes: {
    appeared_in_b: string[];
    disappeared_in_b: string[];
  } | null;
}
