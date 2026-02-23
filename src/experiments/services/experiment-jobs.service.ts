import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import {
  ERROR_MESSAGES,
  formatError,
} from "../../common/constants/error-messages.constants";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Experiment } from "../entities/experiment.entity";
import {
  ExperimentResult,
  ExperimentResultStatus,
} from "../entities/experiment-result.entity";
import { DatasetRow } from "../../datasets/entities/dataset-row.entity";
import { Dataset } from "../../datasets/entities/dataset.entity";
import { PromptVersion } from "../../prompts/entities/prompt-version.entity";
import { ExperimentQueueService } from "../queue/experiment-queue.service";
import { ExperimentJobDto } from "../queue/dto/experiment-job.dto";

@Injectable()
export class ExperimentJobsService {
  private readonly logger = new Logger(ExperimentJobsService.name);
  private readonly BATCH_SIZE = 1000;

  constructor(
    @InjectRepository(ExperimentResult)
    private readonly experimentResultRepository: Repository<ExperimentResult>,
    @InjectRepository(DatasetRow)
    private readonly datasetRowRepository: Repository<DatasetRow>,
    @InjectRepository(Dataset)
    private readonly datasetRepository: Repository<Dataset>,
    @InjectRepository(PromptVersion)
    private readonly promptVersionRepository: Repository<PromptVersion>,
    private readonly experimentQueueService: ExperimentQueueService,
  ) {}

  async queueForExperiment(experiment: Experiment): Promise<void> {
    this.logger.debug(`Queueing jobs for experiment ${experiment.id}`);

    const promptVersion = await this.getPromptVersionOrThrow(
      experiment.promptVersionId,
    );
    const dataset = await this.getDatasetOrThrow(experiment.datasetId);
    const promptId = promptVersion.promptId;

    let totalJobsQueued = 0;
    let skip = 0;

    while (true) {
      const datasetRows = await this.datasetRowRepository.find({
        where: { datasetId: experiment.datasetId },
        skip,
        take: this.BATCH_SIZE,
      });

      if (datasetRows.length === 0) {
        break;
      }

      await this.createPendingResults(experiment.id, datasetRows);

      const jobs = this.buildJobs(experiment, dataset, datasetRows, promptId);
      await this.experimentQueueService.addJobs(jobs);

      totalJobsQueued += jobs.length;
      skip += this.BATCH_SIZE;

      this.logger.debug(
        `Processed batch of ${datasetRows.length} rows for experiment ${experiment.id}`,
      );
    }

    if (totalJobsQueued === 0) {
      this.logger.warn(`No dataset rows found for experiment ${experiment.id}`);
      return;
    }

    this.logger.log(
      `Queued ${totalJobsQueued} jobs for experiment ${experiment.id}`,
    );
  }

  private async createPendingResults(
    experimentId: string,
    datasetRows: DatasetRow[],
  ): Promise<void> {
    const pendingResults = datasetRows.map((row) =>
      this.experimentResultRepository.create({
        experimentId,
        datasetRowId: row.id,
        status: ExperimentResultStatus.PENDING,
        result: null,
      }),
    );

    await this.experimentResultRepository.save(pendingResults);

    this.logger.log(
      `Created ${pendingResults.length} PENDING results for experiment ${experimentId}`,
    );
  }

  private async getPromptVersionOrThrow(
    promptVersionId: string,
  ): Promise<PromptVersion> {
    const promptVersion = await this.promptVersionRepository.findOne({
      where: { id: promptVersionId },
      relations: ["prompt", "modelConfiguration"],
    });

    if (!promptVersion) {
      throw new NotFoundException(
        `Prompt version ${promptVersionId} not found`,
      );
    }

    if (!promptVersion.modelConfiguration) {
      throw new NotFoundException(
        formatError(
          ERROR_MESSAGES.MODEL_CONFIGURATION_NOT_FOUND_FOR_PROMPT_VERSION,
          promptVersionId,
        ),
      );
    }

    return promptVersion;
  }

  private async getDatasetOrThrow(datasetId: string): Promise<Dataset> {
    const dataset = await this.datasetRepository.findOne({
      where: { id: datasetId },
    });

    if (!dataset) {
      throw new NotFoundException(
        formatError(ERROR_MESSAGES.DATASET_NOT_FOUND, datasetId),
      );
    }

    return dataset;
  }

  private buildJobs(
    experiment: Experiment,
    dataset: Dataset,
    datasetRows: DatasetRow[],
    promptId: string,
  ): ExperimentJobDto[] {
    const mappings = experiment.promptInputMappings || {};

    return datasetRows.map((row) => {
      const inputs = this.buildInputs(dataset, row, mappings);

      return {
        experimentId: experiment.id,
        datasetRowId: row.id,
        promptId,
        inputs,
      };
    });
  }

  private buildInputs(
    dataset: Dataset,
    row: DatasetRow,
    mappings: Record<string, string>,
  ): Record<string, unknown> {
    const inputs: Record<string, unknown> = {};

    for (let i = 0; i < dataset.header.length; i++) {
      const columnName = dataset.header[i];
      const promptInputName = mappings[columnName];

      if (promptInputName && row.values[i] !== undefined) {
        inputs[promptInputName] = row.values[i];
      }
    }

    return inputs;
  }
}
