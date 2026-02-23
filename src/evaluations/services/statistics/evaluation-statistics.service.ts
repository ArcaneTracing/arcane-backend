import { Injectable } from "@nestjs/common";
import { NominalStatisticsResponseDto } from "../../dto/response/nominal-statistics-response.dto";
import { OrdinalStatisticsResponseDto } from "../../dto/response/ordinal-statistics-response.dto";
import {
  NumericDatasetStatisticsResponseDto,
  NumericEvaluationStatisticsResponseDto,
} from "../../dto/response/numeric-statistics-response.dto";

@Injectable()
export class EvaluationStatisticsService {
  wilsonCI(
    n: number,
    successes: number,
    confidence: number = 0.95,
  ): { lower: number; upper: number } {
    if (n === 0) {
      return { lower: 0, upper: 0 };
    }

    let z: number;
    if (confidence === 0.95) {
      z = 1.96;
    } else if (confidence === 0.99) {
      z = 2.576;
    } else {
      z = 1.96;
    }
    const p = successes / n;
    const denominator = 1 + (z * z) / n;
    const center = (p + (z * z) / (2 * n)) / denominator;
    const margin =
      (z / denominator) * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n));

    return {
      lower: Math.max(0, center - margin),
      upper: Math.min(1, center + margin),
    };
  }

  private getTValue(n: number, _confidence: number = 0.95): number {
    if (n >= 30) return 1.96;
    if (n >= 20) return 2.086;
    if (n >= 15) return 2.131;
    if (n >= 10) return 2.228;
    if (n >= 5) return 2.571;
    if (n >= 3) return 3.182;
    return 4.303;
  }

  private calculateEntropy(proportions: number[]): number {
    return proportions.reduce((entropy, p) => {
      if (p > 0) {
        return entropy - p * Math.log2(p);
      }
      return entropy;
    }, 0);
  }

  calculateNominalStatistics(
    categoryValues: string[],
    n_total: number,
  ): Omit<NominalStatisticsResponseDto, "scoreId"> {
    const n_scored = categoryValues.length;

    if (n_scored === 0) {
      return {
        n_total,
        n_scored: 0,
        counts_by_code: {},
        proportions_by_code: {},
        ci_proportion_by_code: {},
        mode_code: null,
        entropy: null,
        num_distinct_categories: 0,
      };
    }

    const counts_by_code: Record<string, number> = {};
    for (const code of categoryValues) {
      counts_by_code[code] = (counts_by_code[code] || 0) + 1;
    }

    const proportions_by_code: Record<string, number> = {};
    for (const [code, count] of Object.entries(counts_by_code)) {
      proportions_by_code[code] = count / n_scored;
    }

    const ci_proportion_by_code: Record<
      string,
      { lower: number; upper: number }
    > = {};
    for (const [code, count] of Object.entries(counts_by_code)) {
      ci_proportion_by_code[code] = this.wilsonCI(n_scored, count);
    }

    let mode_code: string | null = null;
    let maxCount = 0;
    for (const [code, count] of Object.entries(counts_by_code)) {
      if (count > maxCount) {
        maxCount = count;
        mode_code = code;
      }
    }

    const proportions = Object.values(proportions_by_code);
    const entropy = this.calculateEntropy(proportions);

    return {
      n_total,
      n_scored,
      counts_by_code,
      proportions_by_code,
      ci_proportion_by_code,
      mode_code,
      entropy,
      num_distinct_categories: Object.keys(counts_by_code).length,
    };
  }

  calculateOrdinalStatistics(
    categoryValues: string[],
    n_total: number,
    scale: Array<{ label: string; value: number }> | null,
    ordinalConfig?: {
      acceptable_set?: string[];
      threshold_rank?: number;
    } | null,
  ): Omit<OrdinalStatisticsResponseDto, "scoreId"> {
    const nominalStats = this.calculateNominalStatistics(
      categoryValues,
      n_total,
    );

    if (nominalStats.n_scored === 0 || !scale || scale.length === 0) {
      return this.emptyOrdinalStats(nominalStats);
    }

    const codeToRank = this.buildCodeToRankMap(scale);
    const sortedScale = [...scale].sort((a, b) => a.value - b.value);
    const cdf = this.buildCdf(sortedScale, nominalStats);
    const median_category = this.findMedianCategory(sortedScale, cdf);
    const percentile_categories = this.buildPercentileCategories(
      sortedScale,
      cdf,
    );
    const ranks = this.mapCategoriesToRanks(categoryValues, scale);
    const iqr_rank = this.calculateIqrRank(ranks);
    const pass_rate = this.calculatePassRate(
      categoryValues,
      nominalStats,
      ordinalConfig,
    );
    const tail_mass_below = this.calculateTailMassBelow(
      categoryValues,
      nominalStats,
      codeToRank,
      ordinalConfig,
    );

    return {
      ...nominalStats,
      median_category,
      percentile_categories,
      cdf,
      tail_mass_below,
      pass_rate,
      iqr_rank,
    };
  }

  private emptyOrdinalStats(
    nominalStats: Omit<NominalStatisticsResponseDto, "scoreId">,
  ): Omit<OrdinalStatisticsResponseDto, "scoreId"> {
    return {
      ...nominalStats,
      median_category: null,
      percentile_categories: { p10: null, p50: null, p90: null },
      cdf: {},
      tail_mass_below: null,
      pass_rate: null,
      iqr_rank: null,
    };
  }

  private buildCodeToRankMap(
    scale: Array<{ label: string; value: number }>,
  ): Map<string, number> {
    const codeToRank = new Map<string, number>();
    for (const option of scale) {
      codeToRank.set(option.label, option.value);
      codeToRank.set(String(option.value), option.value);
    }
    return codeToRank;
  }

  private buildCdf(
    sortedScale: Array<{ label: string; value: number }>,
    nominalStats: { counts_by_code: Record<string, number>; n_scored: number },
  ): Record<string, number> {
    const cdf: Record<string, number> = {};
    let cumulative = 0;
    for (const option of sortedScale) {
      const count = nominalStats.counts_by_code[option.label] || 0;
      cumulative += count;
      cdf[option.label] = cumulative / nominalStats.n_scored;
    }
    return cdf;
  }

  private findMedianCategory(
    sortedScale: Array<{ label: string; value: number }>,
    cdf: Record<string, number>,
  ): string | null {
    for (const option of sortedScale) {
      if (cdf[option.label] >= 0.5) return option.label;
    }
    return null;
  }

  private buildPercentileCategories(
    sortedScale: Array<{ label: string; value: number }>,
    cdf: Record<string, number>,
  ): { p10: string | null; p50: string | null; p90: string | null } {
    const find = (p: number) => {
      for (const option of sortedScale) {
        if (cdf[option.label] >= p / 100) return option.label;
      }
      return sortedScale[sortedScale.length - 1]?.label || null;
    };
    return { p10: find(10), p50: find(50), p90: find(90) };
  }

  private mapCategoriesToRanks(
    categoryValues: string[],
    scale: Array<{ label: string; value: number }>,
  ): number[] {
    return categoryValues
      .map((code) => {
        for (const option of scale) {
          if (option.label === code || String(option.value) === code)
            return option.value;
        }
        return null;
      })
      .filter((rank): rank is number => rank !== null);
  }

  private calculateIqrRank(ranks: number[]): number | null {
    if (ranks.length === 0) return null;
    const sorted = [...ranks].sort((a, b) => a - b);
    const q1 = sorted[Math.floor(sorted.length * 0.25)];
    const q3 = sorted[Math.floor(sorted.length * 0.75)];
    return q3 - q1;
  }

  private calculatePassRate(
    categoryValues: string[],
    nominalStats: { n_scored: number },
    ordinalConfig?: { acceptable_set?: string[] } | null,
  ): OrdinalStatisticsResponseDto["pass_rate"] {
    if (!ordinalConfig?.acceptable_set?.length || nominalStats.n_scored === 0)
      return null;
    const acceptableSet = new Set(ordinalConfig.acceptable_set);
    const acceptableCount = categoryValues.filter((c) =>
      acceptableSet.has(c),
    ).length;
    const ci = this.wilsonCI(nominalStats.n_scored, acceptableCount);
    return {
      acceptable_set: ordinalConfig.acceptable_set,
      proportion: acceptableCount / nominalStats.n_scored,
      ci: { lower: ci.lower, upper: ci.upper },
    };
  }

  private calculateTailMassBelow(
    categoryValues: string[],
    nominalStats: { n_scored: number },
    codeToRank: Map<string, number>,
    ordinalConfig?: { threshold_rank?: number } | null,
  ): OrdinalStatisticsResponseDto["tail_mass_below"] {
    if (
      ordinalConfig?.threshold_rank === undefined ||
      nominalStats.n_scored === 0
    )
      return null;
    const thresholdRank = ordinalConfig.threshold_rank;
    const belowThresholdCount = categoryValues.filter(
      (code) => (codeToRank.get(code) ?? Infinity) < thresholdRank,
    ).length;
    const ci = this.wilsonCI(nominalStats.n_scored, belowThresholdCount);
    return {
      threshold_rank: thresholdRank,
      proportion: belowThresholdCount / nominalStats.n_scored,
      ci: { lower: ci.lower, upper: ci.upper },
    };
  }

  calculateStatistics(
    numericValues: number[],
    n_total: number,
  ): Omit<NumericEvaluationStatisticsResponseDto, "scoreId"> &
    Omit<NumericDatasetStatisticsResponseDto, "scoreId"> {
    const n_scored = numericValues.length;

    if (n_scored === 0) {
      return {
        mean: null,
        variance: null,
        std: null,
        p50: null,
        p10: null,
        p90: null,
        ci95_mean: {
          lower: null,
          upper: null,
        },
        n_total,
        n_scored: 0,
      };
    }

    const mean = numericValues.reduce((sum, val) => sum + val, 0) / n_scored;

    const variance =
      n_scored > 1
        ? numericValues.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) /
          (n_scored - 1)
        : 0;

    const std = Math.sqrt(variance);

    const sortedValues = [...numericValues].sort((a, b) => a - b);

    const percentile = (sorted: number[], p: number): number => {
      if (sorted.length === 0) return null as any;
      if (sorted.length === 1) return sorted[0];

      const position = (p / 100) * (sorted.length - 1);
      const lowerIndex = Math.floor(position);
      const upperIndex = Math.ceil(position);

      if (lowerIndex === upperIndex) {
        return sorted[lowerIndex];
      }

      const weight = position - lowerIndex;
      return sorted[lowerIndex] * (1 - weight) + sorted[upperIndex] * weight;
    };

    const p50 = percentile(sortedValues, 50);
    const p10 = percentile(sortedValues, 10);
    const p90 = percentile(sortedValues, 90);

    const tValue = this.getTValue(n_scored);
    const standardError = std / Math.sqrt(n_scored);
    const marginOfError = tValue * standardError;

    return {
      mean,
      variance,
      std,
      p50,
      p10,
      p90,
      ci95_mean: {
        lower: mean - marginOfError,
        upper: mean + marginOfError,
      },
      n_total,
      n_scored,
    };
  }

  calculateNominalStatisticsFromCounts(
    countsByCode: Record<string, number>,
    nTotal: number,
    nScored: number,
  ): Omit<NominalStatisticsResponseDto, "scoreId"> {
    if (nScored === 0) {
      return {
        n_total: nTotal,
        n_scored: 0,
        counts_by_code: {},
        proportions_by_code: {},
        ci_proportion_by_code: {},
        mode_code: null,
        entropy: null,
        num_distinct_categories: 0,
      };
    }

    const proportions_by_code: Record<string, number> = {};
    for (const [code, count] of Object.entries(countsByCode)) {
      proportions_by_code[code] = count / nScored;
    }

    const ci_proportion_by_code: Record<
      string,
      { lower: number; upper: number }
    > = {};
    for (const [code, count] of Object.entries(countsByCode)) {
      ci_proportion_by_code[code] = this.wilsonCI(nScored, count);
    }

    let mode_code: string | null = null;
    let maxCount = 0;
    for (const [code, count] of Object.entries(countsByCode)) {
      if (count > maxCount) {
        maxCount = count;
        mode_code = code;
      }
    }

    const proportions = Object.values(proportions_by_code);
    const entropy = this.calculateEntropy(proportions);

    return {
      n_total: nTotal,
      n_scored: nScored,
      counts_by_code: countsByCode,
      proportions_by_code,
      ci_proportion_by_code,
      mode_code,
      entropy,
      num_distinct_categories: Object.keys(countsByCode).length,
    };
  }

  buildNumericStatisticsFromAggregates(
    mean: number,
    std: number,
    nScored: number,
    nTotal: number,
    p10: number | null,
    p50: number | null,
    p90: number | null,
  ): Omit<NumericDatasetStatisticsResponseDto, "scoreId"> &
    Omit<NumericEvaluationStatisticsResponseDto, "scoreId"> {
    if (nScored === 0) {
      return {
        mean: null,
        variance: null,
        std: null,
        p50: null,
        p10: null,
        p90: null,
        ci95_mean: {
          lower: null,
          upper: null,
        },
        n_total: nTotal,
        n_scored: 0,
      };
    }

    const variance = std * std;

    const tValue = this.getTValue(nScored);
    const standardError = std / Math.sqrt(nScored);
    const marginOfError = tValue * standardError;

    return {
      mean,
      variance,
      std,
      p50,
      p10,
      p90,
      ci95_mean: {
        lower: mean - marginOfError,
        upper: mean + marginOfError,
      },
      n_total: nTotal,
      n_scored: nScored,
    };
  }
}
