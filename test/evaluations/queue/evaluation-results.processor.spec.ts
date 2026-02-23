jest.mock("@thallesp/nestjs-better-auth", () => ({
  AllowAnonymous: () => () => {},
}));

import { EvaluationResultsProcessor } from "../../../src/evaluations/queue/evaluation-results.processor";
import { ScoreResultStatus } from "../../../src/evaluations/entities/score-result.entity";

describe("EvaluationResultsProcessor", () => {
  const mockBroker = { subscribe: jest.fn() };
  const mockScoreResultRepository = {
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  };

  let processor: EvaluationResultsProcessor;

  beforeEach(() => {
    jest.clearAllMocks();
    processor = new EvaluationResultsProcessor(
      mockBroker as any,
      mockScoreResultRepository as any,
    );
  });

  it("parses string messages and creates new results", async () => {
    const message = JSON.stringify({
      evaluationId: "eval-1",
      scoreId: "score-1",
      score: 0.5,
    });
    mockScoreResultRepository.findOne.mockResolvedValue(null);
    mockScoreResultRepository.create.mockImplementation((input) => input);
    mockScoreResultRepository.save.mockResolvedValue({ id: "sr-1" });

    await processor.handleEvaluationResult(message);

    expect(mockScoreResultRepository.create).toHaveBeenCalledWith({
      evaluationId: "eval-1",
      scoreId: "score-1",
      datasetRowId: null,
      experimentResultId: null,
      value: 0.5,
      reasoning: null,
      status: ScoreResultStatus.DONE,
    });
  });

  it("throws for empty messages", async () => {
    await expect(processor.handleEvaluationResult({})).rejects.toThrow(
      "Received null, undefined, or empty message",
    );
  });

  it("throws for missing required fields", async () => {
    await expect(
      processor.handleEvaluationResult({ evaluationId: "eval-1" }),
    ).rejects.toThrow("Invalid message format: missing required fields");
  });

  it("updates existing results when found", async () => {
    const existing = {
      id: "sr-1",
      evaluationId: "eval-1",
      scoreId: "score-1",
      value: null,
      reasoning: null,
      status: ScoreResultStatus.PENDING,
    };
    mockScoreResultRepository.findOne.mockResolvedValue(existing);
    mockScoreResultRepository.save.mockResolvedValue(existing);

    await processor.handleEvaluationResult({
      evaluationId: "eval-1",
      scoreId: "score-1",
      score: 0.9,
      reasoning: "ok",
      datasetRowId: "row-1",
    });

    expect(existing.value).toBe(0.9);
    expect(existing.reasoning).toBe("ok");
    expect(existing.status).toBe(ScoreResultStatus.DONE);
    expect(mockScoreResultRepository.save).toHaveBeenCalledWith(existing);
  });

  it("throws for invalid JSON strings", async () => {
    await expect(processor.handleEvaluationResult("not-json")).rejects.toThrow(
      "Failed to parse message as JSON",
    );
  });

  it("accepts and processes message with messageId", async () => {
    mockScoreResultRepository.findOne.mockResolvedValue(null);
    mockScoreResultRepository.create.mockImplementation((input) => input);
    mockScoreResultRepository.save.mockResolvedValue({ id: "sr-1" });

    await processor.handleEvaluationResult({
      evaluationId: "eval-1",
      scoreId: "score-1",
      score: 0.5,
      messageId: "eval-1-score-1-1700000000000",
    });

    expect(mockScoreResultRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        evaluationId: "eval-1",
        scoreId: "score-1",
        value: 0.5,
        status: ScoreResultStatus.DONE,
      }),
    );
    expect(mockScoreResultRepository.save).toHaveBeenCalled();
  });
});
