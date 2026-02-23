import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import {
  ERROR_MESSAGES,
  formatError,
} from "../../common/constants/error-messages.constants";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Dataset } from "../entities/dataset.entity";
import { DatasetRow } from "../entities/dataset-row.entity";
import { CreateDatasetRequestDto } from "../dto/request/create-dataset.dto";
import { UpdateDatasetRequestDto } from "../dto/request/update-dataset.dto";
import { UpsertRowToDatasetRequestDto } from "../dto/request/upsert-row-to-dataset.dto";
import { DatasetListItemResponseDto } from "../dto/response/dataset-list-item.dto";
import { DatasetRowResponseDto } from "../dto/response/dataset-row.dto";
import { DatasetHeaderResponseDto } from "../dto/response/dataset-header.dto";
import { DatasetMessageResponseDto } from "../dto/response/dataset-message-response.dto";
import { DatasetMapper } from "../mappers";
import { DatasetResponseDto } from "../dto/response/dataset.dto";
import { AuditService } from "../../audit/audit.service";
import { PaginationQueryDto } from "../../common/dto/pagination.dto";
import { PaginatedDatasetResponseDto } from "../dto/response/paginated-dataset.dto";

@Injectable()
export class DatasetsService {
  private readonly logger = new Logger(DatasetsService.name);

  constructor(
    @InjectRepository(Dataset)
    private readonly datasetRepository: Repository<Dataset>,
    @InjectRepository(DatasetRow)
    private readonly datasetRowRepository: Repository<DatasetRow>,
    private readonly auditService: AuditService,
  ) {}

  private toAuditState(d: Dataset): Record<string, unknown> {
    return {
      id: d.id,
      name: d.name,
      description: d.description ?? null,
      header: d.header ?? [],
      projectId: d.projectId,
    };
  }

