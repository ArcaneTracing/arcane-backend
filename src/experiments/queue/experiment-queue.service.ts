import { Inject, Injectable, Logger } from "@nestjs/common";
import {
  MESSAGE_BROKER,
  MessageBroker,
} from "../../common/message-broker/message-broker.interface";
import { EXPERIMENT_JOBS_TOPIC } from "../../common/message-broker/topic-config";
import { ExperimentJobDto } from "./dto/experiment-job.dto";

@Injectable()
export class ExperimentQueueService {
  private readonly logger = new Logger(ExperimentQueueService.name);

  constructor(
    @Inject(MESSAGE_BROKER)
    private readonly broker: MessageBroker,
  ) {}

  async addJob(jobData: ExperimentJobDto): Promise<string> {
    this.logger.debug(
      `Adding job to queue for experiment ${jobData.experimentId}, row ${jobData.datasetRowId}`,
    );

    const messageId = `${jobData.experimentId}-${jobData.datasetRowId}-${Date.now()}`;
    const payload = { ...jobData, messageId };

    try {
      await this.broker.publish(EXPERIMENT_JOBS_TOPIC, payload, { messageId });
      this.logger.log(
        `✓ Successfully published job ${messageId} for experiment ${jobData.experimentId}, row ${jobData.datasetRowId}`,
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

  async addJobs(jobsData: ExperimentJobDto[]): Promise<string[]> {
    this.logger.debug(`Adding ${jobsData.length} jobs to queue`);

    const jobIds: string[] = [];

    for (const jobData of jobsData) {
      const messageId = `${jobData.experimentId}-${jobData.datasetRowId}-${Date.now()}`;
      const payload = { ...jobData, messageId };

      try {
        await this.broker.publish(EXPERIMENT_JOBS_TOPIC, payload, {
          messageId,
        });
        this.logger.log(
          `✓ Successfully published job ${messageId} for experiment ${jobData.experimentId}, row ${jobData.datasetRowId}`,
        );
        jobIds.push(messageId);
      } catch (error: unknown) {
        const err = error as Error;
        this.logger.error(
          `✗ Failed to publish job ${messageId} for experiment ${jobData.experimentId}, row ${jobData.datasetRowId}: ${err.message}`,
          err.stack,
        );
      }
    }

    this.logger.log(
      `Added ${jobIds.length} out of ${jobsData.length} jobs to queue`,
    );
    return jobIds;
  }
}
