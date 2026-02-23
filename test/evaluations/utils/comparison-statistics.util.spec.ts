import { ComparisonStatisticsUtil } from "../../../src/evaluations/utils/comparison-statistics.util";

describe("ComparisonStatisticsUtil", () => {
  it("calculateEntropy returns 0 for a degenerate distribution", () => {
    const entropy = ComparisonStatisticsUtil.calculateEntropy([1, 0]);

    expect(entropy).toBe(0);
  });

  it("calculateEntropy returns 1 for a two-class uniform distribution", () => {
    const entropy = ComparisonStatisticsUtil.calculateEntropy([0.5, 0.5]);

    expect(entropy).toBe(1);
  });

  it("normalCDF is symmetric around 0", () => {
    const z = 1;
    const left = ComparisonStatisticsUtil.normalCDF(-z);
    const right = ComparisonStatisticsUtil.normalCDF(z);

    expect(left + right).toBeCloseTo(1, 6);
  });

  it("normalCDF(0) returns 0.5", () => {
    expect(ComparisonStatisticsUtil.normalCDF(0)).toBeCloseTo(0.5, 6);
  });

  it("bootstrapDeltaProportionCI returns zero interval when bootstrap samples are identical", () => {
    const crypto = require("node:crypto");

    jest
      .spyOn(crypto, "randomBytes")
      .mockReturnValue(Buffer.from([0, 0, 0, 0]));

    const ci = ComparisonStatisticsUtil.bootstrapDeltaProportionCI(
      ["A", "B"],
      ["A", "A"],
      2,
      "A",
      10,
    );

    expect(ci).toEqual({ lower: 0, upper: 0 });
    jest.restoreAllMocks();
  });

  it("bootstrapMeanCI collapses when all values are identical", () => {
    const ci = ComparisonStatisticsUtil.bootstrapMeanCI([1, 1, 1], 10);

    expect(ci).toEqual({ lower: 1, upper: 1 });
  });

  it("bootstrapMeanCI returns null bounds for empty input", () => {
    const ci = ComparisonStatisticsUtil.bootstrapMeanCI([], 10);

    expect(ci).toEqual({ lower: null, upper: null });
  });

  it("permutationPValue returns null for empty input", () => {
    const pValue = ComparisonStatisticsUtil.permutationPValue([], 0.1, 10);

    expect(pValue).toBeNull();
  });

  it("bootstrapDeltaRateCI returns null bounds for empty input", () => {
    const ci = ComparisonStatisticsUtil.bootstrapDeltaRateCI(
      [],
      [],
      0,
      () => true,
      10,
    );

    expect(ci).toEqual({ lower: null, upper: null });
  });
});
