import { ExperimentStatisticsService } from "../../../src/evaluations/services/statistics/experiment-statistics.service";
import { EvaluationScope } from "../../../src/evaluations/entities/evaluation.entity";
import { ScoringType } from "../../../src/scores/entities/score.entity";
import {
  ERROR_MESSAGES,
  formatError,
} from "../../../src/common/constants/error-messages.constants";

describe("ExperimentStatisticsService", () => {
  const mockEvaluationLoaderService = {
    loadEvaluationOrFail: jest.fn(),
  };
  const mockCalculationOrchestrator = {
    calculateStatisticsForScoreGroup: jest.fn(),
  };
  const mockManagerQuery = jest
    .fn()
    .mockResolvedValue([{ experimentId: "exp-1" }]);
  const mockScoreResultRepository = {
    createQueryBuilder: jest.fn().mockReturnValue({
      select: jest.fn().mockReturnThis(),
      innerJoin: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getRawMany: jest.fn().mockResolvedValue([{ experimentId: "exp-1" }]),
    }),
    manager: { query: mockManagerQuery },
  };
  const mockCacheManager = {
    get: jest.fn(),
    set: jest.fn(),
  };

  let service: ExperimentStatisticsService;

  beforeEach(() => {
    jest.clearAllMocks();
    mockManagerQuery.mockResolvedValue([{ experimentId: "exp-1" }]);
    mockScoreResultRepository.createQueryBuilder.mockReturnValue({
      select: jest.fn().mockReturnThis(),
      innerJoin: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getRawMany: jest.fn().mockResolvedValue([{ experimentId: "exp-1" }]),
    });
    service = new ExperimentStatisticsService(
      mockEvaluationLoaderService as any,
      mockCalculationOrchestrator as any,
      mockScoreResultRepository as any,
      mockCacheManager as any,
    );
  });

  it("returns cached statistics when available", async () => {
    mockCacheManager.get.mockResolvedValue([{ experimentId: "exp-1" }]);

    const result = await service.getStatistics("org-1", "project-1", "eval-1");

    expect(result).toEqual([{ experimentId: "exp-1" }]);
    expect(
      mockEvaluationLoaderService.loadEvaluationOrFail,
    ).not.toHaveBeenCalled();
  });

  it("rejects non-experiment scope evaluations", async () => {
    mockCacheManager.get.mockResolvedValue(null);
    mockEvaluationLoaderService.loadEvaluationOrFail.mockResolvedValue({
      evaluationScope: EvaluationScope.DATASET,
    });

    await expect(
      service.getStatistics("org-1", "project-1", "eval-1"),
    ).rejects.toThrow(
      formatError(ERROR_MESSAGES.EVALUATION_SCOPE_MISMATCH, "experiment"),
    );
  });

  it("calculates statistics for all experiment score groups", async () => {
    mockCacheManager.get.mockResolvedValue(null);
    mockEvaluationLoaderService.loadEvaluationOrFail
      .mockResolvedValueOnce({ evaluationScope: EvaluationScope.EXPERIMENT })
      .mockResolvedValueOnce({
        evaluationScope: EvaluationScope.EXPERIMENT,
        experiments: [{ id: "exp-1" }],
        scores: [{ id: "score-1", scoringType: ScoringType.NUMERIC }],
      });
    mockCalculationOrchestrator.calculateStatisticsForScoreGroup.mockResolvedValue(
      {
        numeric: { mean: 2 },
      },
    );

    const result = await service.getStatistics("org-1", "project-1", "eval-1");

    expect(result).toEqual([
      {
        experimentId: "exp-1",
        scoreId: "score-1",
        numeric: { mean: 2 },
        nominal: null,
        ordinal: null,
      },
    ]);
  });

  it("filters nominal statistics by scoring type", async () => {
    mockCacheManager.get.mockResolvedValue(null);
    mockEvaluationLoaderService.loadEvaluationOrFail.mockResolvedValue({
      evaluationScope: EvaluationScope.EXPERIMENT,
      experiments: [{ id: "exp-1" }],
      scores: [
        { id: "score-1", scoringType: ScoringType.NOMINAL },
        { id: "score-2", scoringType: ScoringType.NUMERIC },
      ],
    });
    mockCalculationOrchestrator.calculateStatisticsForScoreGroup.mockResolvedValue(
      {
        nominal: { counts_by_code: { A: 1 } },
      },
    );

    const result = await service.getNominalStatistics(
      "org-1",
      "project-1",
      "eval-1",
    );

    expect(result).toHaveLength(1);
    expect(result[0].scoreId).toBe("score-1");
  });
});
