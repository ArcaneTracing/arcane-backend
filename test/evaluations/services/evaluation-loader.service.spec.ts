import { EvaluationLoaderService } from "../../../src/evaluations/services/core/evaluation-loader.service";
import {
  ERROR_MESSAGES,
  formatError,
} from "../../../src/common/constants/error-messages.constants";
import { EvaluationScope } from "../../../src/evaluations/entities/evaluation.entity";

describe("EvaluationLoaderService", () => {
  const mockEvaluationRepository = {
    findOne: jest.fn(),
  };
  const mockScoreRepository = {
    find: jest.fn(),
  };
  const mockExperimentRepository = {
    find: jest.fn(),
  };
  const mockDatasetRepository = {
    findOne: jest.fn(),
  };

  let service: EvaluationLoaderService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new EvaluationLoaderService(
      mockEvaluationRepository as any,
      mockScoreRepository as any,
      mockExperimentRepository as any,
      mockDatasetRepository as any,
    );
  });

  it("loadScores throws when any score is missing", async () => {
    mockScoreRepository.find.mockResolvedValue([
      { id: "score-1", projectId: "project-1" },
    ]);

    await expect(
      service.loadScores("project-1", ["score-1", "score-2"]),
    ).rejects.toThrow(formatError(ERROR_MESSAGES.SCORES_NOT_FOUND));
  });

  it("loadScores throws when score does not belong to project", async () => {
    mockScoreRepository.find.mockResolvedValue([
      { id: "score-1", projectId: "project-1" },
      { id: "score-2", projectId: "other-project" },
    ]);

    await expect(
      service.loadScores("project-1", ["score-1", "score-2"]),
    ).rejects.toThrow(
      formatError(ERROR_MESSAGES.SCORES_DOES_NOT_BELONG_TO_PROJECT),
    );
  });

  it("loadExperiments returns empty list when no ids provided", async () => {
    const result = await service.loadExperiments("project-1", []);

    expect(result).toEqual([]);
  });

  it("loadExperiments throws when experiments are missing", async () => {
    mockExperimentRepository.find.mockResolvedValue([
      { id: "exp-1", projectId: "project-1" },
    ]);

    await expect(
      service.loadExperiments("project-1", ["exp-1", "exp-2"]),
    ).rejects.toThrow(formatError(ERROR_MESSAGES.EXPERIMENTS_NOT_FOUND));
  });

  it("loadDataset returns null when datasetId is missing", async () => {
    const result = await service.loadDataset("project-1", undefined);
    expect(result).toBeNull();
    expect(mockDatasetRepository.findOne).not.toHaveBeenCalled();
  });

  it("ensureScopeConfiguration rejects invalid scope configuration", () => {
    expect(() =>
      service.ensureScopeConfiguration(EvaluationScope.DATASET, null, []),
    ).toThrow("Dataset evaluations require a datasetId");
    expect(() =>
      service.ensureScopeConfiguration(EvaluationScope.EXPERIMENT, null, []),
    ).toThrow("Experiment evaluations require experimentIds");
    expect(() =>
      service.ensureScopeConfiguration(EvaluationScope.EXPERIMENT, null, [
        { datasetId: "d1" },
        { datasetId: "d2" },
      ] as any),
    ).toThrow("All experiments in an evaluation must have the same datasetId");
  });

  it("loadEvaluationOrFail throws on organisation mismatch", async () => {
    mockEvaluationRepository.findOne.mockResolvedValue({
      id: "eval-1",
      projectId: "project-1",
      project: { organisationId: "org-2" },
    });

    await expect(
      service.loadEvaluationOrFail("org-1", "project-1", "eval-1"),
    ).rejects.toThrow(
      formatError(
        ERROR_MESSAGES.EVALUATION_NOT_FOUND_IN_ORGANISATION,
        "eval-1",
      ),
    );
  });
});
