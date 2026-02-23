import { EvaluationWriterService } from "../../../src/evaluations/services/core/evaluation-writer.service";
import {
  ERROR_MESSAGES,
  formatError,
} from "../../../src/common/constants/error-messages.constants";
import { ScoringType } from "../../../src/scores/entities/score.entity";

describe("EvaluationWriterService", () => {
  const mockEvaluationRepository = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    remove: jest.fn(),
  };
  const mockAuditService = { record: jest.fn().mockResolvedValue(undefined) };
  const mockEvaluationLoaderService = {
    loadScores: jest.fn(),
    loadExperiments: jest.fn(),
    loadDataset: jest.fn(),
    ensureScopeConfiguration: jest.fn(),
    loadEvaluationOrFail: jest.fn(),
  };
  const mockEvaluationJobsService = {
    postScoreMappingsToQueue: jest.fn(),
  };

  let service: EvaluationWriterService;

  beforeEach(() => {
    jest.clearAllMocks();
    mockAuditService.record.mockResolvedValue(undefined);
    service = new EvaluationWriterService(
      mockEvaluationRepository as any,
      mockEvaluationLoaderService as any,
      mockEvaluationJobsService as any,
      mockAuditService as any,
    );
  });

  it("create throws when ragas scores lack ragasModelConfigurationId", async () => {
    mockEvaluationLoaderService.loadScores.mockResolvedValue([
      { id: "score-1", scoringType: ScoringType.RAGAS },
    ]);

    await expect(
      service.create(
        "org-1",
        "project-1",
        {
          evaluationType: "type",
          evaluationScope: "dataset",
          name: "Eval",
          scoreIds: ["score-1"],
        } as any,
        "user-1",
      ),
    ).rejects.toThrow(
      formatError(ERROR_MESSAGES.RAGAS_MODEL_CONFIGURATION_REQUIRED),
    );
  });

  it("create returns evaluation and queues jobs", async () => {
    const saved = { id: "eval-1" };
    const withRelations = { id: "eval-1", scores: [], experiments: [] };
    mockEvaluationLoaderService.loadScores.mockResolvedValue([]);
    mockEvaluationLoaderService.loadExperiments.mockResolvedValue([]);
    mockEvaluationLoaderService.loadDataset.mockResolvedValue(null);
    mockEvaluationRepository.create.mockReturnValue(saved);
    mockEvaluationRepository.save.mockResolvedValue(saved);
    mockEvaluationLoaderService.loadEvaluationOrFail.mockResolvedValue(
      withRelations,
    );
    mockEvaluationJobsService.postScoreMappingsToQueue.mockResolvedValue(
      undefined,
    );

    const result = await service.create(
      "org-1",
      "project-1",
      {
        evaluationType: "type",
        evaluationScope: "dataset",
        name: "Eval",
        scoreIds: [],
      } as any,
      "user-1",
    );

    expect(result).toBe(withRelations);
    expect(mockAuditService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "evaluation.created",
        actorId: "user-1",
        resourceType: "evaluation",
        resourceId: "eval-1",
        organisationId: "org-1",
        projectId: "project-1",
        afterState: expect.any(Object),
        metadata: {
          creatorId: "user-1",
          organisationId: "org-1",
          projectId: "project-1",
        },
      }),
    );
    expect(
      mockEvaluationJobsService.postScoreMappingsToQueue,
    ).toHaveBeenCalled();
  });

  it("create does not throw when queueing fails", async () => {
    const saved = { id: "eval-1" };
    const withRelations = { id: "eval-1", scores: [], experiments: [] };
    mockEvaluationLoaderService.loadScores.mockResolvedValue([]);
    mockEvaluationLoaderService.loadExperiments.mockResolvedValue([]);
    mockEvaluationLoaderService.loadDataset.mockResolvedValue(null);
    mockEvaluationRepository.create.mockReturnValue(saved);
    mockEvaluationRepository.save.mockResolvedValue(saved);
    mockEvaluationLoaderService.loadEvaluationOrFail.mockResolvedValue(
      withRelations,
    );
    mockEvaluationJobsService.postScoreMappingsToQueue.mockRejectedValue(
      new Error("Queue failed"),
    );

    const result = await service.create(
      "org-1",
      "project-1",
      {
        evaluationType: "type",
        evaluationScope: "dataset",
        name: "Eval",
        scoreIds: [],
      } as any,
      "user-1",
    );

    expect(result).toBe(withRelations);
  });

  it("rerun throws when organisation mismatches", async () => {
    mockEvaluationRepository.findOne.mockResolvedValue({
      id: "eval-1",
      projectId: "project-1",
      project: { organisationId: "org-2" },
    });

    await expect(
      service.rerun("org-1", "project-1", "eval-1", "user-1"),
    ).rejects.toThrow(
      formatError(
        ERROR_MESSAGES.EVALUATION_NOT_FOUND_IN_ORGANISATION,
        "eval-1",
      ),
    );
  });

  it("rerun returns evaluation and queues jobs", async () => {
    const original = {
      id: "eval-1",
      name: "Eval",
      projectId: "project-1",
      project: { organisationId: "org-1" },
      scores: [],
      experiments: [],
      dataset: null,
      datasetId: null,
    };
    const saved = { id: "eval-2", projectId: "project-1" };
    const withRelations = { id: "eval-2", scores: [], experiments: [] };
    mockEvaluationRepository.findOne.mockResolvedValue(original);
    mockEvaluationRepository.create.mockReturnValue(saved);
    mockEvaluationRepository.save.mockResolvedValue(saved);
    mockEvaluationLoaderService.loadEvaluationOrFail.mockResolvedValue(
      withRelations,
    );
    mockEvaluationJobsService.postScoreMappingsToQueue.mockRejectedValue(
      new Error("Queue failed"),
    );

    const result = await service.rerun(
      "org-1",
      "project-1",
      "eval-1",
      "user-1",
    );

    expect(result).toBe(withRelations);
  });

  it("remove throws when organisation mismatches", async () => {
    mockEvaluationRepository.findOne.mockResolvedValue({
      id: "eval-1",
      projectId: "project-1",
      project: { organisationId: "org-2" },
    });

    await expect(
      service.remove("org-1", "project-1", "eval-1", "user-1"),
    ).rejects.toThrow(
      formatError(
        ERROR_MESSAGES.EVALUATION_NOT_FOUND_IN_ORGANISATION,
        "eval-1",
      ),
    );
  });

  it("remove deletes evaluation and records audit", async () => {
    const evaluation = {
      id: "eval-1",
      name: "Eval",
      projectId: "project-1",
      project: { organisationId: "org-1" },
    };
    mockEvaluationRepository.findOne.mockResolvedValue(evaluation);
    mockEvaluationRepository.remove.mockResolvedValue(evaluation);

    await service.remove("org-1", "project-1", "eval-1", "user-1");

    expect(mockEvaluationRepository.remove).toHaveBeenCalledWith(evaluation);
    expect(mockAuditService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "evaluation.deleted",
        actorId: "user-1",
        resourceType: "evaluation",
        resourceId: "eval-1",
        organisationId: "org-1",
        projectId: "project-1",
        beforeState: expect.objectContaining({
          id: "eval-1",
          name: "Eval",
          projectId: "project-1",
        }),
        afterState: null,
        metadata: { organisationId: "org-1", projectId: "project-1" },
      }),
    );
  });
});
