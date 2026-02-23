import { NominalComparisonResponseDto } from "./nominal-comparison-response.dto";

export class OrdinalComparisonResponseDto extends NominalComparisonResponseDto {
  cdf_comparison: Record<
    string,
    {
      cdf_a: number;
      cdf_b: number;
      delta_cdf: number;
    }
  >;
  delta_pass_rate: {
    pass_rate_a: number;
    pass_rate_b: number;
    delta: number;
    ci: {
      lower: number | null;
      upper: number | null;
    };
  } | null;
  delta_tail_mass: {
    tail_mass_a: number;
    tail_mass_b: number;
    delta: number;
    ci: {
      lower: number | null;
      upper: number | null;
    };
  } | null;
  median_comparison: {
    median_a: string | null;
    median_b: string | null;
  };
  percentile_shift: {
    p50: { category_a: string | null; category_b: string | null };
    p90: { category_a: string | null; category_b: string | null };
  };
  wilcoxon_signed_rank: {
    w_statistic: number | null;
    p_value: number | null;
  };
  cliffs_delta: number | null;
  probability_of_superiority: number | null;
}
