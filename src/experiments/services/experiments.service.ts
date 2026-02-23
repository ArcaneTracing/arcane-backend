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
import { PromptVersion } from "../../prompts/entities/prompt-version.entity";
import { Dataset } from "../../datasets/entities/dataset.entity";
import { DatasetRow } from "../../datasets/entities/dataset-row.entity";
import { CreateExperimentRequestDto } from "../dto/request/create-experiment-request.dto";
import { CreateExperimentResultRequestDto } from "../dto/request/create-experiment-result-request.dto";
import {
  ExperimentResponseDto,
  ExperimentResultResponseDto,
} from "../dto/response/experiment-response.dto";
import { ExperimentMapper } from "../mappers/experiment.mapper";
import { ExperimentJobsService } from "./experiment-jobs.service";
import { AuditService } from "../../audit/audit.service";
import { PaginationQueryDto } from "../../common/dto/pagination.dto";
import {
  PaginatedExperimentResultsResponseDto,
  CombinedExperimentResultResponseDto,
} from "../dto/response/paginated-experiment-result.dto";
import { DatasetMapper } from "../../datasets/mappers";

@Injectable()
export class ExperimentsService {
  private readonly logger = new Logger(ExperimentsService.name);

  constructor(
    @InjectRepository(Experiment)
    private readonly experimentRepository: Repository<Experiment>,
    @InjectRepository(ExperimentResult)
    private readonly experimentResultRepository: Repository<ExperimentResult>,
    @InjectRepository(PromptVersion)
    private readonly promptVersionRepository: Repository<PromptVersion>,
    @InjectRepository(Dataset)
    private readonly datasetRepository: Repository<Dataset>,
    @InjectRepository(DatasetRow)
    private readonly datasetRowRepository: Repository<DatasetRow>,
    private readonly experimentJobsService: ExperimentJobsService,
    private readonly auditService: AuditService,
  ) {}

  private toAuditState(e: Experiment): Record<string, unknown> {
    return {
      id: e.id,
      name: e.name,
      description: e.description ?? null,
      projectId: e.projectId,
      promptVersionId: e.promptVersionId,
      datasetId: e.datasetId,
      promptInputMappings: e.promptInputMappings ?? {},
      createdById: e.createdById ?? null,
    };
  }

  private async resolvePromptVersion(
    projectId: string,
    promptVersionId: string,
  ): Promise<PromptVersion> {
    const promptVersion = await this.promptVersionRepository.findOne({
      where: { id: promptVersionId },
      relations: ["prompt"],
    });

    if (promptVersion?.prompt?.projectId !== projectId) {
      throw new NotFoundException(
        formatError(ERROR_MESSAGES.PROMPT_VERSION_NOT_FOUND, promptVersionId),
      );
    }

    return promptVersion;
  }

  private async resolveDataset(
    projectId: string,
    datasetId: string,
  ): Promise<Dataset> {
    const dataset = await this.datasetRepository.findOne({
      where: { id: datasetId, projectId },
    });

    if (!dataset) {
      throw new NotFoundException(
        formatError(
          ERROR_MESSAGES.DATASET_NOT_FOUND_IN_PROJECT,
          datasetId,
          projectId,
        ),
      );
    }

    return dataset;
  }

  private async getExperimentOrThrow(
    projectId: string,
    experimentId: string,
    relations: string[] = [],
  ): Promise<Experiment> {
    const experiment = await this.experimentRepository.findOne({
      where: { id: experimentId, projectId },
      relations,
    });

    if (!experiment) {
      throw new NotFoundException(
        formatError(
          ERROR_MESSAGES.EXPERIMENT_NOT_FOUND_IN_PROJECT,
          experimentId,
        ),
      );
    }

    return experiment;
  }

  private async getDatasetRowOrThrow(
    datasetRowId: string,
    datasetId: string,
  ): Promise<DatasetRow> {
    const datasetRow = await this.datasetRowRepository.findOne({
      where: { id: datasetRowId },
    });

    if (datasetRow?.datasetId !== datasetId) {
      throw new NotFoundException(
        `Dataset row ${datasetRowId} not found for experiment dataset ${datasetId}`,
      );
    }

    return datasetRow;
  }

