import { ScoreMappingFillerService } from "../../../src/evaluations/services/results/score-mapping-filler.service";
import { ScoringType } from "../../../src/scores/entities/score.entity";

describe("ScoreMappingFillerService", () => {
  const mockDatasetRowRepository = {
    find: jest.fn(),
  };
  const mockExperimentResultRepository = {
    find: jest.fn(),
  };
  const mockDatasetRepository = {
    findOne: jest.fn(),
  };

  let service: ScoreMappingFillerService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ScoreMappingFillerService(
      mockDatasetRowRepository as any,
      mockExperimentResultRepository as any,
      mockDatasetRepository as any,
    );
  });

  it("returns empty mappings when template is empty", async () => {
    const result = await service.fillScoreMappingsForDataset(
      {},
      { id: "dataset-1" } as any,
      [],
    );

    expect(result).toEqual([]);
  });

  it("fills mappings for dataset rows", async () => {
    mockDatasetRowRepository.find.mockResolvedValue([
      { id: "row-1", values: ["v1"], datasetId: "dataset-1" },
    ]);

    const result = await service.fillScoreMappingsForDataset(
      { "score-1": { input1: "col1" } },
      { id: "dataset-1", header: ["col1"] } as any,
      [{ id: "score-1", scoringType: ScoringType.NUMERIC } as any],
    );

    expect(result).toEqual([
      {
        scoreId: "score-1",
        scoringType: ScoringType.NUMERIC,
        datasetRowId: "row-1",
        experimentResultId: null,
        input1: "v1",
      },
    ]);
  });

  it("adds ragasScoreKey for RAGAS scores", async () => {
    mockDatasetRowRepository.find.mockResolvedValue([
      { id: "row-1", values: ["v1"], datasetId: "dataset-1" },
    ]);

    const result = await service.fillScoreMappingsForDataset(
      { "score-1": { input1: "col1" } },
      { id: "dataset-1", header: ["col1"] } as any,
      [
        {
          id: "score-1",
          scoringType: ScoringType.RAGAS,
          ragasScoreKey: "faithfulness",
        } as any,
      ],
    );

    expect(result[0].ragasScoreKey).toBe("faithfulness");
  });

  it("returns empty mappings when experiments are missing", async () => {
    const result = await service.fillScoreMappingsForExperiments({}, [], []);

    expect(result).toEqual([]);
  });

  it("fills mappings for experiment results and experiment_result field", async () => {
    mockDatasetRepository.findOne.mockResolvedValue({
      id: "dataset-1",
      header: ["col1"],
    });
    mockExperimentResultRepository.find.mockResolvedValue([
      {
        id: "exp-result-1",
        experimentId: "exp-1",
        result: "output",
        datasetRow: { id: "row-1", values: ["v1"], datasetId: "dataset-1" },
      },
    ]);

    const result = await service.fillScoreMappingsForExperiments(
      { "score-1": { output: "experiment_result", input1: "col1" } },
      [{ id: "exp-1", datasetId: "dataset-1" } as any],
      [{ id: "score-1", scoringType: ScoringType.NUMERIC } as any],
    );

    expect(result).toEqual([
      {
        scoreId: "score-1",
        scoringType: ScoringType.NUMERIC,
        datasetRowId: "row-1",
        experimentResultId: "exp-result-1",
        output: "output",
        input1: "v1",
      },
    ]);
  });
});
