import { NominalComparisonUtil } from "../../../src/evaluations/utils/nominal-comparison.util";

describe("NominalComparisonUtil", () => {
  it("returns empty comparison when no pairs exist", () => {
    const result = NominalComparisonUtil.compare([], [], 0);

    expect(result.n_paired).toBe(0);
    expect(result.bowker_test.chi_squared).toBeNull();
    expect(result.category_changes).toBeNull();
  });

  it("calculates distribution deltas and Bowker stats", () => {
    const result = NominalComparisonUtil.compare(["A", "B"], ["A", "A"], 2);

    expect(result.n_paired).toBe(2);
    expect(result.distribution_comparison.A.delta_proportion).toBeCloseTo(
      0.5,
      6,
    );
    expect(result.distribution_comparison.B.delta_proportion).toBeCloseTo(
      -0.5,
      6,
    );
    expect(result.bowker_test.degrees_of_freedom).toBe(1);
    expect(result.cramers_v).not.toBeNull();
    expect(result.category_changes?.disappeared_in_b).toEqual(["B"]);
  });
});
