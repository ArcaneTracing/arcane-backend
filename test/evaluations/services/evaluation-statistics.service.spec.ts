import { EvaluationStatisticsService } from "../../../src/evaluations/services/statistics/evaluation-statistics.service";

describe("EvaluationStatisticsService", () => {
  let service: EvaluationStatisticsService;

  beforeEach(() => {
    service = new EvaluationStatisticsService();
  });

  it("calculateNominalStatistics returns empty stats when no values", () => {
    const result = service.calculateNominalStatistics([], 10);

    expect(result.n_total).toBe(10);
    expect(result.n_scored).toBe(0);
    expect(result.mode_code).toBeNull();
    expect(result.entropy).toBeNull();
    expect(result.counts_by_code).toEqual({});
  });

  it("calculateNominalStatistics computes counts, proportions, and entropy", () => {
    const result = service.calculateNominalStatistics(["A", "B", "A", "C"], 4);

    expect(result.counts_by_code).toEqual({ A: 2, B: 1, C: 1 });
    expect(result.proportions_by_code.A).toBeCloseTo(0.5, 6);
    expect(result.mode_code).toBe("A");
    expect(result.entropy).toBeCloseTo(1.5, 6);
  });

  it("calculateOrdinalStatistics computes median, percentiles, and IQR", () => {
    const scale = [
      { label: "Bad", value: 1 },
      { label: "Ok", value: 2 },
      { label: "Good", value: 3 },
    ];

    const result = service.calculateOrdinalStatistics(
      ["Bad", "Good", "Ok", "Ok"],
      4,
      scale,
    );

    expect(result.median_category).toBe("Ok");
    expect(result.percentile_categories.p10).toBe("Bad");
    expect(result.percentile_categories.p50).toBe("Ok");
    expect(result.percentile_categories.p90).toBe("Good");
    expect(result.iqr_rank).toBe(1);
    expect(result.cdf.Ok).toBeCloseTo(0.75, 6);
  });

  it("calculateOrdinalStatistics computes pass rate and tail mass", () => {
    const scale = [
      { label: "Bad", value: 1 },
      { label: "Ok", value: 2 },
      { label: "Good", value: 3 },
    ];

    const result = service.calculateOrdinalStatistics(
      ["Bad", "Ok", "Good", "Good"],
      4,
      scale,
      { acceptable_set: ["Ok", "Good"], threshold_rank: 2 },
    );

    expect(result.pass_rate?.proportion).toBeCloseTo(0.75, 6);
    expect(result.tail_mass_below?.proportion).toBeCloseTo(0.25, 6);
    expect(result.pass_rate?.ci.lower).toBeGreaterThanOrEqual(0);
    expect(result.pass_rate?.ci.upper).toBeLessThanOrEqual(1);
  });

  it("calculateStatistics returns null stats when no values", () => {
    const result = service.calculateStatistics([], 5);

    expect(result.mean).toBeNull();
    expect(result.n_scored).toBe(0);
  });

  it("calculateStatistics computes mean, variance, percentiles, and CI", () => {
    const result = service.calculateStatistics([1, 2, 3, 4], 4);

    expect(result.mean).toBeCloseTo(2.5, 6);
    expect(result.variance).toBeCloseTo(1.6666667, 6);
    expect(result.std).toBeCloseTo(1.2909944, 6);
    expect(result.p50).toBeCloseTo(2.5, 6);
    expect(result.p10).toBeCloseTo(1.3, 6);
    expect(result.p90).toBeCloseTo(3.7, 6);
    expect(result.ci95_mean.lower).toBeCloseTo(0.447, 2);
    expect(result.ci95_mean.upper).toBeCloseTo(4.553, 2);
  });
});
