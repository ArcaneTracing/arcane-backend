import { ExperimentComparisonResponseDto } from "../dto/response/experiment-comparison-response.dto";
import { ComparisonStatisticsUtil } from "./comparison-statistics.util";

export interface PairedNumericAggregates {
  n_paired: number;
  mean_a: number;
  mean_b: number;
  delta_mean: number;
  std_delta: number;
  win_rate: number;
  loss_rate: number;
  tie_rate: number;
}

export class NumericComparisonUtil {
  static compare(
    pairedData: Array<{ valueA: number; valueB: number }>,
  ): ExperimentComparisonResponseDto {
    const n_paired = pairedData.length;
    if (n_paired === 0) {
      return {
        numeric: {
          n_paired: 0,
          mean_a: null,
          mean_b: null,
          delta_mean: null,
          ci95_delta: { lower: null, upper: null },
          p_value_permutation: null,
          cohens_dz: null,
          win_rate: null,
          loss_rate: null,
          tie_rate: null,
        },
        nominal: null,
        ordinal: null,
      };
    }

    const deltas = pairedData.map((p) => p.valueB - p.valueA);
    const mean_delta = deltas.reduce((sum, val) => sum + val, 0) / n_paired;
    const variance_delta =
      n_paired > 1
        ? deltas.reduce((sum, val) => sum + Math.pow(val - mean_delta, 2), 0) /
          (n_paired - 1)
        : 0;
    const std_delta = Math.sqrt(variance_delta);

    let wins = 0;
    let losses = 0;
    let ties = 0;
    for (const delta of deltas) {
      if (delta > 0) wins++;
      else if (delta < 0) losses++;
      else ties++;
    }
    const win_rate = wins / n_paired;
    const loss_rate = losses / n_paired;
    const tie_rate = ties / n_paired;

    const mean_a = pairedData.reduce((sum, p) => sum + p.valueA, 0) / n_paired;
    const mean_b = pairedData.reduce((sum, p) => sum + p.valueB, 0) / n_paired;
    const delta_mean = mean_b - mean_a;
    const cohens_dz = std_delta > 0 ? mean_delta / std_delta : null;

    const ci95_delta = ComparisonStatisticsUtil.tBasedCI(
      mean_delta,
      std_delta,
      n_paired,
    );

    const observedDelta = Math.abs(delta_mean);
    const p_value_permutation = ComparisonStatisticsUtil.permutationPValue(
      pairedData,
      observedDelta,
    );

    return {
      numeric: {
        n_paired,
        mean_a,
        mean_b,
        delta_mean,
        ci95_delta,
        p_value_permutation,
        cohens_dz,
        win_rate,
        loss_rate,
        tie_rate,
      },
      nominal: null,
      ordinal: null,
    };
  }
  static compareFromAggregates(
    agg: PairedNumericAggregates,
  ): ExperimentComparisonResponseDto {
    const {
      n_paired,
      mean_a,
      mean_b,
      delta_mean,
      std_delta,
      win_rate,
      loss_rate,
      tie_rate,
    } = agg;
    const cohens_dz =
      std_delta > 0 ? delta_mean / (std_delta / Math.sqrt(n_paired)) : null;
    const ci95_delta = ComparisonStatisticsUtil.tBasedCI(
      delta_mean,
      std_delta,
      n_paired,
    );

    return {
      numeric: {
        n_paired,
        mean_a,
        mean_b,
        delta_mean,
        ci95_delta,
        p_value_permutation: null,
        cohens_dz,
        win_rate,
        loss_rate,
        tie_rate,
      },
      nominal: null,
      ordinal: null,
    };
  }
}
