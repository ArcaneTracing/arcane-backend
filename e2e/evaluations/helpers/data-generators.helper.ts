import { ScaleOption } from "../../../src/scores/entities/score.entity";

const log = (msg: string) => console.log(`[E2E] ${msg}`);
class SeededRandom {
  private seed: number;

  constructor(seed: number) {
    this.seed = seed;
  }

  next(): number {
    this.seed = (this.seed * 1664525 + 1013904223) % 2 ** 32;
    return this.seed / 2 ** 32;
  }

  nextInt(min: number, max: number): number {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }
}
function calculateDistribution(values: string[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const value of values) {
    counts[value] = (counts[value] || 0) + 1;
  }
  const total = values.length;
  const distribution: Record<string, number> = {};
  for (const [key, count] of Object.entries(counts)) {
    distribution[key] = count / total;
  }
  return distribution;
}
function calculateMean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, val) => sum + val, 0) / values.length;
}
function calculateStdDev(values: number[]): number {
  if (values.length === 0) return 0;
  const mean = calculateMean(values);
  const variance =
    values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) /
    values.length;
  return Math.sqrt(variance);
}

export function generateNominalValues(
  size: number,
  distribution: Record<string, number>,
  seed?: number,
): string[] {
  if (size > 1000) log(`  Generating ${size} nominal values...`);
  const rng = new SeededRandom(seed ?? Date.now());

  const total = Object.values(distribution).reduce((sum, val) => sum + val, 0);
  const normalized: Record<string, number> = {};
  for (const [key, value] of Object.entries(distribution)) {
    normalized[key] = value / total;
  }

  const codes: string[] = [];
  const cumulative: Array<{ code: string; threshold: number }> = [];
  let cumSum = 0;
  for (const [code, proportion] of Object.entries(normalized)) {
    cumSum += proportion;
    cumulative.push({ code, threshold: cumSum });
  }

  const result: string[] = [];
  for (let i = 0; i < size; i++) {
    const rand = rng.next();

    for (const { code, threshold } of cumulative) {
      if (rand <= threshold) {
        result.push(code);
        break;
      }
    }
  }

  return result;
}

export function generateNumericValues(
  size: number,
  mean: number,
  stdDev: number,
  seed?: number,
): number[] {
  if (size > 1000) log(`  Generating ${size} numeric values...`);
  const rng = new SeededRandom(seed ?? Date.now());
  const result: number[] = [];
  let spare: number | null = null;
  let hasSpare = false;

  for (let i = 0; i < size; i++) {
    if (hasSpare) {
      hasSpare = false;
      result.push(spare! * stdDev + mean);
      spare = null;
    } else {
      const u1 = rng.next();
      const u2 = rng.next();
      const mag = stdDev * Math.sqrt(-2.0 * Math.log(u1));
      const z0 = mag * Math.cos(2.0 * Math.PI * u2);
      const z1 = mag * Math.sin(2.0 * Math.PI * u2);
      result.push(z0 + mean);
      spare = z1;
      hasSpare = true;
    }
  }

  return result;
}

export function generateOrdinalValues(
  size: number,
  scale: ScaleOption[],
  distribution: number[],
  seed?: number,
): string[] {
  if (scale.length !== distribution.length) {
    throw new Error("Scale and distribution arrays must have the same length");
  }

  if (size > 1000) log(`  Generating ${size} ordinal values...`);
  const rng = new SeededRandom(seed ?? Date.now());

  const total = distribution.reduce((sum, val) => sum + val, 0);
  const normalized = distribution.map((val) => val / total);

  const cumulative: Array<{ label: string; threshold: number }> = [];
  let cumSum = 0;
  for (let i = 0; i < scale.length; i++) {
    cumSum += normalized[i];
    cumulative.push({ label: scale[i].label, threshold: cumSum });
  }

  const result: string[] = [];
  for (let i = 0; i < size; i++) {
    const rand = rng.next();

    for (const { label, threshold } of cumulative) {
      if (rand <= threshold) {
        result.push(label);
        break;
      }
    }
  }

  return result;
}

export function nominalCodesToNumbers(
  codes: string[],
  distribution: Record<string, number>,
): number[] {
  const codeToNumber = new Map<string, number>();
  let n = 1;
  for (const code of Object.keys(distribution)) {
    codeToNumber.set(code, n++);
  }
  return codes.map((c) => codeToNumber.get(c) ?? 0);
}
export function ordinalLabelsToScaleValues(
  labels: string[],
  scale: ScaleOption[],
): number[] {
  const labelToValue = new Map<string, number>();
  for (const opt of scale) {
    labelToValue.set(opt.label, opt.value);
  }
  return labels.map((l) => labelToValue.get(l) ?? 0);
}
export const distributionHelpers = {
  calculateDistribution,
  calculateMean,
  calculateStdDev,
};
