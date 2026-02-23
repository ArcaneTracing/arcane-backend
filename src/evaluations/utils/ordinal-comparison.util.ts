import { Logger } from "@nestjs/common";
import { NominalComparisonResponseDto } from "../dto/response/nominal-comparison-response.dto";
import { OrdinalComparisonResponseDto } from "../dto/response/ordinal-comparison-response.dto";
import { ComparisonStatisticsUtil } from "./comparison-statistics.util";
import { NominalComparisonUtil } from "./nominal-comparison.util";

export class OrdinalComparisonUtil {
  static compare(
    valuesA: string[],
    valuesB: string[],
    n_paired: number,
    scale: Array<{ label: string; value: number }> | null,
    ordinalConfig?: {
      acceptable_set?: string[];
      threshold_rank?: number;
    } | null,
    logger?: Logger,
  ): OrdinalComparisonResponseDto {
    const nominalComparison = NominalComparisonUtil.compare(
      valuesA,
      valuesB,
      n_paired,
    );

    if (n_paired === 0 || !scale || scale.length === 0) {
      return this.emptyOrdinalResult(nominalComparison);
    }

    const sortedScale = [...scale].sort((a, b) => a.value - b.value);
    const { countsA, countsB } = this.buildCounts(valuesA, valuesB);
    const { cdfA, cdfB } = this.buildCdfs(
      sortedScale,
      countsA,
      countsB,
      n_paired,
    );
    const cdf_comparison = this.buildCdfComparison(sortedScale, cdfA, cdfB);
    const median_a = this.findPercentileCategory(sortedScale, cdfA, 50);
    const median_b = this.findPercentileCategory(sortedScale, cdfB, 50);
    const percentile_shift = {
      p50: {
        category_a: this.findPercentileCategory(sortedScale, cdfA, 50),
        category_b: this.findPercentileCategory(sortedScale, cdfB, 50),
      },
      p90: {
        category_a: this.findPercentileCategory(sortedScale, cdfA, 90),
        category_b: this.findPercentileCategory(sortedScale, cdfB, 90),
      },
    };
    const ranksA = this.mapToRanks(valuesA, scale);
    const ranksB = this.mapToRanks(valuesB, scale);
    const pairedDifferences = ranksA.map((_, i) => ranksB[i] - ranksA[i]);
    const { wStatistic, pValue } =
      ComparisonStatisticsUtil.wilcoxonSignedRank(pairedDifferences);
    const cliffs_delta = this.calculateCliffsDeltaPaired(pairedDifferences);
    const probability_of_superiority =
      this.calculateProbabilityOfSuperiorityPaired(pairedDifferences);
    const delta_pass_rate = this.calculateDeltaPassRate(
      valuesA,
      valuesB,
      n_paired,
      scale,
      ordinalConfig,
      logger,
    );
    const delta_tail_mass = this.calculateDeltaTailMass(
      valuesA,
      valuesB,
      n_paired,
      sortedScale,
      ordinalConfig,
    );

    return {
      ...nominalComparison,
      cdf_comparison,
      delta_pass_rate,
      delta_tail_mass,
      median_comparison: { median_a, median_b },
      percentile_shift,
      wilcoxon_signed_rank: { w_statistic: wStatistic, p_value: pValue },
      cliffs_delta,
      probability_of_superiority,
    };
  }

  private static emptyOrdinalResult(
    nominal: NominalComparisonResponseDto,
  ): OrdinalComparisonResponseDto {
    return {
      ...nominal,
      cdf_comparison: {},
      delta_pass_rate: null,
      delta_tail_mass: null,
      median_comparison: { median_a: null, median_b: null },
      percentile_shift: {
        p50: { category_a: null, category_b: null },
        p90: { category_a: null, category_b: null },
      },
      wilcoxon_signed_rank: { w_statistic: null, p_value: null },
      cliffs_delta: null,
      probability_of_superiority: null,
    };
  }

  private static calculateCliffsDeltaPaired(
    pairedDifferences: number[],
  ): number | null {
    if (pairedDifferences.length === 0) return null;
    let dominance = 0;
    for (const d of pairedDifferences) {
      if (d > 0) dominance++;
      else if (d < 0) dominance--;
    }
    return dominance / pairedDifferences.length;
  }

  private static calculateProbabilityOfSuperiorityPaired(
    pairedDifferences: number[],
  ): number | null {
    if (pairedDifferences.length === 0) return null;
    const superior = pairedDifferences.filter((d) => d > 0).length;
    return superior / pairedDifferences.length;
  }

  private static buildCounts(
    valuesA: string[],
    valuesB: string[],
  ): { countsA: Record<string, number>; countsB: Record<string, number> } {
    const countsA: Record<string, number> = {};
    const countsB: Record<string, number> = {};
    for (const val of valuesA) countsA[val] = (countsA[val] || 0) + 1;
    for (const val of valuesB) countsB[val] = (countsB[val] || 0) + 1;
    return { countsA, countsB };
  }

