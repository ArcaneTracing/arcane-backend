import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  Put,
  Delete,
  HttpCode,
  HttpStatus,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  Res,
  ParseUUIDPipe,
  UsePipes,
  ValidationPipe,
  Query,
} from "@nestjs/common";
import { Session, UserSession } from "@thallesp/nestjs-better-auth";
import {
  ERROR_MESSAGES,
  formatError,
} from "../../common/constants/error-messages.constants";
import { Response } from "express";
import { FileInterceptor } from "@nestjs/platform-express";
import { DatasetsService } from "../services/datasets.service";
import { CreateDatasetRequestDto } from "../dto/request/create-dataset.dto";
import { UpdateDatasetRequestDto } from "../dto/request/update-dataset.dto";
import { UpsertRowToDatasetRequestDto } from "../dto/request/upsert-row-to-dataset.dto";
import { DatasetResponseDto } from "../dto/response/dataset.dto";
import { DatasetListItemResponseDto } from "../dto/response/dataset-list-item.dto";
import { DatasetRowResponseDto } from "../dto/response/dataset-row.dto";
import { DatasetHeaderResponseDto } from "../dto/response/dataset-header.dto";
import { DatasetMessageResponseDto } from "../dto/response/dataset-message-response.dto";
import { PaginationQueryDto } from "../../common/dto/pagination.dto";
import { PaginatedDatasetResponseDto } from "../dto/response/paginated-dataset.dto";
import { OrgProjectPermissionGuard } from "../../rbac/guards/org-project-permission.guard";
import { Permission } from "../../rbac/decorators/permission.decorator";
import { DATASET_PERMISSIONS } from "../../rbac/permissions/permissions";
import { DatasetsCsvService } from "../services/datasets-csv.service";

@Controller("v1/organisations/:organisationId/projects/:projectId/datasets")
@UseGuards(OrgProjectPermissionGuard)
export class DatasetsController {
  constructor(
    private readonly datasetsService: DatasetsService,
    private readonly datasetsCsvService: DatasetsCsvService,
  ) {}

  @Post("import")
  @Permission(DATASET_PERMISSIONS.IMPORT)
  @HttpCode(HttpStatus.CREATED)
  @UsePipes(new ValidationPipe({ transform: true }))
  @UseInterceptors(FileInterceptor("file"))
  async importDataset(
    @Param("organisationId", ParseUUIDPipe) organisationId: string,
    @Param("projectId", ParseUUIDPipe) projectId: string,
    @UploadedFile() file: Express.Multer.File,
    @Session() userSession: UserSession,
    @Body("name") name?: string,
    @Body("description") description?: string,
  ): Promise<DatasetResponseDto> {
    if (!file) {
      throw new BadRequestException(
        formatError(ERROR_MESSAGES.CSV_FILE_REQUIRED),
      );
    }

    const allowedMimeTypes = [
      "text/csv",
      "application/vnd.ms-excel",
      "text/plain",
    ];
    const allowedExtensions = [".csv"];
    const fileExtension = file.originalname
      .toLowerCase()
      .substring(file.originalname.lastIndexOf("."));

    if (
      !allowedMimeTypes.includes(file.mimetype) &&
      !allowedExtensions.includes(fileExtension)
    ) {
      throw new BadRequestException(
        formatError(ERROR_MESSAGES.FILE_MUST_BE_CSV),
      );
    }

    const datasetName =
      name || file.originalname.replace(/\.csv$/i, "") || "Imported Dataset";

    const csvContent = file.buffer.toString("utf-8");

    return this.datasetsCsvService.createFromCsv(
      projectId,
      csvContent,
      datasetName,
      userSession?.user?.id,
      description,
      organisationId,
    );
  }

  @Post()
  @Permission(DATASET_PERMISSIONS.CREATE)
  @HttpCode(HttpStatus.CREATED)
  @UsePipes(new ValidationPipe({ transform: true }))
  async create(
    @Param("organisationId", ParseUUIDPipe) organisationId: string,
    @Param("projectId", ParseUUIDPipe) projectId: string,
    @Session() userSession: UserSession,
    @Body() createDatasetDto: CreateDatasetRequestDto,
  ): Promise<DatasetResponseDto> {
    return this.datasetsService.create(
      projectId,
      createDatasetDto,
      userSession?.user?.id,
      organisationId,
    );
  }

