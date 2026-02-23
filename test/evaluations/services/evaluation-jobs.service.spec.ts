import { EvaluationJobsService } from "../../../src/evaluations/services/core/evaluation-jobs.service";

describe("EvaluationJobsService", () => {
  const mockOrchestrator = {
    postEvaluationToQueue: jest.fn(),
  };

  let service: EvaluationJobsService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new EvaluationJobsService(mockOrchestrator as any);
  });

  it("delegates queue posting to orchestrator", async () => {
    mockOrchestrator.postEvaluationToQueue.mockResolvedValue(undefined);

    await service.postScoreMappingsToQueue({ id: "eval-1" } as any, null, []);

    expect(mockOrchestrator.postEvaluationToQueue).toHaveBeenCalledWith(
      { id: "eval-1" },
      null,
      [],
    );
  });
});
