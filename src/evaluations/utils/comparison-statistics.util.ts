import * as crypto from "node:crypto";

const jstat = require("jstat") as {
  chisquare: { cdf: (x: number, df: number) => number };
  studentt: { inv: (p: number, df: number) => number };
};
const wilcoxonTest = require("@stdlib/stats-wilcoxon") as (
  x: number[],
  y?: number[],
  opts?: { alternative?: string },
) => { statistic: number; pValue: number };

export interface ChangeTableRow {
  val_a: string | number;
  val_b: string | number;
  n: number;
}

export class ComparisonStatisticsUtil {
  private static secureRandom(): number {
    const bytes = crypto.randomBytes(4);
    const randomInt = bytes.readUInt32BE(0);

    return randomInt / 0x100000000;
  }
  static calculateEntropy(proportions: number[]): number {
    return proportions.reduce((entropy, p) => {
      if (p > 0) {
        return entropy - p * Math.log2(p);
      }
      return entropy;
    }, 0);
  }

  static normalCDF(z: number): number {
    return 0.5 * (1 + ComparisonStatisticsUtil.erf(z / Math.sqrt(2)));
  }

  static erf(x: number): number {
    const a1 = 0.254829592;
    const a2 = -0.284496736;
    const a3 = 1.421413741;
    const a4 = -1.453152027;
    const a5 = 1.061405429;
    const p = 0.3275911;

    const sign = x < 0 ? -1 : 1;
    x = Math.abs(x);

    const t = 1 / (1 + p * x);
    const y =
      1 - ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);