  @Get()
  @Permission(DATASET_PERMISSIONS.READ)
  @UsePipes(new ValidationPipe({ transform: true }))
  async findAll(
    @Param("projectId", ParseUUIDPipe) projectId: string,
  ): Promise<DatasetListItemResponseDto[]> {
    return this.datasetsService.findAll(projectId);
  }

  @Post(":datasetId/rows")
  @Permission(DATASET_PERMISSIONS.ROWS_CREATE)
  @HttpCode(HttpStatus.CREATED)
  @UsePipes(new ValidationPipe({ transform: true }))
  async upsertRow(
    @Param("projectId", ParseUUIDPipe) projectId: string,
    @Param("datasetId", ParseUUIDPipe) datasetId: string,
    @Body() upsertRowDto: UpsertRowToDatasetRequestDto,
  ): Promise<DatasetRowResponseDto> {
    return this.datasetsService.upsertRow(projectId, datasetId, upsertRowDto);
  }

  @Get(":datasetId/header")
  @UsePipes(new ValidationPipe({ transform: true }))
  async findHeader(
    @Param("projectId", ParseUUIDPipe) projectId: string,
    @Param("datasetId", ParseUUIDPipe) datasetId: string,
  ): Promise<DatasetHeaderResponseDto> {
    return this.datasetsService.findHeader(projectId, datasetId);
  }

  @Get(":datasetId/export")
  @Permission(DATASET_PERMISSIONS.EXPORT)
  @UsePipes(new ValidationPipe({ transform: true }))
  async export(
    @Param("projectId", ParseUUIDPipe) projectId: string,
    @Param("datasetId", ParseUUIDPipe) datasetId: string,
    @Res() res: Response,
  ): Promise<void> {
    const { csvStream, datasetName } =
      await this.datasetsCsvService.exportToCsvStream(projectId, datasetId);

    const sanitizedName = datasetName
      .replaceAll(/[^a-z0-9]/gi, "_")
      .toLowerCase();
    const filename = `${sanitizedName || "dataset"}-export.csv`;

    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);

    await new Promise<void>((resolve, reject) => {
      csvStream.on("error", reject);
      res.on("finish", resolve);
      csvStream.pipe(res);
    });
  }

  @Get(":datasetId")
  @Permission(DATASET_PERMISSIONS.READ)
  @UsePipes(new ValidationPipe({ transform: true }))
  async findOne(
    @Param("projectId", ParseUUIDPipe) projectId: string,
    @Param("datasetId", ParseUUIDPipe) datasetId: string,
    @Query() query: PaginationQueryDto,
  ): Promise<PaginatedDatasetResponseDto> {
    return this.datasetsService.findOnePaginated(projectId, datasetId, query);
  }

  @Put(":datasetId")
  @Permission(DATASET_PERMISSIONS.UPDATE)
  @UsePipes(new ValidationPipe({ transform: true }))
  async update(
    @Param("organisationId", ParseUUIDPipe) organisationId: string,
    @Param("projectId", ParseUUIDPipe) projectId: string,
    @Param("datasetId", ParseUUIDPipe) datasetId: string,
    @Body() updateDatasetDto: UpdateDatasetRequestDto,
    @Session() userSession: UserSession,
  ): Promise<DatasetResponseDto> {
    return this.datasetsService.update(
      projectId,
      datasetId,
      updateDatasetDto,
      userSession?.user?.id,
      organisationId,
    );
  }

  @Delete(":datasetId")
  @Permission(DATASET_PERMISSIONS.DELETE)
  @HttpCode(HttpStatus.NO_CONTENT)
  @UsePipes(new ValidationPipe({ transform: true }))
  async remove(
    @Param("organisationId", ParseUUIDPipe) organisationId: string,
    @Param("projectId", ParseUUIDPipe) projectId: string,
    @Param("datasetId", ParseUUIDPipe) datasetId: string,
    @Session() userSession: UserSession,
  ): Promise<DatasetMessageResponseDto> {
    return this.datasetsService.remove(
      projectId,
      datasetId,
      userSession?.user?.id,
      organisationId,
    );
  }
}
