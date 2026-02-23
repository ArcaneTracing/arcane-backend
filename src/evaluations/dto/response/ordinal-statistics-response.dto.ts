import { NominalStatisticsResponseDto } from "./nominal-statistics-response.dto";

export class OrdinalStatisticsResponseDto extends NominalStatisticsResponseDto {
  median_category: string | null;
  percentile_categories: {
    p10: string | null;
    p50: string | null;
    p90: string | null;
  };
  cdf: Record<string, number>;
  tail_mass_below: {
    threshold_rank: number;
    proportion: number;
    ci: {
      lower: number;
      upper: number;
    };
  } | null;
  pass_rate: {
    acceptable_set: string[];
    proportion: number;
    ci: {
      lower: number;
      upper: number;
    };
  } | null;
  iqr_rank: number | null;
}
