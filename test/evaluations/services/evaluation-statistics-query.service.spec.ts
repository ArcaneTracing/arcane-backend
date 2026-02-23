import { EvaluationStatisticsQueryService } from "../../../src/evaluations/services/statistics/evaluation-statistics-query.service";

describe("EvaluationStatisticsQueryService", () => {
  const mockDatasetStatisticsService = {
    getStatistics: jest.fn(),
  };
  const mockExperimentStatisticsService = {
    getStatistics: jest.fn(),
  };

  let service: EvaluationStatisticsQueryService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new EvaluationStatisticsQueryService(
      mockDatasetStatisticsService as any,
      mockExperimentStatisticsService as any,
    );
  });

  it("delegates dataset statistics calls", async () => {
    mockDatasetStatisticsService.getStatistics.mockResolvedValue([
      { datasetId: "d1" },
    ]);

    const result = await service.getStatisticsForDataset(
      "org",
      "project",
      "eval",
    );

    expect(result).toEqual([{ datasetId: "d1" }]);
    expect(mockDatasetStatisticsService.getStatistics).toHaveBeenCalledWith(
      "org",
      "project",
      "eval",
    );
  });

  it("delegates experiment statistics calls", async () => {
    mockExperimentStatisticsService.getStatistics.mockResolvedValue([
      { experimentId: "e1" },
    ]);

    const result = await service.getStatisticsForExperiments(
      "org",
      "project",
      "eval",
    );

    expect(result).toEqual([{ experimentId: "e1" }]);
    expect(mockExperimentStatisticsService.getStatistics).toHaveBeenCalledWith(
      "org",
      "project",
      "eval",
    );
  });
});
