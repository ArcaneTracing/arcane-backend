export const NUMERIC_VALUES_150: number[] = [
  ...Array(50).fill(1),
  ...Array(50).fill(2),
  ...Array(50).fill(3),
];

const NUMERIC_SAMPLE_VARIANCE = 100 / 149;
const NUMERIC_SAMPLE_STD = Math.sqrt(NUMERIC_SAMPLE_VARIANCE);

export const EXPECTED_NUMERIC_STATS = {
  mean: 2,
  variance: NUMERIC_SAMPLE_VARIANCE,
  std: NUMERIC_SAMPLE_STD,
  n_scored: 150,
  p50: 2,
  p10: 1,
  p90: 3,

  ci95_mean: {
    lower: 2 - 1.96 * (NUMERIC_SAMPLE_STD / Math.sqrt(150)),
    upper: 2 + 1.96 * (NUMERIC_SAMPLE_STD / Math.sqrt(150)),
  },
};
export const NOMINAL_VALUES_150: string[] = [
  ...Array(60).fill("A"),
  ...Array(50).fill("B"),
  ...Array(40).fill("C"),
];

export const EXPECTED_NOMINAL_STATS = {
  counts_by_code: { "1": 60, "2": 50, "3": 40 },
  proportions_by_code: {
    "1": 60 / 150,
    "2": 50 / 150,
    "3": 40 / 150,
  },
  mode_code: "1",
  n_scored: 150,
  num_distinct_categories: 3,
};
export const ORDINAL_SCALE = [
  { label: "Bad", value: 1 },
  { label: "Ok", value: 2 },
  { label: "Good", value: 3 },
  { label: "Great", value: 4 },
];

export const ORDINAL_VALUES_150: string[] = [
  ...Array(30).fill("Bad"),
  ...Array(30).fill("Ok"),
  ...Array(45).fill("Good"),
  ...Array(45).fill("Great"),
];
export const EXPECTED_ORDINAL_STATS = {
  cdf: {
    "1": 30 / 150,
    "2": 60 / 150,
    "3": 105 / 150,
    "4": 1,
  },
  pass_rate: {
    proportion: 90 / 150,
    acceptable_set: ["Good", "Great"],
  },
  n_scored: 150,
  percentile_categories: { p10: "Bad", p50: "Good", p90: "Great" },
  median_category: "Good",
};

export const ORDINAL_CONFIG = {
  acceptable_set: ["Good", "Great"],
};
const PAIRED_NUMERIC_A: number[] = [...Array(75).fill(0), ...Array(75).fill(2)];

export const PAIRED_NUMERIC_VALUES_A_150: number[] = PAIRED_NUMERIC_A;
export const PAIRED_NUMERIC_VALUES_B_150: number[] = PAIRED_NUMERIC_A.map(
  (v) => v + 0.1,
);

export const EXPECTED_NUMERIC_COMPARISON = {
  n_paired: 150,
  mean_a: 1,
  mean_b: 1.1,
  delta_mean: 0.1,
  win_rate: 1,
  loss_rate: 0,
  tie_rate: 0,
};
export const PAIRED_NOMINAL_VALUES_A_150: string[] = [
  ...Array(60).fill("A"),
  ...Array(50).fill("B"),
  ...Array(40).fill("C"),
];

export const PAIRED_NOMINAL_VALUES_B_150: string[] = [
  ...Array(55).fill("A"),
  ...Array(50).fill("B"),
  ...Array(45).fill("C"),
];
export const EXPECTED_NOMINAL_COMPARISON = {
  n_paired: 150,
  proportion_a_by_code: {
    "1": 60 / 150,
    "2": 50 / 150,
    "3": 40 / 150,
  },
  proportion_b_by_code: {
    "1": 55 / 150,
    "2": 50 / 150,
    "3": 45 / 150,
  },
};
export const PAIRED_ORDINAL_VALUES_A_150: string[] = [
  ...Array(30).fill("Bad"),
  ...Array(30).fill("Ok"),
  ...Array(45).fill("Good"),
  ...Array(45).fill("Great"),
];

export const PAIRED_ORDINAL_VALUES_B_150: string[] = [
  ...Array(25).fill("Bad"),
  ...Array(35).fill("Ok"),
  ...Array(45).fill("Good"),
  ...Array(45).fill("Great"),
];
export const EXPECTED_ORDINAL_COMPARISON = {
  n_paired: 150,
  pass_rate_a: 90 / 150,
  pass_rate_b: 90 / 150,
  cdf_a: {
    Bad: 30 / 150,
    Ok: 60 / 150,
    Good: 105 / 150,
    Great: 1,
  },
  cdf_b: {
    Bad: 25 / 150,
    Ok: 60 / 150,
    Good: 105 / 150,
    Great: 1,
  },
};
