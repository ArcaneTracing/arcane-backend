import { EvaluationsService } from "../../../src/evaluations/services/core/evaluations.service";

describe("EvaluationsService", () => {
  const mockEvaluationRepository = {
    createQueryBuilder: jest.fn(),
  };
  const mockExperimentComparisonService = {
    compareExperiments: jest.fn(),
  };
  const mockEvaluationLoaderService = {
    loadEvaluationOrFail: jest.fn(),
  };
  const mockEvaluationWriterService = {
    create: jest.fn(),
    rerun: jest.fn(),
    remove: jest.fn(),
  };
  const mockEvaluationResultsService = {
    createResult: jest.fn(),
    importScoreResults: jest.fn(),
    listResultsForDatasetPaginated: jest.fn(),
    listResultsForExperimentsPaginated: jest.fn(),
    getExperimentScores: jest.fn(),
  };
  const mockEvaluationStatisticsQueryService = {
    getStatisticsForDataset: jest.fn(),
    getStatisticsForExperiments: jest.fn(),
  };

  let service: EvaluationsService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new EvaluationsService(
      mockEvaluationRepository as any,
      mockExperimentComparisonService as any,
      mockEvaluationLoaderService as any,
      mockEvaluationWriterService as any,
      mockEvaluationResultsService as any,
      mockEvaluationStatisticsQueryService as any,
    );
  });

  it("creates evaluations via writer service", async () => {
    mockEvaluationWriterService.create.mockResolvedValue({ id: "eval-1" });

    const result = await service.create(
      "org-1",
      "project-1",
      { name: "Eval" } as any,
      "user-1",
    );

    expect(result.id).toBe("eval-1");
  });

  it("remove delegates to writer service with userId", async () => {
    mockEvaluationWriterService.remove.mockResolvedValue(undefined);

    await service.remove("org-1", "project-1", "eval-1", "user-1");

    expect(mockEvaluationWriterService.remove).toHaveBeenCalledWith(
      "org-1",
      "project-1",
      "eval-1",
      "user-1",
    );
  });

  it("findAll loads and maps evaluations", async () => {
    const builder = {
      innerJoin: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([
        {
          id: "eval-1",
          scores: [],
          experiments: [],
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]),
    };
    mockEvaluationRepository.createQueryBuilder.mockReturnValue(builder);

    const result = await service.findAll("org-1", "project-1");

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("eval-1");
  });

  it("compareExperiments delegates to comparison service", async () => {
    mockEvaluationLoaderService.loadEvaluationOrFail.mockResolvedValue({
      id: "eval-1",
    });
    mockExperimentComparisonService.compareExperiments.mockResolvedValue({
      numeric: null,
    });

    const result = await service.compareExperiments("org-1", "project-1", {
      evaluationId: "eval-1",
    } as any);

    expect(result).toEqual({ numeric: null });
  });

  it("importScoreResults delegates to evaluation results service", async () => {
    mockEvaluationResultsService.importScoreResults.mockResolvedValue({
      importedCount: 3,
    });

    const dto = { results: [{ datasetRowId: "row-1", value: 1 }] };
    const result = await service.importScoreResults(
      "org-1",
      "project-1",
      "eval-1",
      "score-1",
      dto as any,
    );

    expect(result).toEqual({ importedCount: 3 });
    expect(
      mockEvaluationResultsService.importScoreResults,
    ).toHaveBeenCalledWith("org-1", "project-1", "eval-1", "score-1", dto);
  });

  it("listResultsForDatasetPaginated delegates to evaluation results service", async () => {
    const mockPaginatedResult = {
      data: [{ id: "result-1" }],
      pagination: {
        page: 1,
        limit: 20,
        total: 1,
        totalPages: 1,
        hasNextPage: false,
        hasPreviousPage: false,
      },
    };
    mockEvaluationResultsService.listResultsForDatasetPaginated.mockResolvedValue(
      mockPaginatedResult,
    );

    const query = { page: 1, limit: 20 };
    const result = await service.listResultsForDatasetPaginated(
      "org-1",
      "project-1",
      "eval-1",
      query as any,
    );

    expect(result).toEqual(mockPaginatedResult);
    expect(
      mockEvaluationResultsService.listResultsForDatasetPaginated,
    ).toHaveBeenCalledWith("org-1", "project-1", "eval-1", query);
  });

  it("listResultsForExperimentsPaginated delegates to evaluation results service", async () => {
    const mockPaginatedResult = {
      data: [{ id: "result-1" }],
      pagination: {
        page: 1,
        limit: 20,
        total: 1,
        totalPages: 1,
        hasNextPage: false,
        hasPreviousPage: false,
      },
    };
    mockEvaluationResultsService.listResultsForExperimentsPaginated.mockResolvedValue(
      mockPaginatedResult,
    );

    const query = { page: 1, limit: 20 };
    const result = await service.listResultsForExperimentsPaginated(
      "org-1",
      "project-1",
      "eval-1",
      "exp-1",
      query as any,
    );

    expect(result).toEqual(mockPaginatedResult);
    expect(
      mockEvaluationResultsService.listResultsForExperimentsPaginated,
    ).toHaveBeenCalledWith("org-1", "project-1", "eval-1", "exp-1", query);
  });
});
