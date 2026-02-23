import { EvaluationQueueService } from "../../../src/evaluations/queue/evaluation-queue.service";
import { EVALUATION_JOBS_TOPIC } from "../../../src/common/message-broker/topic-config";
import { EvaluationJobDto } from "../../../src/evaluations/queue/dto/evaluation-job.dto";
import { TestMessageBroker } from "../../../src/common/message-broker/test/test-message-broker";

describe("EvaluationQueueService", () => {
  const broker = new TestMessageBroker();

  const baseJob: EvaluationJobDto = {
    evaluationId: "eval-1",
    ragasModelConfigurationId: null,
    scoreId: "score-1",
    scoringType: "NUMERIC",
    datasetRowId: null,
    experimentResultId: null,
    ragasScoreKey: null,
    scoreMapping: { input: "value" },
    promptId: null,
  };

  let service: EvaluationQueueService;

  beforeEach(() => {
    broker.clearPublished();
    broker.setPublishError(null);
    service = new EvaluationQueueService(broker);
  });

  it("publishes a job and returns messageId", async () => {
    jest.spyOn(Date, "now").mockReturnValue(1700000000000);

    const messageId = await service.addJob(baseJob);

    expect(broker.getPublished()).toEqual([
      {
        topic: EVALUATION_JOBS_TOPIC,
        message: {
          ...baseJob,
          messageId: "eval-1-score-1-null-null-1700000000000",
        },
        options: { messageId: "eval-1-score-1-null-null-1700000000000" },
      },
    ]);
    expect(messageId).toBe("eval-1-score-1-null-null-1700000000000");
    (Date.now as jest.Mock).mockRestore();
  });

  it("throws when publish rejects", async () => {
    broker.setPublishError(new Error("Broker error"));

    await expect(service.addJob(baseJob)).rejects.toThrow("Broker error");
  });
});