  private async getDatasetOrThrow(
    projectId: string,
    datasetId: string,
    relations: Array<string> = [],
  ): Promise<Dataset> {
    const dataset = await this.datasetRepository.findOne({
      where: { id: datasetId, projectId },
      relations,
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

  private async mapToDatasetDto(dataset: Dataset): Promise<DatasetResponseDto> {
    const rows = (dataset.rows || []).map((row) => DatasetMapper.toRowDto(row));
    return DatasetMapper.toDto(dataset, rows);
  }

  async create(
    projectId: string,
    createDatasetDto: CreateDatasetRequestDto,
    userId: string,
    organisationId: string,
  ): Promise<DatasetResponseDto> {
    this.logger.debug(`Creating dataset for project ${projectId}`);

    const dataset = this.datasetRepository.create({
      name: createDatasetDto.name,
      description: createDatasetDto.description,
      header: createDatasetDto.header,
      projectId,
      createdById: userId,
      rows: [],
    });

    const savedDataset = await this.datasetRepository.save(dataset);
    this.logger.log(
      `Created dataset ${savedDataset.id} for project ${projectId}`,
    );

    await this.auditService.record({
      action: "dataset.created",
      actorId: userId,
      actorType: "user",
      resourceType: "dataset",
      resourceId: savedDataset.id,
      organisationId,
      projectId,
      afterState: this.toAuditState(savedDataset),
      metadata: { creatorId: userId, organisationId, projectId },
    });

    return this.mapToDatasetDto(savedDataset);
  }

  async findAll(projectId: string): Promise<DatasetListItemResponseDto[]> {
    this.logger.debug(`Finding all datasets for project ${projectId}`);
    const datasets = await this.datasetRepository.find({
      where: { projectId: projectId },
      order: { createdAt: "DESC" },
    });

    return datasets.map((dataset) => DatasetMapper.toListItemDto(dataset));
  }

  async findOne(
    projectId: string,
    datasetId: string,
  ): Promise<DatasetResponseDto> {
    this.logger.debug(`Finding dataset ${datasetId} in project ${projectId}`);
    const dataset = await this.getDatasetOrThrow(projectId, datasetId, [
      "rows",
    ]);

    return this.mapToDatasetDto(dataset);
  }

  async findOnePaginated(
    projectId: string,
    datasetId: string,
    query: PaginationQueryDto,
  ): Promise<PaginatedDatasetResponseDto> {
    const { page = 1, limit = 20, search, sortBy, sortOrder = "asc" } = query;
    const skip = (page - 1) * limit;

    this.logger.debug(
      `Finding paginated dataset rows for dataset ${datasetId} in project ${projectId}, page ${page}, limit ${limit}`,
    );

    const dataset = await this.getDatasetOrThrow(projectId, datasetId, []);

    const queryBuilder = this.datasetRowRepository
      .createQueryBuilder("row")
      .where("row.datasetId = :datasetId", { datasetId })
      .orderBy("row.id", "ASC");

    if (search) {
      queryBuilder.andWhere("row.values::text ILIKE :search", {
        search: `%${search}%`,
      });
    }

    if (sortBy && sortBy !== "id") {
      const columnIndex = Number.parseInt(sortBy, 10);
      if (
        !Number.isNaN(columnIndex) &&
        columnIndex >= 0 &&
        columnIndex < dataset.header.length
      ) {
        queryBuilder.orderBy(
          `row.values->>${columnIndex}`,
          sortOrder.toUpperCase() as "ASC" | "DESC",
        );
      }
    } else {
      queryBuilder.orderBy("row.id", sortOrder.toUpperCase() as "ASC" | "DESC");
    }

    const total = await queryBuilder.getCount();

    queryBuilder.skip(skip).take(limit);

    const rows = await queryBuilder.getMany();

    const rowDtos = rows.map((row) => DatasetMapper.toRowDto(row));

    const totalPages = Math.ceil(total / limit);

    return {
      id: dataset.id,
      name: dataset.name,
      description: dataset.description,
      header: dataset.header,
      data: rowDtos,
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

  async findHeader(
    projectId: string,
    datasetId: string,
  ): Promise<DatasetHeaderResponseDto> {
    this.logger.debug(
      `Finding header for dataset ${datasetId} in project ${projectId}`,
    );
    const dataset = await this.getDatasetOrThrow(projectId, datasetId);

    return { header: dataset.header };
  }

  async update(
    projectId: string,
    datasetId: string,
    updateDatasetDto: UpdateDatasetRequestDto,
    userId?: string,
    organisationId?: string,
  ): Promise<DatasetResponseDto> {
    this.logger.debug(`Updating dataset ${datasetId} in project ${projectId}`);

    const dataset = await this.getDatasetOrThrow(projectId, datasetId);

    const beforeState = this.toAuditState(dataset);

    if (updateDatasetDto.name !== undefined) {
      dataset.name = updateDatasetDto.name;
    }
    if (updateDatasetDto.description !== undefined) {
      dataset.description = updateDatasetDto.description;
    }

    const updatedDataset = await this.datasetRepository.save(dataset);
    this.logger.log(`Updated dataset ${datasetId} in project ${projectId}`);

    if (organisationId) {
      await this.auditService.record({
        action: "dataset.updated",
        actorId: userId,
        actorType: "user",
        resourceType: "dataset",
        resourceId: datasetId,
        organisationId,
        projectId,
        beforeState,
        afterState: this.toAuditState(updatedDataset),
        metadata: {
          changedFields: Object.keys(updateDatasetDto),
          organisationId,
          projectId,
        },
      });
    }

    return this.mapToDatasetDto(updatedDataset);
  }

  async remove(
    projectId: string,
    datasetId: string,
    userId?: string,
    organisationId?: string,
  ): Promise<DatasetMessageResponseDto> {
    this.logger.debug(
      `Removing dataset ${datasetId} from project ${projectId}`,
    );

    const dataset = await this.getDatasetOrThrow(projectId, datasetId);

    const beforeState = this.toAuditState(dataset);

    await this.datasetRepository.remove(dataset);
    this.logger.log(`Removed dataset ${datasetId} from project ${projectId}`);

    if (organisationId) {
      await this.auditService.record({
        action: "dataset.deleted",
        actorId: userId,
        actorType: "user",
        resourceType: "dataset",
        resourceId: datasetId,
        organisationId,
        projectId,
        beforeState,
        afterState: null,
        metadata: { organisationId, projectId },
      });
    }

    return { message: "Dataset deleted successfully" };
  }

  async upsertRow(
    projectId: string,
    datasetId: string,
    upsertRowDto: UpsertRowToDatasetRequestDto,
  ): Promise<DatasetRowResponseDto> {
    this.logger.debug(
      `Adding row to dataset ${datasetId} in project ${projectId}`,
    );

    const dataset = await this.getDatasetOrThrow(projectId, datasetId);

    if (!Array.isArray(upsertRowDto.values)) {
      throw new BadRequestException(
        formatError(ERROR_MESSAGES.INVALID_REQUEST_BODY),
      );
    }

    if (upsertRowDto.values.length !== dataset.header.length) {
      throw new BadRequestException(
        formatError(
          ERROR_MESSAGES.VALUES_ARRAY_LENGTH_MISMATCH,
          upsertRowDto.values.length,
          dataset.header.length,
        ),
      );
    }

    const savedRow = await this.datasetRowRepository.save({
      values: upsertRowDto.values,
      dataset: dataset,
      datasetId: dataset.id,
    });
    this.logger.log(
      `Added row ${savedRow.id} to dataset ${datasetId} in project ${projectId}`,
    );

    return DatasetMapper.toRowDto(savedRow);
  }
}
