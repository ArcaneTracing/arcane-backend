import { Inject, Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { AllowAnonymous } from "@thallesp/nestjs-better-auth";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import {
  MESSAGE_BROKER,
  MessageBroker,
} from "../../common/message-broker/message-broker.interface";
import { EXPERIMENT_RESULTS_TOPIC } from "../../common/message-broker/topic-config";
import {
  ExperimentResult,
  ExperimentResultStatus,
} from "../entities/experiment-result.entity";
import { ExperimentResultQueueDto } from "./dto/experiment-result.dto";

function toLogString(value: unknown, fallback: string): string {
  if (value == null) return fallback;
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean")
    return String(value);
  return JSON.stringify(value);
}

@Injectable()
@AllowAnonymous()
export class ExperimentResultsProcessor implements OnModuleInit {
  private readonly logger = new Logger(ExperimentResultsProcessor.name);

  constructor(
    @Inject(MESSAGE_BROKER)
    private readonly broker: MessageBroker,
    @InjectRepository(ExperimentResult)
    private readonly experimentResultRepository: Repository<ExperimentResult>,
  ) {}

  onModuleInit(): void {
    this.broker.subscribe(EXPERIMENT_RESULTS_TOPIC, (payload) =>
      this.handleExperimentResult(payload),
    );
  }

  async handleExperimentResult(resultData: unknown): Promise<void> {
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
    if (!data.experimentId || !data.datasetRowId) {
      const error = new Error(
        `Invalid message format: missing required fields (experimentId or datasetRowId). Received: ${JSON.stringify(resultData)}`,
      );
      this.logger.error(error.message);
      throw error;
    }

    const expIdLog = toLogString(data.experimentId as string | undefined, "");
    const rowIdLog = toLogString(data.datasetRowId as string | undefined, "");
    const messageIdLog = toLogString(
      data.messageId as string | undefined,
      "n/a",
    );
    this.logger.debug(
      `Received result for experiment ${expIdLog}, row ${rowIdLog}, messageId=${messageIdLog}`,
    );

    try {
      await this.processResult(resultData as ExperimentResultQueueDto);
      this.logger.log(
        `Successfully processed result for experiment ${expIdLog}, row ${rowIdLog}`,
      );
    } catch (error: unknown) {
      const err = error as Error;
      this.logger.error(
        `Failed to process result for experiment ${expIdLog}, row ${rowIdLog}: ${err.message}`,
        err.stack,
      );
      throw error;
    }
  }

  private async processResult(
    resultData: ExperimentResultQueueDto,
  ): Promise<void> {
    this.logger.debug(
      `Processing result for experiment ${resultData.experimentId}, row ${resultData.datasetRowId}`,
    );

    try {
      const existingResult = await this.experimentResultRepository.findOne({
        where: {
          experimentId: resultData.experimentId,
          datasetRowId: resultData.datasetRowId,
        },
      });

      if (existingResult) {
        this.logger.debug(
          `Updating existing result for experiment ${resultData.experimentId}, row ${resultData.datasetRowId}`,
        );
        existingResult.result = resultData.error || resultData.result;
        existingResult.status = ExperimentResultStatus.DONE;
        await this.experimentResultRepository.save(existingResult);
        return;
      }

      const result = this.experimentResultRepository.create({
        experimentId: resultData.experimentId,
        datasetRowId: resultData.datasetRowId,
        result: resultData.error || resultData.result,
        status: ExperimentResultStatus.DONE,
      });

      await this.experimentResultRepository.save(result);

      this.logger.log(
        `Saved result for experiment ${resultData.experimentId}, row ${resultData.datasetRowId}, messageId=${resultData.messageId ?? "n/a"}`,
      );
    } catch (error: unknown) {
      const err = error as Error;
      this.logger.error(
        `Failed to save result for experiment ${resultData.experimentId}, row ${resultData.datasetRowId}: ${err.message}`,
        err.stack,
      );
      throw error;
    }
  }
}
