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
import { parse } from "csv-parse";
import { stringify } from "csv-stringify";
import { Readable } from "node:stream";
import { Repository } from "typeorm";
import { Dataset } from "../entities/dataset.entity";
import { DatasetRow } from "../entities/dataset-row.entity";
import { DatasetResponseDto } from "../dto/response/dataset.dto";
import { DatasetMapper } from "../mappers";
import { AuditService } from "../../audit/audit.service";

@Injectable()
export class DatasetsCsvService {
  private readonly logger = new Logger(DatasetsCsvService.name);

  constructor(
    @InjectRepository(Dataset)
    private readonly datasetRepository: Repository<Dataset>,
    private readonly auditService: AuditService,
  ) {}

  private async getDatasetOrThrow(
    projectId: string,
    datasetId: string,
  ): Promise<Dataset> {
    const dataset = await this.datasetRepository.findOne({
      where: { id: datasetId, projectId },
      relations: ["rows"],
    });

    if (!dataset) {
      throw new NotFoundException(
        `Dataset with ID ${datasetId} not found in project ${projectId}`,
      );
    }

    return dataset;
  }

  private validateHeader(header: string[]): string[] {
    const normalized = header.map((value) => value.trim());
    if (normalized.length === 0) {
      throw new BadRequestException(
        formatError(ERROR_MESSAGES.CSV_HEADER_EMPTY),
      );
    }
    if (normalized.every((value) => value.length === 0)) {
      throw new BadRequestException(
        formatError(ERROR_MESSAGES.CSV_HEADER_EMPTY),
      );
    }

    const seen = new Set<string>();
    for (const value of normalized) {
      if (value.length === 0) {
        throw new BadRequestException(
          formatError(ERROR_MESSAGES.CSV_HEADER_CONTAINS_EMPTY_COLUMN_NAMES),
        );
      }
      if (seen.has(value)) {
        throw new BadRequestException(
          formatError(
            ERROR_MESSAGES.CSV_HEADER_CONTAINS_DUPLICATE_COLUMN_NAMES,
          ),
        );
      }
      seen.add(value);
    }

    return normalized;
  }

  private *buildCsvRows(dataset: Dataset): Iterable<string[]> {
    yield dataset.header;

    for (const row of dataset.rows) {
      const rowValues = [...row.values];
      while (rowValues.length < dataset.header.length) {
        rowValues.push("");
      }
      yield rowValues.slice(0, dataset.header.length);
    }
  }

  async createFromCsv(
    projectId: string,
    csvContent: string,
    name: string,
    userId: string,
    description?: string,
    organisationId?: string,
  ): Promise<DatasetResponseDto> {
    this.logger.debug(`Creating dataset from CSV for project ${projectId}`);
    const batchSize = 500;
    const parser = parse({
      columns: false,
      skip_empty_lines: true,
      relax_quotes: true,
      relax_column_count: false,
      bom: true,
      trim: true,
    });

    return this.datasetRepository.manager.transaction(async (manager) => {
      const datasetRepo = manager.getRepository(Dataset);
      const rowRepo = manager.getRepository(DatasetRow);

      const rowsToInsert: DatasetRow[] = [];
      let savedDataset: Dataset | null = null;
      let header: string[] | null = null;
      let rowCount = 0;

      try {
        for await (const record of Readable.from(csvContent).pipe(parser)) {
          if (!header) {
            header = this.validateHeader(record as string[]);
            savedDataset = datasetRepo.create({
              name,
              description,
              header,
              projectId: projectId,
              createdById: userId,
              rows: [],
            });
            savedDataset = await datasetRepo.save(savedDataset);
            continue;
          }

          if (record.length !== header.length) {
            throw new BadRequestException(
              formatError(
                ERROR_MESSAGES.CSV_ROW_COLUMN_MISMATCH,
                rowCount + 2,
                record.length,
                header.length,
              ),
            );
          }

          rowsToInsert.push(
            rowRepo.create({
              values: record as string[],
              datasetId: savedDataset.id,
            }),
          );
          rowCount += 1;

          if (rowsToInsert.length >= batchSize) {
            await rowRepo.save(rowsToInsert);
            rowsToInsert.length = 0;
          }
        }
      } catch (error) {
        this.logger.error(`Failed to parse CSV: ${error.message}`);
        if (error instanceof BadRequestException) {
          throw error;
        }
        throw new BadRequestException(
          formatError(ERROR_MESSAGES.FAILED_TO_PARSE_CSV, error.message),
        );
      }

      if (!header || !savedDataset) {
        throw new BadRequestException(
          formatError(ERROR_MESSAGES.CSV_FILE_MUST_CONTAIN_HEADER_ROW),
        );
      }

      if (rowsToInsert.length > 0) {
        await rowRepo.save(rowsToInsert);
        rowsToInsert.length = 0;
      }

      this.logger.log(
        `Created dataset ${savedDataset.id} for project ${projectId} from CSV with ${rowCount} rows`,
      );

      if (organisationId) {
        await this.auditService.record({
          action: "dataset.imported",
          actorId: userId,
          actorType: "user",
          resourceType: "dataset",
          resourceId: savedDataset.id,
          organisationId,
          projectId,
          afterState: {
            id: savedDataset.id,
            name: savedDataset.name,
            description: savedDataset.description ?? null,
            header: savedDataset.header,
            projectId: savedDataset.projectId,
          },
          metadata: {
            organisationId,
            projectId,
            importedById: userId,
            rowCount,
          },
        });
      }

      return DatasetMapper.toDto(savedDataset, []);
    });
  }

  async exportToCsvStream(
    projectId: string,
    datasetId: string,
  ): Promise<{ csvStream: Readable; datasetName: string }> {
    this.logger.debug(
      `Exporting dataset ${datasetId} to CSV for project ${projectId}`,
    );

    const dataset = await this.getDatasetOrThrow(projectId, datasetId);

    const stringifier = stringify({
      header: false,
      quoted: true,
      quoted_empty: true,
      escape: '"',
      bom: true,
    });

    const readable = Readable.from(this.buildCsvRows(dataset));
    readable.pipe(stringifier);

    this.logger.log(
      `Exported dataset ${datasetId} to CSV (${dataset.rows.length} rows)`,
    );
    return {
      csvStream: stringifier,
      datasetName: dataset.name,
    };
  }
}
