import { OrdinalComparisonUtil } from "../../../src/evaluations/utils/ordinal-comparison.util";
import { ComparisonStatisticsUtil } from "../../../src/evaluations/utils/comparison-statistics.util";

describe("OrdinalComparisonUtil", () => {
  const scale = [
    { label: "Bad", value: 1 },
    { label: "Ok", value: 2 },
    { label: "Good", value: 3 },
  ];

  it("returns nominal comparison with null ordinal fields for empty input", () => {
    const result = OrdinalComparisonUtil.compare([], [], 0, null, null);

    expect(result.n_paired).toBe(0);
    expect(result.cdf_comparison).toEqual({});
    expect(result.median_comparison.median_a).toBeNull();
    expect(result.wilcoxon_signed_rank.w_statistic).toBeNull();
  });

  it("calculates ordinal comparison stats with scale", () => {
    jest
      .spyOn(ComparisonStatisticsUtil, "bootstrapDeltaRateCI")
      .mockReturnValue({
        lower: -0.1,
        upper: 0.1,
      });
    jest
      .spyOn(ComparisonStatisticsUtil, "bootstrapDeltaProportionCI")
      .mockReturnValue({
        lower: -0.1,
        upper: 0.1,
      });

    const result = OrdinalComparisonUtil.compare(
      ["Bad", "Ok"],
      ["Ok", "Good"],
      2,
      scale,
      { acceptable_set: ["Ok", "Good"], threshold_rank: 2 },
    );

    expect(result.median_comparison.median_a).toBe("Bad");
    expect(result.median_comparison.median_b).toBe("Ok");
    expect(result.percentile_shift.p50.category_a).toBe("Bad");
    expect(result.percentile_shift.p50.category_b).toBe("Ok");
    expect(result.cdf_comparison.Ok.delta_cdf).toBeCloseTo(-0.5, 6);
    expect(result.delta_pass_rate).not.toBeNull();
    expect(result.delta_tail_mass).not.toBeNull();
    expect(result.cliffs_delta).not.toBeNull();
    expect(result.probability_of_superiority).not.toBeNull();

    (ComparisonStatisticsUtil.bootstrapDeltaRateCI as jest.Mock).mockRestore();
    (
      ComparisonStatisticsUtil.bootstrapDeltaProportionCI as jest.Mock
    ).mockRestore();
  });
});
