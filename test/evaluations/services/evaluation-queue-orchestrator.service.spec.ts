import { EvaluationQueueOrchestrator } from "../../../src/evaluations/services/queue-orchestration/evaluation-queue-orchestrator.service";
import { ScoringType } from "../../../src/scores/entities/score.entity";
import { ScoreResultStatus } from "../../../src/evaluations/entities/score-result.entity";

describe("EvaluationQueueOrchestrator", () => {
  const mockScoreResultRepository = {
    create: jest.fn(),
    save: jest.fn(),
  };
  const mockScoreRepository = {
    find: jest.fn(),
  };
  const mockPromptVersionsService = {
    getLatestVersionEntity: jest.fn(),
  };
  const mockEvaluationQueueService = {
    addJob: jest.fn(),
  };
  const mockScoreMappingFillerService = {
    fillScoreMappingsForDataset: jest.fn(),
    fillScoreMappingsForExperiments: jest.fn(),
    getRowResultPairsForScope: jest.fn().mockResolvedValue([]),
  };

  let service: EvaluationQueueOrchestrator;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new EvaluationQueueOrchestrator(
      mockScoreResultRepository as any,
      mockScoreRepository as any,
      mockPromptVersionsService as any,
      mockEvaluationQueueService as any,
      mockScoreMappingFillerService as any,
    );
  });

  it("returns early when scoreMappings are missing", async () => {
    await service.postEvaluationToQueue(
      { id: "eval-1", scoreMappings: null } as any,
      null,
      [],
    );

    expect(
      mockScoreMappingFillerService.fillScoreMappingsForDataset,
    ).not.toHaveBeenCalled();
  });

  it("returns early when ragas scores lack ragasModelConfigurationId", async () => {
    await service.postEvaluationToQueue(
      {
        id: "eval-1",
        scoreMappings: {},
        ragasModelConfigurationId: null,
        scores: [{ scoringType: ScoringType.RAGAS }],
      } as any,
      null,
      [],
    );

    expect(
      mockScoreMappingFillerService.fillScoreMappingsForDataset,
    ).not.toHaveBeenCalled();
  });

  it("createPendingScoreResults creates pending score results", async () => {
    mockScoreResultRepository.create.mockImplementation((input) => input);
    mockScoreResultRepository.save.mockResolvedValue([
      { id: "sr-1" },
      { id: "sr-2" },
    ]);

    const result = await service.createPendingScoreResults(
      { id: "eval-1" } as any,
      [
        { scoreId: "score-1", datasetRowId: "row-1", experimentResultId: null },
        {
          scoreId: "score-2",
          datasetRowId: "row-2",
          experimentResultId: "exp-1",
        },
      ],
    );

    expect(result).toHaveLength(2);
    expect(mockScoreResultRepository.save).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          scoreId: "score-1",
          status: ScoreResultStatus.PENDING,
        }),
      ]),
    );
  });

  it("resolvePromptVersionsAndConfigs builds promptVersionMap for non-ragas scores", async () => {
    mockScoreRepository.find.mockResolvedValue([
      {
        id: "score-1",
        scoringType: ScoringType.NUMERIC,
        evaluatorPromptId: "prompt-1",
        evaluatorPrompt: { id: "prompt-1" },
      },
    ]);
    mockPromptVersionsService.getLatestVersionEntity.mockResolvedValue({
      id: "pv-1",
      promptId: "prompt-1",
      modelConfigurationId: "mc-1",
      modelConfiguration: { id: "mc-1" },
    });

    const { promptVersionMap } = await service.resolvePromptVersionsAndConfigs(
      "project-1",
      [{ scoreId: "score-1" }],
      [{ id: "score-1", scoringType: ScoringType.NUMERIC } as any],
    );

    expect(
      mockPromptVersionsService.getLatestVersionEntity,
    ).toHaveBeenCalledWith("project-1", "prompt-1");
    expect(promptVersionMap.get("score-1")?.id).toBe("pv-1");
  });

  it("resolvePromptVersionsAndConfigs skips ragas scores", async () => {
    mockScoreRepository.find.mockResolvedValue([
      { id: "score-1", scoringType: ScoringType.RAGAS },
    ]);

    const { promptVersionMap } = await service.resolvePromptVersionsAndConfigs(
      "project-1",
      [{ scoreId: "score-1" }],
      [{ id: "score-1", scoringType: ScoringType.RAGAS } as any],
    );

    expect(promptVersionMap.size).toBe(0);
  });
});
