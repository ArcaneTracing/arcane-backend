import { EvaluationResultsService } from "../../../src/evaluations/services/results/evaluation-results.service";
import { EvaluationScope } from "../../../src/evaluations/entities/evaluation.entity";
import {
  ERROR_MESSAGES,
  formatError,
} from "../../../src/common/constants/error-messages.constants";

describe("EvaluationResultsService", () => {
  const mockScoreResultRepository = {
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
  };
  const mockExperimentResultRepository = {
    find: jest.fn(),
    findOne: jest.fn(),
  };
  const mockDatasetRowRepository = {
    findOne: jest.fn(),
    find: jest.fn(),
  };
  const mockEvaluationLoaderService = {
    loadEvaluationOrFail: jest.fn(),
  };
  const mockGroupingService = {
    groupResultsByDatasetRow: jest.fn(),
    groupResultsByDatasetRowAndExperiment: jest.fn(),
  };
  const mockCacheManager = {
    del: jest.fn(),
  };

  let service: EvaluationResultsService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new EvaluationResultsService(
      mockScoreResultRepository as any,
      mockExperimentResultRepository as any,
      mockDatasetRowRepository as any,
      mockEvaluationLoaderService as any,
      mockGroupingService as any,
      mockCacheManager as any,
    );
  });

  it("createResult rejects scoreIds not in evaluation", async () => {
    mockEvaluationLoaderService.loadEvaluationOrFail.mockResolvedValue({
      id: "eval-1",
      evaluationScope: EvaluationScope.DATASET,
      datasetId: "dataset-1",
      scores: [{ id: "score-1" }],
      experiments: [],
    });

    await expect(
      service.createResult("org-1", "project-1", "eval-1", {
        datasetRowId: "row-1",
        scoreResults: [{ scoreId: "score-2", value: 1 }],
      } as any),
    ).rejects.toThrow(
      formatError(ERROR_MESSAGES.SCORE_RESULTS_CONTAIN_INVALID_SCORES),
    );
  });

  it("createResult rejects missing dataset/experiment references", async () => {
    mockEvaluationLoaderService.loadEvaluationOrFail.mockResolvedValue({
      id: "eval-1",
      evaluationScope: EvaluationScope.DATASET,
      datasetId: "dataset-1",
      scores: [{ id: "score-1" }],
      experiments: [],
    });

    await expect(
      service.createResult("org-1", "project-1", "eval-1", {
        scoreResults: [{ scoreId: "score-1", value: 1 }],
      } as any),
    ).rejects.toThrow(
      formatError(
        ERROR_MESSAGES.EVALUATION_RESULT_MUST_REFERENCE_DATASET_OR_EXPERIMENT,
      ),
    );
  });

  it("createResult rejects experiment results for dataset scope", async () => {
    mockEvaluationLoaderService.loadEvaluationOrFail.mockResolvedValue({
      id: "eval-1",
      evaluationScope: EvaluationScope.DATASET,
      datasetId: "dataset-1",
      scores: [{ id: "score-1" }],
      experiments: [],
    });

    await expect(
      service.createResult("org-1", "project-1", "eval-1", {
        experimentResultId: "exp-result-1",
        scoreResults: [{ scoreId: "score-1", value: 1 }],
      } as any),
    ).rejects.toThrow(
      formatError(ERROR_MESSAGES.EXPERIMENT_RESULTS_ONLY_FOR_EXPERIMENT_SCOPE),
    );
  });

  it("createResult rejects dataset rows for experiment scope", async () => {
    mockEvaluationLoaderService.loadEvaluationOrFail.mockResolvedValue({
      id: "eval-1",
      evaluationScope: EvaluationScope.EXPERIMENT,
      datasetId: null,
      scores: [{ id: "score-1" }],
      experiments: [{ id: "exp-1" }],
    });

    await expect(
      service.createResult("org-1", "project-1", "eval-1", {
        datasetRowId: "row-1",
        scoreResults: [{ scoreId: "score-1", value: 1 }],
      } as any),
    ).rejects.toThrow(
      formatError(ERROR_MESSAGES.DATASET_ROW_RESULTS_ONLY_FOR_DATASET_SCOPE),
    );
  });

  it("createResult saves score results and invalidates cache", async () => {
    mockEvaluationLoaderService.loadEvaluationOrFail.mockResolvedValue({
      id: "eval-1",
      evaluationScope: EvaluationScope.DATASET,
      datasetId: "dataset-1",
      scores: [{ id: "score-1" }],
      experiments: [],
    });
    mockDatasetRowRepository.findOne.mockResolvedValue({
      id: "row-1",
      datasetId: "dataset-1",
    });
    mockScoreResultRepository.create.mockImplementation((input) => input);
    mockScoreResultRepository.save.mockResolvedValue([
      { createdAt: new Date() },
    ]);

    const result = await service.createResult("org-1", "project-1", "eval-1", {
      datasetRowId: "row-1",
      scoreResults: [{ scoreId: "score-1", value: 1 }],
    } as any);

    expect(result.datasetRowId).toBe("row-1");
    expect(mockCacheManager.del).toHaveBeenCalledTimes(6);
  });

  it("listResultsForDataset rejects non-dataset scope", async () => {
    mockEvaluationLoaderService.loadEvaluationOrFail.mockResolvedValue({
      evaluationScope: EvaluationScope.EXPERIMENT,
    });

    await expect(
      service.listResultsForDataset("org-1", "project-1", "eval-1"),
    ).rejects.toThrow(
      formatError(ERROR_MESSAGES.EVALUATION_SCOPE_MISMATCH, "dataset"),
    );
  });

  it("listResultsForDataset filters null datasetRowId groups", async () => {
    mockEvaluationLoaderService.loadEvaluationOrFail.mockResolvedValue({
      evaluationScope: EvaluationScope.DATASET,
    });
    mockScoreResultRepository.find.mockResolvedValue([]);
    mockGroupingService.groupResultsByDatasetRow.mockReturnValue(
      new Map([
        ["row-1", [{ evaluationId: "eval-1", createdAt: new Date() }]],
        ["null", [{ evaluationId: "eval-1", createdAt: new Date() }]],
      ]),
    );

    const result = await service.listResultsForDataset(
      "org-1",
      "project-1",
      "eval-1",
    );

    expect(result).toHaveLength(1);
    expect(result[0].datasetRowId).toBe("row-1");
  });

  it("listResultsForExperiments filters null ids", async () => {
    mockEvaluationLoaderService.loadEvaluationOrFail.mockResolvedValue({
      evaluationScope: EvaluationScope.EXPERIMENT,
    });
    mockScoreResultRepository.find.mockResolvedValue([]);
    mockGroupingService.groupResultsByDatasetRowAndExperiment.mockReturnValue(
      new Map([
        ["row-1::exp-1", [{ evaluationId: "eval-1", createdAt: new Date() }]],
        ["row-1::null", [{ evaluationId: "eval-1", createdAt: new Date() }]],
      ]),
    );

    const result = await service.listResultsForExperiments(
      "org-1",
      "project-1",
      "eval-1",
    );

    expect(result).toHaveLength(1);
    expect(result[0].experimentResultId).toBe("exp-1");
  });

  it("getExperimentScores rejects experiments not in evaluation", async () => {
    mockEvaluationLoaderService.loadEvaluationOrFail.mockResolvedValue({
      experiments: [{ id: "exp-1" }],
    });

    await expect(
      service.getExperimentScores("org-1", "project-1", "eval-1", "exp-2"),
    ).rejects.toThrow(
      formatError(ERROR_MESSAGES.EXPERIMENT_MUST_BELONG_TO_EVALUATION),
    );
  });

  it("getExperimentScores returns empty when no results", async () => {
    mockEvaluationLoaderService.loadEvaluationOrFail.mockResolvedValue({
      experiments: [{ id: "exp-1" }],
    });
    mockExperimentResultRepository.find.mockResolvedValue([]);

    const result = await service.getExperimentScores(
      "org-1",
      "project-1",
      "eval-1",
      "exp-1",
    );

    expect(result.totalCount).toBe(0);
    expect(result.scoreResults).toEqual([]);
  });

  describe("importScoreResults", () => {
    it("rejects when scoreId not in evaluation", async () => {
      mockEvaluationLoaderService.loadEvaluationOrFail.mockResolvedValue({
        id: "eval-1",
        evaluationScope: EvaluationScope.DATASET,
        datasetId: "dataset-1",
        scores: [{ id: "score-1" }],
        experiments: [],
      });

      await expect(
        service.importScoreResults("org-1", "project-1", "eval-1", "score-2", {
          results: [{ datasetRowId: "row-1", value: 1 }],
        } as any),
      ).rejects.toThrow(
        formatError(ERROR_MESSAGES.SCORE_RESULTS_CONTAIN_INVALID_SCORES),
      );
    });

    it("rejects when row has neither datasetRowId nor experimentResultId", async () => {
      mockEvaluationLoaderService.loadEvaluationOrFail.mockResolvedValue({
        id: "eval-1",
        evaluationScope: EvaluationScope.DATASET,
        datasetId: "dataset-1",
        scores: [{ id: "score-1" }],
        experiments: [],
      });

      await expect(
        service.importScoreResults("org-1", "project-1", "eval-1", "score-1", {
          results: [{ value: 1 }],
        } as any),
      ).rejects.toThrow(
        formatError(
          ERROR_MESSAGES.IMPORT_ROW_MUST_HAVE_DATASET_ROW_OR_EXPERIMENT_RESULT,
        ),
      );
    });

    it("rejects when row has both datasetRowId and experimentResultId", async () => {
      mockEvaluationLoaderService.loadEvaluationOrFail.mockResolvedValue({
        id: "eval-1",
        evaluationScope: EvaluationScope.DATASET,
        datasetId: "dataset-1",
        scores: [{ id: "score-1" }],
        experiments: [],
      });

      await expect(
        service.importScoreResults("org-1", "project-1", "eval-1", "score-1", {
          results: [
            { datasetRowId: "row-1", experimentResultId: "er-1", value: 1 },
          ],
        } as any),
      ).rejects.toThrow(
        formatError(
          ERROR_MESSAGES.IMPORT_ROW_MUST_HAVE_DATASET_ROW_OR_EXPERIMENT_RESULT,
        ),
      );
    });

    it("rejects when dataset scope but row has experimentResultId", async () => {
      mockEvaluationLoaderService.loadEvaluationOrFail.mockResolvedValue({
        id: "eval-1",
        evaluationScope: EvaluationScope.DATASET,
        datasetId: "dataset-1",
        scores: [{ id: "score-1" }],
        experiments: [],
      });

      await expect(
        service.importScoreResults("org-1", "project-1", "eval-1", "score-1", {
          results: [{ experimentResultId: "er-1", value: 1 }],
        } as any),
      ).rejects.toThrow(
        formatError(
          ERROR_MESSAGES.IMPORT_ROW_MUST_HAVE_DATASET_ROW_OR_EXPERIMENT_RESULT,
        ),
      );
    });

    it("rejects when experiment scope but row has datasetRowId", async () => {
      mockEvaluationLoaderService.loadEvaluationOrFail.mockResolvedValue({
        id: "eval-1",
        evaluationScope: EvaluationScope.EXPERIMENT,
        datasetId: null,
        scores: [{ id: "score-1" }],
        experiments: [{ id: "exp-1" }],
      });

      await expect(
        service.importScoreResults("org-1", "project-1", "eval-1", "score-1", {
          results: [{ datasetRowId: "row-1", value: 1 }],
        } as any),
      ).rejects.toThrow(
        formatError(
          ERROR_MESSAGES.IMPORT_ROW_MUST_HAVE_DATASET_ROW_OR_EXPERIMENT_RESULT,
        ),
      );
    });

    it("rejects when import contains duplicate datasetRowId", async () => {
      mockEvaluationLoaderService.loadEvaluationOrFail.mockResolvedValue({
        id: "eval-1",
        evaluationScope: EvaluationScope.DATASET,
        datasetId: "dataset-1",
        scores: [{ id: "score-1" }],
        experiments: [],
      });

      await expect(
        service.importScoreResults("org-1", "project-1", "eval-1", "score-1", {
          results: [
            { datasetRowId: "row-1", value: 1 },
            { datasetRowId: "row-1", value: 2 },
          ],
        } as any),
      ).rejects.toThrow(
        formatError(ERROR_MESSAGES.IMPORT_CONTAINS_DUPLICATE_ROW_REF),
      );
    });

    it("rejects when dataset row not found or wrong dataset", async () => {
      mockEvaluationLoaderService.loadEvaluationOrFail.mockResolvedValue({
        id: "eval-1",
        evaluationScope: EvaluationScope.DATASET,
        datasetId: "dataset-1",
        scores: [{ id: "score-1" }],
        experiments: [],
      });
      mockDatasetRowRepository.find.mockResolvedValue([]);

      await expect(
        service.importScoreResults("org-1", "project-1", "eval-1", "score-1", {
          results: [{ datasetRowId: "row-1", value: 1 }],
        } as any),
      ).rejects.toThrow(formatError(ERROR_MESSAGES.DATASET_ROW_NOT_FOUND));
    });

    it("rejects when experiment result not found or not in evaluation", async () => {
      mockEvaluationLoaderService.loadEvaluationOrFail.mockResolvedValue({
        id: "eval-1",
        evaluationScope: EvaluationScope.EXPERIMENT,
        datasetId: null,
        scores: [{ id: "score-1" }],
        experiments: [{ id: "exp-1" }],
      });
      mockExperimentResultRepository.find.mockResolvedValue([]);

      await expect(
        service.importScoreResults("org-1", "project-1", "eval-1", "score-1", {
          results: [{ experimentResultId: "er-1", value: 1 }],
        } as any),
      ).rejects.toThrow(
        formatError(ERROR_MESSAGES.EXPERIMENT_RESULT_NOT_FOUND),
      );
    });

    it("upserts when score result already exists (e.g. manual score pending)", async () => {
      const existingRow1 = {
        id: "sr-1",
        evaluationId: "eval-1",
        scoreId: "score-1",
        datasetRowId: "row-1",
        experimentResultId: null,
        value: null,
        reasoning: null,
        status: "PENDING",
      };
      mockEvaluationLoaderService.loadEvaluationOrFail.mockResolvedValue({
        id: "eval-1",
        evaluationScope: EvaluationScope.DATASET,
        datasetId: "dataset-1",
        scores: [{ id: "score-1" }],
        experiments: [],
      });
      mockDatasetRowRepository.find.mockResolvedValue([
        { id: "row-1", datasetId: "dataset-1" },
        { id: "row-2", datasetId: "dataset-1" },
      ]);
      mockScoreResultRepository.find.mockResolvedValue([existingRow1]);
      mockScoreResultRepository.create.mockImplementation((input) => input);
      mockScoreResultRepository.save.mockResolvedValue([existingRow1, {}]);

      const result = await service.importScoreResults(
        "org-1",
        "project-1",
        "eval-1",
        "score-1",
        {
          results: [
            { datasetRowId: "row-1", value: 1 },
            { datasetRowId: "row-2", value: 2 },
          ],
        } as any,
      );

      expect(result.importedCount).toBe(2);
      expect(existingRow1.value).toBe(1);
      expect(existingRow1.status).toBe("DONE");
      expect(mockScoreResultRepository.save).toHaveBeenCalled();
    });

    it("saves score results for dataset scope and invalidates cache", async () => {
      mockEvaluationLoaderService.loadEvaluationOrFail.mockResolvedValue({
        id: "eval-1",
        evaluationScope: EvaluationScope.DATASET,
        datasetId: "dataset-1",
        scores: [{ id: "score-1" }],
        experiments: [],
      });
      mockDatasetRowRepository.find.mockResolvedValue([
        { id: "row-1", datasetId: "dataset-1" },
        { id: "row-2", datasetId: "dataset-1" },
      ]);
      mockScoreResultRepository.find.mockResolvedValue([]);
      mockScoreResultRepository.create.mockImplementation((input) => input);
      mockScoreResultRepository.save.mockResolvedValue([{}, {}]);

      const result = await service.importScoreResults(
        "org-1",
        "project-1",
        "eval-1",
        "score-1",
        {
          results: [
            { datasetRowId: "row-1", value: 1, reasoning: "r1" },
            { datasetRowId: "row-2", value: 2 },
          ],
        } as any,
      );

      expect(result.importedCount).toBe(2);
      expect(mockScoreResultRepository.save).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            evaluationId: "eval-1",
            scoreId: "score-1",
            datasetRowId: "row-1",
            experimentResultId: null,
            value: 1,
            reasoning: "r1",
            status: "DONE",
          }),
          expect.objectContaining({
            evaluationId: "eval-1",
            scoreId: "score-1",
            datasetRowId: "row-2",
            experimentResultId: null,
            value: 2,
            status: "DONE",
          }),
        ]),
      );
      expect(mockCacheManager.del).toHaveBeenCalledTimes(6);
    });

    it("saves score results for experiment scope and invalidates cache", async () => {
      mockEvaluationLoaderService.loadEvaluationOrFail.mockResolvedValue({
        id: "eval-1",
        evaluationScope: EvaluationScope.EXPERIMENT,
        datasetId: null,
        scores: [{ id: "score-1" }],
        experiments: [{ id: "exp-1" }],
      });
      mockExperimentResultRepository.find.mockResolvedValue([
        { id: "er-1", experimentId: "exp-1" },
        { id: "er-2", experimentId: "exp-1" },
      ]);
      mockScoreResultRepository.find.mockResolvedValue([]);
      mockScoreResultRepository.create.mockImplementation((input) => input);
      mockScoreResultRepository.save.mockResolvedValue([{}, {}]);

      const result = await service.importScoreResults(
        "org-1",
        "project-1",
        "eval-1",
        "score-1",
        {
          results: [
            { experimentResultId: "er-1", value: "good" },
            { experimentResultId: "er-2", value: 3, reasoning: "r2" },
          ],
        } as any,
      );

      expect(result.importedCount).toBe(2);
      expect(mockScoreResultRepository.save).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            evaluationId: "eval-1",
            scoreId: "score-1",
            datasetRowId: null,
            experimentResultId: "er-1",
            value: "good",
            status: "DONE",
          }),
          expect.objectContaining({
            evaluationId: "eval-1",
            scoreId: "score-1",
            datasetRowId: null,
            experimentResultId: "er-2",
            value: 3,
            reasoning: "r2",
            status: "DONE",
          }),
        ]),
      );
      expect(mockCacheManager.del).toHaveBeenCalledTimes(6);
    });
  });
});
