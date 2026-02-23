import { ExperimentComparisonService } from "../../../src/evaluations/services/comparison/experiment-comparison.service";
import { ScoringType } from "../../../src/scores/entities/score.entity";
import {
  ERROR_MESSAGES,
  formatError,
} from "../../../src/common/constants/error-messages.constants";
import { NumericComparisonUtil } from "../../../src/evaluations/utils/numeric-comparison.util";
import { NominalComparisonUtil } from "../../../src/evaluations/utils/nominal-comparison.util";
import { OrdinalComparisonUtil } from "../../../src/evaluations/utils/ordinal-comparison.util";

async function* asyncGen<T>(items: T[]): AsyncGenerator<T[]> {
  if (items.length > 0) {
    yield items;
  }
}

describe("ExperimentComparisonService", () => {
  const mockDataBuilder = {
    buildExperimentResultMaps: jest.fn(),
    findCommonDatasetRowIds: jest.fn(),
    getPairedNumericAggregates: jest.fn(),
    getPairedChangeTable: jest.fn(),
    getScoreResults: jest.fn(),
    extractScoreValuesAsNumbers: jest.fn(),
    extractScoreValuesAsStrings: jest.fn(),
    buildPairedDataForNumbers: jest.fn(),
    buildPairedDataForStrings: jest.fn(),
  };

  const mockStreamingService = {
    streamPairedRows: jest.fn(),
  };

  let service: ExperimentComparisonService;

  const evaluation = {
    id: "eval-1",
    experiments: [{ id: "exp-a" }, { id: "exp-b" }],
    scores: [{ id: "score-1", scoringType: ScoringType.NUMERIC }],
  } as any;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ExperimentComparisonService(
      mockDataBuilder as any,
      mockStreamingService as any,
    );
  });

  it("rejects comparisons for experiments not in evaluation", async () => {
    await expect(
      service.compareExperiments(evaluation, {
        evaluationId: "eval-1",
        scoreId: "score-1",
        experimentIdA: "exp-a",
        experimentIdB: "exp-x",
      } as any),
    ).rejects.toThrow(
      formatError(ERROR_MESSAGES.BOTH_EXPERIMENTS_MUST_BELONG_TO_EVALUATION),
    );
  });

  it("returns empty numeric comparison when no paired data", async () => {
    mockDataBuilder.getPairedNumericAggregates.mockResolvedValue(null);

    const result = await service.compareExperiments(evaluation, {
      evaluationId: "eval-1",
      scoreId: "score-1",
      experimentIdA: "exp-a",
      experimentIdB: "exp-b",
    } as any);

    expect(result.numeric?.n_paired).toBe(0);
  });

  it("compares numeric experiments with paired data", async () => {
    jest.spyOn(NumericComparisonUtil, "compareFromAggregates").mockReturnValue({
      numeric: { n_paired: 1 } as any,
      nominal: null,
      ordinal: null,
    });
    mockDataBuilder.getPairedNumericAggregates.mockResolvedValue({
      n_paired: 1,
      mean_a: 1,
      mean_b: 2,
      delta_mean: 1,
      std_delta: 0,
      win_rate: 1,
      loss_rate: 0,
      tie_rate: 0,
    });

    const result = await service.compareExperiments(evaluation, {
      evaluationId: "eval-1",
      scoreId: "score-1",
      experimentIdA: "exp-a",
      experimentIdB: "exp-b",
    } as any);

    expect(result.numeric?.n_paired).toBe(1);
    (NumericComparisonUtil.compareFromAggregates as jest.Mock).mockRestore();
  });

  it("rejects nominal comparison when scoring type mismatches", async () => {
    await expect(
      service.compareNominalExperiments(evaluation, {
        evaluationId: "eval-1",
        scoreId: "score-1",
        experimentIdA: "exp-a",
        experimentIdB: "exp-b",
      } as any),
    ).rejects.toThrow(
      formatError(ERROR_MESSAGES.SCORE_MUST_BE_OF_TYPE, "NOMINAL"),
    );
  });

  it("compares nominal experiments with paired data", async () => {
    const nominalEvaluation = {
      ...evaluation,
      scores: [{ id: "score-2", scoringType: ScoringType.NOMINAL }],
    };
    jest
      .spyOn(NominalComparisonUtil, "compareFromChangeTable")
      .mockReturnValue({
        n_paired: 1,
        distribution_comparison: {},
        bowker_test: {
          chi_squared: null,
          p_value: null,
          degrees_of_freedom: null,
        },
        cramers_v: null,
        entropy_difference: null,
        category_changes: null,
      });
    mockDataBuilder.getPairedChangeTable.mockResolvedValue([
      { val_a: 1, val_b: 2, n: 1 },
    ]);

    const result = await service.compareNominalExperiments(
      nominalEvaluation as any,
      {
        evaluationId: "eval-1",
        scoreId: "score-2",
        experimentIdA: "exp-a",
        experimentIdB: "exp-b",
      } as any,
    );

    expect(result.nominal?.n_paired).toBe(1);
    (NominalComparisonUtil.compareFromChangeTable as jest.Mock).mockRestore();
  });

  it("rejects ordinal comparison when scoring type mismatches", async () => {
    await expect(
      service.compareOrdinalExperiments(evaluation, {
        evaluationId: "eval-1",
        scoreId: "score-1",
        experimentIdA: "exp-a",
        experimentIdB: "exp-b",
      } as any),
    ).rejects.toThrow(
      formatError(ERROR_MESSAGES.SCORE_MUST_BE_OF_TYPE, "ORDINAL"),
    );
  });

  it("compares ordinal experiments with paired data", async () => {
    const ordinalEvaluation = {
      ...evaluation,
      scores: [
        {
          id: "score-3",
          scoringType: ScoringType.ORDINAL,
          scale: [{ label: "Low", value: 1 }],
        },
      ],
    };
    jest.spyOn(OrdinalComparisonUtil, "compare").mockReturnValue({
      n_paired: 1,
      distribution_comparison: {},
      bowker_test: {
        chi_squared: null,
        p_value: null,
        degrees_of_freedom: null,
      },
      cramers_v: null,
      entropy_difference: null,
      category_changes: null,
      cdf_comparison: {},
      delta_pass_rate: null,
      delta_tail_mass: null,
      median_comparison: { median_a: null, median_b: null },
      percentile_shift: {
        p50: { category_a: null, category_b: null },
        p90: { category_a: null, category_b: null },
      },
      wilcoxon_signed_rank: { w_statistic: null, p_value: null },
      cliffs_delta: null,
      probability_of_superiority: null,
    });
    mockStreamingService.streamPairedRows.mockReturnValue(
      asyncGen([{ valueA: "1", valueB: "1" }]),
    );

    const result = await service.compareOrdinalExperiments(
      ordinalEvaluation as any,
      {
        evaluationId: "eval-1",
        scoreId: "score-3",
        experimentIdA: "exp-a",
        experimentIdB: "exp-b",
      } as any,
    );

    expect(result.ordinal?.n_paired).toBe(1);
    (OrdinalComparisonUtil.compare as jest.Mock).mockRestore();
  });
});