  private static buildCdfs(
    sortedScale: Array<{ label: string; value: number }>,
    countsA: Record<string, number>,
    countsB: Record<string, number>,
    n_paired: number,
  ): { cdfA: Record<string, number>; cdfB: Record<string, number> } {
    const cdfA: Record<string, number> = {};
    const cdfB: Record<string, number> = {};
    let cumulativeA = 0;
    let cumulativeB = 0;
    for (const option of sortedScale) {
      const countA =
        countsA[option.label] ?? countsA[String(option.value)] ?? 0;
      const countB =
        countsB[option.label] ?? countsB[String(option.value)] ?? 0;
      cumulativeA += countA;
      cumulativeB += countB;
      cdfA[option.label] = cumulativeA / n_paired;
      cdfB[option.label] = cumulativeB / n_paired;
    }
    return { cdfA, cdfB };
  }

  private static buildCdfComparison(
    sortedScale: Array<{ label: string; value: number }>,
    cdfA: Record<string, number>,
    cdfB: Record<string, number>,
  ): Record<string, { cdf_a: number; cdf_b: number; delta_cdf: number }> {
    const result: Record<
      string,
      { cdf_a: number; cdf_b: number; delta_cdf: number }
    > = {};
    for (const option of sortedScale) {
      const a = cdfA[option.label] || 0;
      const b = cdfB[option.label] || 0;
      result[option.label] = { cdf_a: a, cdf_b: b, delta_cdf: b - a };
    }
    return result;
  }

  private static findPercentileCategory(
    sortedScale: Array<{ label: string; value: number }>,
    cdf: Record<string, number>,
    percentile: number,
  ): string | null {
    for (const option of sortedScale) {
      if (cdf[option.label] >= percentile / 100) return option.label;
    }
    return sortedScale[sortedScale.length - 1]?.label || null;
  }

  private static mapToRanks(
    values: string[],
    scale: Array<{ label: string; value: number }>,
  ): number[] {
    return values
      .map((code) => {
        for (const option of scale) {
          if (option.label === code || String(option.value) === code)
            return option.value;
        }
        return null;
      })
      .filter((r): r is number => r !== null);
  }

  private static calculateDeltaPassRate(
    valuesA: string[],
    valuesB: string[],
    n_paired: number,
    scale: Array<{ label: string; value: number }>,
    ordinalConfig?: { acceptable_set?: string[] } | null,
    logger?: Logger,
  ): OrdinalComparisonResponseDto["delta_pass_rate"] {
    if (!ordinalConfig?.acceptable_set?.length || n_paired === 0) {
      logger?.debug(
        `[Ordinal Comparison] Skipping delta_pass_rate: ordinalConfig?.acceptable_set=${ordinalConfig?.acceptable_set ? JSON.stringify(ordinalConfig.acceptable_set) : "null"}, n_paired=${n_paired}`,
      );
      return null;
    }
    const acceptableSet = new Set<string>(ordinalConfig.acceptable_set);
    for (const acceptableCode of ordinalConfig.acceptable_set) {
      for (const option of scale) {
        if (option.label === acceptableCode)
          acceptableSet.add(String(option.value));
        if (String(option.value) === acceptableCode)
          acceptableSet.add(option.label);
      }
    }
    const acceptableCountA = valuesA.filter((c) => acceptableSet.has(c)).length;
    const acceptableCountB = valuesB.filter((c) => acceptableSet.has(c)).length;
    const ci = ComparisonStatisticsUtil.bootstrapDeltaRateCI(
      valuesA,
      valuesB,
      n_paired,
      (code) => acceptableSet.has(code),
    );
    return {
      pass_rate_a: acceptableCountA / n_paired,
      pass_rate_b: acceptableCountB / n_paired,
      delta: acceptableCountB / n_paired - acceptableCountA / n_paired,
      ci,
    };
  }

  private static calculateDeltaTailMass(
    valuesA: string[],
    valuesB: string[],
    n_paired: number,
    sortedScale: Array<{ label: string; value: number }>,
    ordinalConfig?: { threshold_rank?: number } | null,
  ): OrdinalComparisonResponseDto["delta_tail_mass"] {
    if (ordinalConfig?.threshold_rank === undefined || n_paired === 0)
      return null;
    const codeToRank = new Map<string, number>();
    for (const option of sortedScale) {
      codeToRank.set(option.label, option.value);
      codeToRank.set(String(option.value), option.value);
    }
    const thresholdRank = ordinalConfig.threshold_rank;
    const belowA = valuesA.filter(
      (c) => (codeToRank.get(c) ?? Infinity) < thresholdRank,
    ).length;
    const belowB = valuesB.filter(
      (c) => (codeToRank.get(c) ?? Infinity) < thresholdRank,
    ).length;
    const ci = ComparisonStatisticsUtil.bootstrapDeltaRateCI(
      valuesA,
      valuesB,
      n_paired,
      (code) => (codeToRank.get(code) ?? Infinity) < thresholdRank,
    );
    return {
      tail_mass_a: belowA / n_paired,
      tail_mass_b: belowB / n_paired,
      delta: belowB / n_paired - belowA / n_paired,
      ci,
    };
  }
}
