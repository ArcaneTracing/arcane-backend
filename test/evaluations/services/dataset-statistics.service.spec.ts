import { DatasetStatisticsService } from "../../../src/evaluations/services/statistics/dataset-statistics.service";
import { EvaluationScope } from "../../../src/evaluations/entities/evaluation.entity";
import { ScoringType } from "../../../src/scores/entities/score.entity";
import {
  ERROR_MESSAGES,
  formatError,
} from "../../../src/common/constants/error-messages.constants";

describe("DatasetStatisticsService", () => {
  const mockEvaluationLoaderService = {
    loadEvaluationOrFail: jest.fn(),
  };
  const mockCalculationOrchestrator = {
    calculateStatisticsForScoreGroup: jest.fn(),
  };
  const mockCacheManager = {
    get: jest.fn(),
    set: jest.fn(),
  };

  let service: DatasetStatisticsService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new DatasetStatisticsService(
      mockEvaluationLoaderService as any,
      mockCalculationOrchestrator as any,
      mockCacheManager as any,
    );
  });

  it("returns cached statistics when available", async () => {
    mockCacheManager.get.mockResolvedValue([{ datasetId: "dataset-1" }]);

    const result = await service.getStatistics("org-1", "project-1", "eval-1");

    expect(result).toEqual([{ datasetId: "dataset-1" }]);
    expect(
      mockCalculationOrchestrator.calculateStatisticsForScoreGroup,
    ).not.toHaveBeenCalled();
  });

  it("rejects non-dataset scope evaluations", async () => {
    mockCacheManager.get.mockResolvedValue(null);
    mockEvaluationLoaderService.loadEvaluationOrFail.mockResolvedValue({
      evaluationScope: EvaluationScope.EXPERIMENT,
      datasetId: null,
    });

    await expect(
      service.getStatistics("org-1", "project-1", "eval-1"),
    ).rejects.toThrow(
      formatError(
        ERROR_MESSAGES.THIS_ENDPOINT_ONLY_FOR_DATASET_SCOPED_EVALUATIONS,
      ),
    );
  });

  it("calculates statistics for all scores", async () => {
    mockCacheManager.get.mockResolvedValue(null);
    const evaluation = {
      evaluationScope: EvaluationScope.DATASET,
      datasetId: "dataset-1",
      scores: [{ id: "score-1", scoringType: ScoringType.NUMERIC }],
    };
    mockEvaluationLoaderService.loadEvaluationOrFail.mockResolvedValue(
      evaluation,
    );
    mockCalculationOrchestrator.calculateStatisticsForScoreGroup.mockReturnValue(
      {
        numeric: { mean: 1 },
      },
    );

    const result = await service.getStatistics("org-1", "project-1", "eval-1");

    expect(result).toEqual([
      {
        datasetId: "dataset-1",
        scoreId: "score-1",
        numeric: { mean: 1 },
        nominal: null,
        ordinal: null,
      },
    ]);
    expect(mockCacheManager.set).toHaveBeenCalled();
  });

  it("filters nominal statistics by scoring type", async () => {
    mockCacheManager.get.mockResolvedValue(null);
    mockEvaluationLoaderService.loadEvaluationOrFail.mockResolvedValue({
      evaluationScope: EvaluationScope.DATASET,
      datasetId: "dataset-1",
      scores: [
        { id: "score-1", scoringType: ScoringType.NOMINAL },
        { id: "score-2", scoringType: ScoringType.NUMERIC },
      ],
    });
    mockCalculationOrchestrator.calculateStatisticsForScoreGroup.mockReturnValue(
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
    expect(
      mockCalculationOrchestrator.calculateStatisticsForScoreGroup,
    ).toHaveBeenCalledTimes(1);
  });
});
