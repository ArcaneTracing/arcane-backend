import { Inject, Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { AllowAnonymous } from "@thallesp/nestjs-better-auth";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import {
  MESSAGE_BROKER,
  MessageBroker,
} from "../../common/message-broker/message-broker.interface";
import { EVALUATION_RESULTS_TOPIC } from "../../common/message-broker/topic-config";
import {
  ScoreResult,
  ScoreResultStatus,
} from "../entities/score-result.entity";
import { EvaluationResultQueueDto } from "./dto/evaluation-result.dto";

function toLogString(value: unknown, fallback: string): string {
  if (value == null) return fallback;
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean")
    return String(value);
  return JSON.stringify(value);
}

@Injectable()
@AllowAnonymous()
export class EvaluationResultsProcessor implements OnModuleInit {
  private readonly logger = new Logger(EvaluationResultsProcessor.name);

  constructor(
    @Inject(MESSAGE_BROKER)
    private readonly broker: MessageBroker,
    @InjectRepository(ScoreResult)
    private readonly scoreResultRepository: Repository<ScoreResult>,
  ) {}

  onModuleInit(): void {
    this.broker.subscribe(EVALUATION_RESULTS_TOPIC, (payload) =>
      this.handleEvaluationResult(payload),
    );
  }

  async handleEvaluationResult(resultData: unknown): Promise<void> {
    this.logger.log(
      `Received message from queue: ${JSON.stringify(resultData)}`,
    );

    if (typeof resultData === "string") {
      try {
        resultData = JSON.parse(resultData);
        this.logger.log(
          `Parsed string message to JSON: ${JSON.stringify(resultData)}`,
        );
      } catch (parseError: unknown) {
        const err = parseError as Error;
        const rawPreview =
          typeof resultData === "string"
            ? resultData
            : JSON.stringify(resultData);
        const error = new Error(
          `Failed to parse message as JSON: ${err.message}. Raw message: ${rawPreview}`,
        );
        this.logger.error(error.message);
        throw error;
      }
    }

    if (
      !resultData ||
      (typeof resultData === "object" && Object.keys(resultData).length === 0)
    ) {
      const error = new Error(
        `Received null, undefined, or empty message: ${JSON.stringify(resultData)}`,
      );
      this.logger.error(error.message);
      throw error;
    }

    const data = resultData as Record<string, unknown>;
    if (!data.evaluationId || !data.scoreId || data.score === undefined) {
      const error = new Error(
        `Invalid message format: missing required fields (evaluationId, scoreId, or score). Received: ${JSON.stringify(resultData)}`,
      );
      this.logger.error(error.message);
      throw error;
    }

    const evalIdLog = toLogString(data.evaluationId as string | undefined, "");
    const scoreIdLog = toLogString(data.scoreId as string | undefined, "");
    const messageIdLog = toLogString(
      data.messageId as string | undefined,
      "n/a",
    );
    this.logger.debug(
      `Received result for evaluation ${evalIdLog}, scoreId ${scoreIdLog}, messageId=${messageIdLog}`,
    );

    try {
      await this.processResult(resultData as EvaluationResultQueueDto);
      this.logger.log(
        `Successfully processed result for evaluation ${evalIdLog}, scoreId ${scoreIdLog}`,
      );
    } catch (error: unknown) {
      const err = error as Error;
      this.logger.error(
        `Failed to process result for evaluation ${evalIdLog}, scoreId ${scoreIdLog}: ${err.message}`,
        err.stack,
      );
      throw error;
    }
  }

  private toNumericValue(score: string | number): number | null {
    if (typeof score === "number" && !Number.isNaN(score)) return score;
    if (typeof score === "string") {
      const trimmed = score.trim();
      if (trimmed === "" || trimmed.toLowerCase() === "n/a") return null;
      const num = Number(trimmed);
      return Number.isNaN(num) ? null : num;
    }
    return null;
  }

  private async processResult(
    resultData: EvaluationResultQueueDto,
  ): Promise<void> {
    this.logger.debug(
      `Processing result for evaluation ${resultData.evaluationId}, scoreId ${resultData.scoreId}`,
    );

    try {
      const whereClause: Record<string, unknown> = {
        evaluationId: resultData.evaluationId,
        scoreId: resultData.scoreId,
      };

      if (resultData.datasetRowId) {
        whereClause.datasetRowId = resultData.datasetRowId;
      } else {
        whereClause.datasetRowId = null;
      }

      if (resultData.experimentResultId) {
        whereClause.experimentResultId = resultData.experimentResultId;
      } else {
        whereClause.experimentResultId = null;
      }

      const existingResult = await this.scoreResultRepository.findOne({
        where: whereClause,
      });

      if (existingResult) {
        this.logger.debug(
          `Updating existing result for evaluation ${resultData.evaluationId}, scoreId ${resultData.scoreId}`,
        );
        existingResult.value = this.toNumericValue(resultData.score);
        if (resultData.reasoning !== undefined) {
          existingResult.reasoning = resultData.reasoning;
        }
        existingResult.status = ScoreResultStatus.DONE;
        await this.scoreResultRepository.save(existingResult);
        return;
      }

      const result = this.scoreResultRepository.create({
        evaluationId: resultData.evaluationId,
        scoreId: resultData.scoreId,
        datasetRowId: resultData.datasetRowId ?? null,
        experimentResultId: resultData.experimentResultId ?? null,
        value: this.toNumericValue(resultData.score),
        reasoning: resultData.reasoning ?? null,
        status: ScoreResultStatus.DONE,
      });

      await this.scoreResultRepository.save(result);

      this.logger.log(
        `Saved result for evaluation ${resultData.evaluationId}, scoreId ${resultData.scoreId}, messageId=${resultData.messageId ?? "n/a"}`,
      );
    } catch (error: unknown) {
      const err = error as Error;
      this.logger.error(
        `Failed to save result for evaluation ${resultData.evaluationId}, scoreId ${resultData.scoreId}: ${err.message}`,
        err.stack,
      );
      throw error;
    }
  }
}
