import { ExperimentQueueService } from "../../../src/experiments/queue/experiment-queue.service";
import { EXPERIMENT_JOBS_TOPIC } from "../../../src/common/message-broker/topic-config";
import { ExperimentJobDto } from "../../../src/experiments/queue/dto/experiment-job.dto";
import { TestMessageBroker } from "../../../src/common/message-broker/test/test-message-broker";

describe("ExperimentQueueService", () => {
  const broker = new TestMessageBroker();

  const baseJob: ExperimentJobDto = {
    experimentId: "experiment-1",
    datasetRowId: "row-1",
    promptId: "prompt-1",
    inputs: { input1: "value" },
  };

  let service: ExperimentQueueService;

  beforeEach(() => {
    broker.clearPublished();
    broker.setPublishError(null);
    service = new ExperimentQueueService(broker);
  });

  it("should publish a single job and return messageId", async () => {
    jest.spyOn(Date, "now").mockReturnValue(1700000000000);

    const messageId = await service.addJob(baseJob);

    expect(broker.getPublished()).toEqual([
      {
        topic: EXPERIMENT_JOBS_TOPIC,
        message: { ...baseJob, messageId: "experiment-1-row-1-1700000000000" },
        options: { messageId: "experiment-1-row-1-1700000000000" },
      },
    ]);
    expect(messageId).toBe("experiment-1-row-1-1700000000000");
    (Date.now as jest.Mock).mockRestore();
  });

  it("should throw when publish rejects", async () => {
    broker.setPublishError(new Error("Broker error"));

    await expect(service.addJob(baseJob)).rejects.toThrow("Broker error");
  });

  it("should return only successful job IDs for bulk publish", async () => {
    jest.spyOn(Date, "now").mockReturnValue(1700000000000);
    broker.setPublishErrorSequence([
      null,
      new Error("Publish error"),
      new Error("Publish error"),
    ]);

    const result = await service.addJobs([
      baseJob,
      { ...baseJob, datasetRowId: "row-2" },
      { ...baseJob, datasetRowId: "row-3" },
    ]);

    expect(result).toEqual(["experiment-1-row-1-1700000000000"]);
    expect(broker.getPublished().length).toBe(1);
    (Date.now as jest.Mock).mockRestore();
  });
});
