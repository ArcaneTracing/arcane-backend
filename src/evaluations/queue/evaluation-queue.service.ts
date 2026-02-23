import { Inject, Injectable, Logger } from "@nestjs/common";
import {
  MESSAGE_BROKER,
  MessageBroker,
} from "../../common/message-broker/message-broker.interface";
import { EVALUATION_JOBS_TOPIC } from "../../common/message-broker/topic-config";
import { EvaluationJobDto } from "./dto/evaluation-job.dto";

@Injectable()
export class EvaluationQueueService {
  private readonly logger = new Logger(EvaluationQueueService.name);

  constructor(
    @Inject(MESSAGE_BROKER)
    private readonly broker: MessageBroker,
  ) {}

  async addJob(jobData: EvaluationJobDto): Promise<string> {
    const datasetRowId = jobData.datasetRowId || "null";
    const experimentResultId = jobData.experimentResultId || "null";

    this.logger.debug(
      `Adding job to queue for evaluation ${jobData.evaluationId}, scoreId: ${jobData.scoreId}, scoringType: ${jobData.scoringType}, datasetRowId: ${datasetRowId}, experimentResultId: ${experimentResultId}`,
    );

    const messageId = `${jobData.evaluationId}-${jobData.scoreId}-${datasetRowId}-${experimentResultId}-${Date.now()}`;
    const payload = { ...jobData, messageId };

    try {
      await this.broker.publish(EVALUATION_JOBS_TOPIC, payload, { messageId });
      this.logger.log(
        `✓ Successfully published job ${messageId} for evaluation ${jobData.evaluationId}`,
      );
      return messageId;
    } catch (error: unknown) {
      const err = error as Error;
      this.logger.error(
        `✗ Failed to publish job ${messageId} to queue: ${err.message}`,
        err.stack,
      );
      throw error;
    }
  }
}
