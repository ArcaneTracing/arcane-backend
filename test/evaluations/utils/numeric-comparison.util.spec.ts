import { NumericComparisonUtil } from "../../../src/evaluations/utils/numeric-comparison.util";
import { ComparisonStatisticsUtil } from "../../../src/evaluations/utils/comparison-statistics.util";

describe("NumericComparisonUtil", () => {
  it("returns empty numeric comparison for no paired data", () => {
    const result = NumericComparisonUtil.compare([]);

    expect(result.numeric?.n_paired).toBe(0);
    expect(result.numeric?.mean_a).toBeNull();
    expect(result.numeric?.p_value_permutation).toBeNull();
  });

  it("calculates win/loss/tie rates and cohens_dz for paired data", () => {
    jest
      .spyOn(ComparisonStatisticsUtil, "permutationPValue")
      .mockReturnValue(0.5);

    const result = NumericComparisonUtil.compare([
      { valueA: 1, valueB: 2 },
      { valueA: 2, valueB: 1 },
      { valueA: 3, valueB: 3 },
    ]);

    expect(result.numeric?.n_paired).toBe(3);
    expect(result.numeric?.mean_a).toBe(2);
    expect(result.numeric?.mean_b).toBe(2);
    expect(result.numeric?.delta_mean).toBe(0);
    expect(result.numeric?.win_rate).toBeCloseTo(1 / 3, 6);
    expect(result.numeric?.loss_rate).toBeCloseTo(1 / 3, 6);
    expect(result.numeric?.tie_rate).toBeCloseTo(1 / 3, 6);
    expect(result.numeric?.cohens_dz).toBe(0);
    expect(result.numeric?.ci95_delta).toEqual(
      expect.objectContaining({
        lower: expect.any(Number),
        upper: expect.any(Number),
      }),
    );
    expect(result.numeric?.ci95_delta?.lower).toBeLessThanOrEqual(0);
    expect(result.numeric?.ci95_delta?.upper).toBeGreaterThanOrEqual(0);
    expect(result.numeric?.p_value_permutation).toBe(0.5);

    (ComparisonStatisticsUtil.permutationPValue as jest.Mock).mockRestore();
  });
});
