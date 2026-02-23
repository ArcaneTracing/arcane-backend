jest.mock("@thallesp/nestjs-better-auth", () => ({
  AllowAnonymous: () => () => {},
}));

import { ExperimentResultsProcessor } from "../../../src/experiments/queue/experiment-results.processor";
import {
  ExperimentResult,
  ExperimentResultStatus,
} from "../../../src/experiments/entities/experiment-result.entity";

describe("ExperimentResultsProcessor", () => {
  const mockBroker = { subscribe: jest.fn() };
  const mockExperimentResultRepository = {
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  };

  let processor: ExperimentResultsProcessor;

  beforeEach(() => {
    jest.clearAllMocks();
    processor = new ExperimentResultsProcessor(
      mockBroker as any,
      mockExperimentResultRepository as any,
    );
  });

  it("should parse string messages and create new results", async () => {
    const message = JSON.stringify({
      experimentId: "experiment-1",
      datasetRowId: "row-1",
      result: "ok",
    });
    mockExperimentResultRepository.findOne.mockResolvedValue(null);
    mockExperimentResultRepository.create.mockImplementation((input) => input);
    mockExperimentResultRepository.save.mockResolvedValue({ id: "result-1" });

    await processor.handleExperimentResult(message);

    expect(mockExperimentResultRepository.create).toHaveBeenCalledWith({
      experimentId: "experiment-1",
      datasetRowId: "row-1",
      result: "ok",
      status: ExperimentResultStatus.DONE,
    });
    expect(mockExperimentResultRepository.save).toHaveBeenCalled();
  });

  it("should update existing results", async () => {
    const existing: ExperimentResult = {
      id: "result-1",
      experimentId: "experiment-1",
      datasetRowId: "row-1",
      result: null,
      status: ExperimentResultStatus.PENDING,
    } as ExperimentResult;

    mockExperimentResultRepository.findOne.mockResolvedValue(existing);
    mockExperimentResultRepository.save.mockResolvedValue(existing);

    await processor.handleExperimentResult({
      experimentId: "experiment-1",
      datasetRowId: "row-1",
      result: "ok",
    });

    expect(existing.result).toBe("ok");
    expect(existing.status).toBe(ExperimentResultStatus.DONE);
    expect(mockExperimentResultRepository.save).toHaveBeenCalledWith(existing);
  });

  it("should throw for invalid JSON string messages", async () => {
    await expect(processor.handleExperimentResult("not-json")).rejects.toThrow(
      "Failed to parse message as JSON",
    );
  });

  it("should throw for missing required fields", async () => {
    await expect(
      processor.handleExperimentResult({ experimentId: "experiment-1" }),
    ).rejects.toThrow("Invalid message format: missing required fields");
  });

  it("should throw for empty message", async () => {
    await expect(processor.handleExperimentResult({})).rejects.toThrow(
      "Received null, undefined, or empty message",
    );
  });

  it("should accept and process message with messageId", async () => {
    mockExperimentResultRepository.findOne.mockResolvedValue(null);
    mockExperimentResultRepository.create.mockImplementation((input) => input);
    mockExperimentResultRepository.save.mockResolvedValue({ id: "result-1" });

    await processor.handleExperimentResult({
      experimentId: "experiment-1",
      datasetRowId: "row-1",
      result: "ok",
      messageId: "exp-1-row-1-1700000000000",
    });

    expect(mockExperimentResultRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        experimentId: "experiment-1",
        datasetRowId: "row-1",
        result: "ok",
        status: ExperimentResultStatus.DONE,
      }),
    );
    expect(mockExperimentResultRepository.save).toHaveBeenCalled();
  });
});