  async create(
    projectId: string,
    dto: CreateExperimentRequestDto,
    userId: string,
    organisationId: string,
  ): Promise<ExperimentResponseDto> {
    const promptVersion = await this.resolvePromptVersion(
      projectId,
      dto.promptVersionId,
    );
    const dataset = await this.resolveDataset(projectId, dto.datasetId);

    const saved = await this.experimentRepository.save(
      ExperimentMapper.toEntity({
        projectId,
        promptVersion,
        dataset,
        userId,
        name: dto.name,
        description: dto.description,
        promptInputMappings: dto.promptInputMappings,
      }),
    );

    await this.auditService.record({
      action: "experiment.created",
      actorId: userId,
      actorType: "user",
      resourceType: "experiment",
      resourceId: saved.id,
      organisationId,
      projectId,
      afterState: this.toAuditState(saved),
      metadata: { creatorId: userId, organisationId, projectId },
    });

    try {
      await this.experimentJobsService.queueForExperiment(saved);
    } catch (error) {
      this.logger.error(
        `Failed to queue experiment jobs for experiment ${saved.id}: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }

    return ExperimentMapper.toDto(saved);
  }

  async findAll(projectId: string): Promise<ExperimentResponseDto[]> {
    const experiments = await this.experimentRepository.find({
      where: { projectId },
      order: { createdAt: "DESC" },
    });

    return experiments.map((experiment) => ExperimentMapper.toDto(experiment));
  }

  async findOne(
    projectId: string,
    experimentId: string,
  ): Promise<ExperimentResponseDto> {
    const experiment = await this.getExperimentOrThrow(
      projectId,
      experimentId,
      ["results"],
    );

    return ExperimentMapper.toDto(experiment, true);
  }

  async rerun(
    projectId: string,
    experimentId: string,
    userId: string,
    organisationId: string,
  ): Promise<ExperimentResponseDto> {
    const originalExperiment = await this.getExperimentOrThrow(
      projectId,
      experimentId,
      ["promptVersion", "dataset"],
    );

    const now = new Date();
    const rerunName = `Re-run ${originalExperiment.name} ${now.toISOString()}`;

    const saved = await this.experimentRepository.save(
      ExperimentMapper.toEntity({
        projectId: originalExperiment.projectId,
        promptVersion: originalExperiment.promptVersion,
        dataset: originalExperiment.dataset,
        userId,
        name: rerunName,
        description: originalExperiment.description,
        promptInputMappings: originalExperiment.promptInputMappings,
      }),
    );

    await this.auditService.record({
      action: "experiment.rerun",
      actorId: userId,
      actorType: "user",
      resourceType: "experiment",
      resourceId: saved.id,
      organisationId,
      projectId: saved.projectId,
      afterState: this.toAuditState(saved),
      metadata: {
        sourceExperimentId: experimentId,
        organisationId,
        projectId: saved.projectId,
        creatorId: userId,
      },
    });

    await this.experimentJobsService.queueForExperiment(saved);

    return ExperimentMapper.toDto(saved);
  }

  async remove(
    projectId: string,
    experimentId: string,
    userId?: string,
    organisationId?: string,
  ): Promise<void> {
    const experiment = await this.getExperimentOrThrow(projectId, experimentId);
    const beforeState = this.toAuditState(experiment);

    await this.experimentRepository.remove(experiment);

    if (organisationId) {
      await this.auditService.record({
        action: "experiment.deleted",
        actorId: userId,
        actorType: "user",
        resourceType: "experiment",
        resourceId: experimentId,
        organisationId,
        projectId: experiment.projectId,
        beforeState,
        afterState: null,
        metadata: { organisationId, projectId: experiment.projectId },
      });
    }
  }

  async createResult(
    projectId: string,
    experimentId: string,
    dto: CreateExperimentResultRequestDto,
  ): Promise<ExperimentResultResponseDto> {
    const experiment = await this.getExperimentOrThrow(projectId, experimentId);
    const datasetRow = await this.getDatasetRowOrThrow(
      dto.datasetRowId,
      experiment.datasetId,
    );
    const saved = await this.experimentResultRepository.save({
      experimentId: experiment.id,
      datasetRowId: datasetRow.id,
      result: dto.result,
      status: ExperimentResultStatus.DONE,
    });
    return ExperimentMapper.toResultDto(saved);
  }

  async listResults(
    projectId: string,
    experimentId: string,
  ): Promise<ExperimentResultResponseDto[]> {
    const experiment = await this.getExperimentOrThrow(projectId, experimentId);

    const results = await this.experimentResultRepository.find({
      where: { experimentId: experiment.id },
      order: { createdAt: "DESC" },
    });

    return results.map((result) => ExperimentMapper.toResultDto(result));
  }

  async listResultsPaginated(
    projectId: string,
    experimentId: string,
    query: PaginationQueryDto,
  ): Promise<PaginatedExperimentResultsResponseDto> {
    const { page = 1, limit = 20, search, sortBy, sortOrder = "desc" } = query;
    const skip = (page - 1) * limit;

    this.logger.debug(
      `Finding paginated experiment results for experiment ${experimentId} in project ${projectId}, page ${page}, limit ${limit}`,
    );

    const experiment = await this.getExperimentOrThrow(projectId, experimentId);

    const queryBuilder = this.experimentResultRepository
      .createQueryBuilder("result")
      .leftJoinAndSelect("result.datasetRow", "datasetRow")
      .where("result.experimentId = :experimentId", {
        experimentId: experiment.id,
      });

    if (search) {
      queryBuilder.andWhere(
        "(result.result ILIKE :search OR datasetRow.values::text ILIKE :search)",
        { search: `%${search}%` },
      );
    }

    const validSortFields = ["createdAt", "result"];
    const sortField = validSortFields.includes(sortBy || "")
      ? sortBy
      : "createdAt";
    if (sortField === "result") {
      queryBuilder.orderBy(
        "result.result",
        sortOrder.toUpperCase() as "ASC" | "DESC",
      );
    } else {
      queryBuilder.orderBy(
        `result.${sortField}`,
        sortOrder.toUpperCase() as "ASC" | "DESC",
      );
    }

    const total = await queryBuilder.getCount();

    queryBuilder.skip(skip).take(limit);

    const results = await queryBuilder.getMany();

    const items: CombinedExperimentResultResponseDto[] = results.map(
      (result) => ({
        datasetRow: DatasetMapper.toRowDto(result.datasetRow),
        experimentResult: result.result,
        experimentResultId: result.id,
        createdAt: result.createdAt,
      }),
    );

    const totalPages = Math.ceil(total / limit);

    return {
      data: items,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
      },
    };
  }
}
