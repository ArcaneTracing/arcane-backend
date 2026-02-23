import { StatisticsCalculationOrchestrator } from "../../../src/evaluations/services/statistics/statistics-calculation-orchestrator.service";
import { ScoreResultStatus } from "../../../src/evaluations/entities/score-result.entity";
import { ScoringType } from "../../../src/scores/entities/score.entity";

describe("StatisticsCalculationOrchestrator", () => {
  const mockEvaluationStatisticsService = {
    calculateNominalStatistics: jest.fn(),
    calculateOrdinalStatistics: jest.fn(),
    calculateStatistics: jest.fn(),
  };

  let orchestrator: StatisticsCalculationOrchestrator;

  beforeEach(() => {
    jest.clearAllMocks();
    orchestrator = new StatisticsCalculationOrchestrator(
      mockEvaluationStatisticsService as any,
    );
  });

  it("filters scored results to DONE with non-null values", () => {
    const results = orchestrator.filterScoredResults([
      { status: ScoreResultStatus.DONE, value: 1 } as any,
      { status: ScoreResultStatus.DONE, value: null } as any,
      { status: ScoreResultStatus.PENDING, value: 2 } as any,
    ]);

    expect(results).toHaveLength(1);
    expect(results[0].value).toBe(1);
  });

  it("extractCategoryValues stringifies and drops null/undefined", () => {
    const values = orchestrator.extractCategoryValues([
      { value: null } as any,
      { value: undefined } as any,
      { value: "ok" } as any,
      { value: 1 } as any,
    ]);

    expect(values).toEqual(["ok", "1"]);
  });

  it("extractNumericValues parses numeric strings and drops NaN", () => {
    const values = orchestrator.extractNumericValues([
      { value: 1 } as any,
      { value: "2" } as any,
      { value: "x" } as any,
      { value: {} } as any,
    ]);

    expect(values).toEqual([1, 2]);
  });

  it("calculates nominal stats with scoreId attached", () => {
    mockEvaluationStatisticsService.calculateNominalStatistics.mockReturnValue({
      n_scored: 2,
    });
    const result = orchestrator.calculateStatisticsForScoreGroupFromMemory(
      [{ status: ScoreResultStatus.DONE, value: "A" }] as any,
      { id: "score-1", scoringType: ScoringType.NOMINAL } as any,
      3,
    );

    expect(result.nominal?.scoreId).toBe("score-1");
    expect(result.nominal?.n_scored).toBe(2);
  });

  it("calculates ordinal stats with scale and config", () => {
    mockEvaluationStatisticsService.calculateOrdinalStatistics.mockReturnValue({
      n_scored: 1,
    });
    const result = orchestrator.calculateStatisticsForScoreGroupFromMemory(
      [{ status: ScoreResultStatus.DONE, value: "1" }] as any,
      {
        id: "score-2",
        scoringType: ScoringType.ORDINAL,
        scale: [{ label: "Low", value: 1 }],
        ordinalConfig: { acceptable_set: ["Low"] },
      } as any,
      1,
    );

    expect(result.ordinal?.scoreId).toBe("score-2");
    expect(result.ordinal?.n_scored).toBe(1);
  });

  it("calculates numeric stats for numeric and ragas scores", () => {
    mockEvaluationStatisticsService.calculateStatistics.mockReturnValue({
      mean: 1,
    });
    const numeric = orchestrator.calculateStatisticsForScoreGroupFromMemory(
      [{ status: ScoreResultStatus.DONE, value: 1 }] as any,
      { id: "score-3", scoringType: ScoringType.NUMERIC } as any,
      1,
    );
    const ragas = orchestrator.calculateStatisticsForScoreGroupFromMemory(
      [{ status: ScoreResultStatus.DONE, value: 1 }] as any,
      { id: "score-4", scoringType: ScoringType.RAGAS } as any,
      1,
    );

    expect(numeric.numeric?.mean).toBe(1);
    expect(ragas.numeric?.mean).toBe(1);
  });

  it("returns empty stats for unsupported scoring type", () => {
    const result = orchestrator.calculateStatisticsForScoreGroupFromMemory(
      [{ status: ScoreResultStatus.DONE, value: 1 }] as any,
      { id: "score-5", scoringType: "CUSTOM" } as any,
      1,
    );

    expect(result).toEqual({});
  });
});
