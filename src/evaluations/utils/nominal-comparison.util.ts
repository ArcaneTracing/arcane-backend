import { NominalComparisonResponseDto } from "../dto/response/nominal-comparison-response.dto";
import {
  ComparisonStatisticsUtil,
  ChangeTableRow,
} from "./comparison-statistics.util";

export class NominalComparisonUtil {
  static compare(
    valuesA: string[],
    valuesB: string[],
    n_paired: number,
  ): NominalComparisonResponseDto {
    if (n_paired === 0) return this.emptyComparisonResult();

    const changeTable = this.buildChangeTableFromPairs(valuesA, valuesB);
    return this.compareFromChangeTable(changeTable, n_paired);
  }
  static compareFromChangeTable(
    changeTable: ChangeTableRow[],
    n_paired: number,
  ): NominalComparisonResponseDto {
    if (n_paired === 0 || changeTable.length === 0)
      return this.emptyComparisonResult();

    const O = this.buildOMap(changeTable);
    const categories = this.getCategoriesFromChangeTable(changeTable);
    const categoriesAsStrings = categories.map(String);
    const { countsA, countsB } = this.buildCountsFromChangeTable(
      changeTable,
      categories,
    );
    const { proportionsA, proportionsB } = this.buildProportions(
      countsA,
      countsB,
      categoriesAsStrings,
      n_paired,
    );
    const distribution_comparison =
      this.buildDistributionComparisonFromChangeTable(
        countsA,
        countsB,
        n_paired,
        categories,
        O,
      );
    const bowker = ComparisonStatisticsUtil.bowkerTest(changeTable);
    const cramers_v = this.calculateCramersV(
      bowker.chiSquared,
      bowker.degreesOfFreedom,
      n_paired,
    );
    const entropy_difference =
      ComparisonStatisticsUtil.calculateEntropy(Object.values(proportionsB)) -
      ComparisonStatisticsUtil.calculateEntropy(Object.values(proportionsA));
    const category_changes = {
      appeared_in_b: categoriesAsStrings.filter(
        (c) => countsA[c] === 0 && countsB[c] > 0,
      ),
      disappeared_in_b: categoriesAsStrings.filter(
        (c) => countsA[c] > 0 && countsB[c] === 0,
      ),
    };

    return {
      n_paired,
      distribution_comparison,
      bowker_test: {
        chi_squared: bowker.chiSquared > 0 ? bowker.chiSquared : null,
        p_value: bowker.pValue,
        degrees_of_freedom:
          bowker.degreesOfFreedom > 0 ? bowker.degreesOfFreedom : null,
      },
      cramers_v,
      entropy_difference,
      category_changes,
    };
  }

  private static emptyComparisonResult(): NominalComparisonResponseDto {
    return {
      n_paired: 0,
      distribution_comparison: {},
      bowker_test: {
        chi_squared: null,
        p_value: null,
        degrees_of_freedom: null,
      },
      cramers_v: null,
      entropy_difference: null,
      category_changes: null,
    };
  }

  private static buildChangeTableFromPairs(
    valuesA: string[],
    valuesB: string[],
  ): ChangeTableRow[] {
    const count = new Map<string, number>();
    for (let i = 0; i < valuesA.length; i++) {
      const key = `${valuesA[i]}\t${valuesB[i]}`;
      count.set(key, (count.get(key) ?? 0) + 1);
    }
    return Array.from(count.entries()).map(([key, n]) => {
      const [val_a, val_b] = key.split("\t");
      return { val_a, val_b, n };
    });
  }

  private static buildOMap(
    changeTable: ChangeTableRow[],
  ): Map<string | number, Map<string | number, number>> {
    const O = new Map<string | number, Map<string | number, number>>();
    for (const row of changeTable) {
      let inner = O.get(row.val_a);
      if (!inner) {
        inner = new Map();
        O.set(row.val_a, inner);
      }
      inner.set(row.val_b, row.n);
    }
    return O;
  }

  private static getCategoriesFromChangeTable(
    changeTable: ChangeTableRow[],
  ): (string | number)[] {
    const set = new Set<string | number>();
    for (const r of changeTable) {
      set.add(r.val_a);
      set.add(r.val_b);
    }
    return Array.from(set).sort((a, b) =>
      typeof a === "number" && typeof b === "number"
        ? a - b
        : String(a).localeCompare(String(b)),
    );
  }

  private static buildCountsFromChangeTable(
    changeTable: ChangeTableRow[],
    categories: (string | number)[],
  ): { countsA: Record<string, number>; countsB: Record<string, number> } {
    const countsA: Record<string, number> = {};
    const countsB: Record<string, number> = {};
    for (const c of categories) {
      countsA[String(c)] = 0;
      countsB[String(c)] = 0;
    }
    for (const r of changeTable) {
      const ka = String(r.val_a);
      const kb = String(r.val_b);
      countsA[ka] = (countsA[ka] ?? 0) + r.n;
      countsB[kb] = (countsB[kb] ?? 0) + r.n;
    }
    return { countsA, countsB };
  }

  private static buildProportions(
    countsA: Record<string, number>,
    countsB: Record<string, number>,
    categories: string[],
    n_paired: number,
  ): {
    proportionsA: Record<string, number>;
    proportionsB: Record<string, number>;
  } {
    const proportionsA: Record<string, number> = {};
    const proportionsB: Record<string, number> = {};
    for (const cat of categories) {
      proportionsA[cat] = countsA[cat] / n_paired;
      proportionsB[cat] = countsB[cat] / n_paired;
    }
    return { proportionsA, proportionsB };
  }

  private static buildDistributionComparisonFromChangeTable(
    countsA: Record<string, number>,
    countsB: Record<string, number>,
    n_paired: number,
    categories: (string | number)[],
    O: Map<string | number, Map<string | number, number>>,
  ): Record<
    string,
    {
      proportion_a: number;
      proportion_b: number;
      delta_proportion: number;
      ci_delta: { lower: number; upper: number };
    }
  > {
    const result: Record<
      string,
      {
        proportion_a: number;
        proportion_b: number;
        delta_proportion: number;
        ci_delta: { lower: number; upper: number };
      }
    > = {};
    for (const cat of categories) {
      const { a, b, c, d } = this.computeContingencyCells(O, cat);
      const proportion_a = countsA[cat] / n_paired;
      const proportion_b = countsB[cat] / n_paired;
      const ci = ComparisonStatisticsUtil.newcombePairedCI(a, b, c, d);
      result[String(cat)] = {
        proportion_a,
        proportion_b,
        delta_proportion: proportion_b - proportion_a,
        ci_delta: ci,
      };
    }
    return result;
  }

  private static computeContingencyCells(
    O: Map<string | number, Map<string | number, number>>,
    cat: string | number,
  ): { a: number; b: number; c: number; d: number } {
    const cells = { a: 0, b: 0, c: 0, d: 0 };
    for (const [va, inner] of O) {
      for (const [vb, n] of inner) {
        const key = this.getContingencyCellKey(va === cat, vb === cat);
        cells[key] += n;
      }
    }
    return cells;
  }

  private static getContingencyCellKey(
    inA: boolean,
    inB: boolean,
  ): "a" | "b" | "c" | "d" {
    if (inA && inB) return "a";
    if (inA) return "b";
    if (inB) return "c";
    return "d";
  }

  private static calculateCramersV(
    chi_squared: number,
    degrees_of_freedom: number,
    n_paired: number,
  ): number | null {
    return n_paired > 0 && degrees_of_freedom > 0
      ? Math.sqrt(chi_squared / (n_paired * degrees_of_freedom))
      : null;
  }
}