    return sign * y;
  }

  static bootstrapDeltaProportionCI(
    valuesA: string[],
    valuesB: string[],
    n_paired: number,
    category: string,
    samples: number = 10000,
  ): { lower: number; upper: number } {
    const bootstrapDeltas: number[] = [];
    for (let i = 0; i < samples; i++) {
      let countA = 0;
      let countB = 0;
      for (let j = 0; j < n_paired; j++) {
        const idxA = Math.floor(
          ComparisonStatisticsUtil.secureRandom() * valuesA.length,
        );
        const idxB = Math.floor(
          ComparisonStatisticsUtil.secureRandom() * valuesB.length,
        );
        if (valuesA[idxA] === category) countA++;
        if (valuesB[idxB] === category) countB++;
      }
      bootstrapDeltas.push(countB / n_paired - countA / n_paired);
    }
    bootstrapDeltas.sort((a, b) => a - b);
    return {
      lower: bootstrapDeltas[Math.floor(samples * 0.025)],
      upper: bootstrapDeltas[Math.floor(samples * 0.975)],
    };
  }

  static bootstrapMeanCI(
    deltas: number[],
    samples: number = 10000,
  ): { lower: number | null; upper: number | null } {
    const n_paired = deltas.length;
    if (n_paired === 0) {
      return { lower: null, upper: null };
    }

    const bootstrapDeltas: number[] = [];
    for (let i = 0; i < samples; i++) {
      const resampled = [];
      for (let j = 0; j < n_paired; j++) {
        const randomIndex = Math.floor(
          ComparisonStatisticsUtil.secureRandom() * n_paired,
        );
        resampled.push(deltas[randomIndex]);
      }
      const resampledMean =
        resampled.reduce((sum, val) => sum + val, 0) / n_paired;
      bootstrapDeltas.push(resampledMean);
    }

    bootstrapDeltas.sort((a, b) => a - b);
    return {
      lower: bootstrapDeltas[Math.floor(samples * 0.025)],
      upper: bootstrapDeltas[Math.floor(samples * 0.975)],
    };
  }

  static permutationPValue(
    pairedData: Array<{ valueA: number; valueB: number }>,
    observedDelta: number,
    samples: number = 10000,
  ): number | null {
    const n_paired = pairedData.length;
    if (n_paired === 0) {
      return null;
    }

    let extremeCount = 0;
    for (let i = 0; i < samples; i++) {
      const permutedDeltas = pairedData.map((pair) => {
        const shouldSwap = ComparisonStatisticsUtil.secureRandom() < 0.5;
        return shouldSwap
          ? pair.valueA - pair.valueB
          : pair.valueB - pair.valueA;
      });
      const permutedMean =
        permutedDeltas.reduce((sum, val) => sum + val, 0) / n_paired;
      if (Math.abs(permutedMean) >= observedDelta) {
        extremeCount++;
      }
    }

    return extremeCount / samples;
  }

  static bootstrapDeltaRateCI(
    valuesA: string[],
    valuesB: string[],
    n_paired: number,
    isAcceptable: (code: string) => boolean,
    samples: number = 1000,
  ): { lower: number | null; upper: number | null } {
    if (n_paired === 0) {
      return { lower: null, upper: null };
    }

    const deltas: number[] = [];
    for (let i = 0; i < samples; i++) {
      const sampleA: string[] = [];
      const sampleB: string[] = [];
      for (let j = 0; j < n_paired; j++) {
        const idx = Math.floor(
          ComparisonStatisticsUtil.secureRandom() * n_paired,
        );
        sampleA.push(valuesA[idx]);
        sampleB.push(valuesB[idx]);
      }
      let countA = 0;
      let countB = 0;
      for (const code of sampleA) {
        if (isAcceptable(code)) countA++;
      }
      for (const code of sampleB) {
        if (isAcceptable(code)) countB++;
      }
      deltas.push(countB / n_paired - countA / n_paired);
    }
    deltas.sort((a, b) => a - b);
    return {
      lower: deltas[Math.floor(deltas.length * 0.025)] ?? null,
      upper: deltas[Math.floor(deltas.length * 0.975)] ?? null,
    };
  }

  static bowkerTest(changeTable: ChangeTableRow[]): {
    chiSquared: number;
    degreesOfFreedom: number;
    pValue: number | null;
  } {
    const O = new Map<string | number, Map<string | number, number>>();
    for (const row of changeTable) {
      let inner = O.get(row.val_a);
      if (!inner) {
        inner = new Map();
        O.set(row.val_a, inner);
      }
      inner.set(row.val_b, row.n);
    }
    const allCats = new Set<string | number>();
    for (const [k, m] of O) {
      allCats.add(k);
      for (const k2 of m.keys()) allCats.add(k2);
    }
    const categories = Array.from(allCats).sort((a, b) =>
      typeof a === "number" && typeof b === "number"
        ? a - b
        : String(a).localeCompare(String(b)),
    );

    let chiSquared = 0;
    for (let i = 0; i < categories.length; i++) {
      for (let j = i + 1; j < categories.length; j++) {
        const catI = categories[i];
        const catJ = categories[j];
        const O_ij = O.get(catI)?.get(catJ) ?? 0;
        const O_ji = O.get(catJ)?.get(catI) ?? 0;
        const denom = O_ij + O_ji;
        if (denom > 0) chiSquared += Math.pow(O_ij - O_ji, 2) / denom;
      }
    }
    const c = categories.length;
    const df = c > 1 ? (c * (c - 1)) / 2 : 0;
    const pValue =
      df > 0 && chiSquared > 0 ? 1 - jstat.chisquare.cdf(chiSquared, df) : null;
    return { chiSquared, degreesOfFreedom: df, pValue };
  }
  static tBasedCI(
    meanDelta: number,
    stdDelta: number,
    n: number,
  ): { lower: number | null; upper: number | null } {
    if (n <= 0 || stdDelta <= 0) return { lower: null, upper: null };
    const df = n - 1;
    const t = jstat.studentt.inv(0.975, df);
    const se = stdDelta / Math.sqrt(n);
    const margin = t * se;
    return { lower: meanDelta - margin, upper: meanDelta + margin };
  }

  static newcombePairedCI(
    a: number,
    b: number,
    c: number,
    d: number,
  ): { lower: number; upper: number } {
    const n = a + b + c + d;
    if (n === 0) return { lower: 0, upper: 0 };
    const p1 = (a + b) / n;
    const p2 = (a + c) / n;
    const delta = p2 - p1;
    const z = 1.96;
    const bc = b + c;
    const denom = bc - Math.pow(c - b, 2) / n;
    const se = denom > 0 ? Math.sqrt(denom) / n : 0;
    const margin = z * se;
    return { lower: delta - margin, upper: delta + margin };
  }

  static wilcoxonSignedRank(pairedDifferences: number[]): {
    wStatistic: number | null;
    pValue: number | null;
  } {
    if (pairedDifferences.length === 0)
      return { wStatistic: null, pValue: null };
    try {
      const nonZero = pairedDifferences.filter((d) => d !== 0);
      if (nonZero.length === 0) return { wStatistic: 0, pValue: 1 };
      const out = wilcoxonTest(pairedDifferences);
      return { wStatistic: out.statistic, pValue: out.pValue };
    } catch {
      return { wStatistic: null, pValue: null };
    }
  }
}
