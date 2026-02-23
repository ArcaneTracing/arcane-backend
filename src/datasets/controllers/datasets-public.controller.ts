import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Body,
  UseGuards,
  UsePipes,
  ValidationPipe,
  HttpCode,
  HttpStatus,
  Query,
} from "@nestjs/common";
import { AllowAnonymous } from "@thallesp/nestjs-better-auth";
import { ApiSecurity, ApiTags } from "@nestjs/swagger";
import { DatasetsService } from "../services/datasets.service";
import { PaginatedDatasetResponseDto } from "../dto/response/paginated-dataset.dto";
import { DatasetListItemResponseDto } from "../dto/response/dataset-list-item.dto";
import { DatasetRowResponseDto } from "../dto/response/dataset-row.dto";
import { UpsertRowToDatasetRequestDto } from "../dto/request/upsert-row-to-dataset.dto";
import { PaginationQueryDto } from "../../common/dto/pagination.dto";
import { ProjectApiKeyGuard } from "../../projects/guards/project-api-key.guard";
import {
  ProjectApiKeyContext,
  ProjectApiKeyContextData,
} from "../../common/decorators/project-api-key-context.decorator";

@Controller("api/public/datasets")
@ApiTags("public-datasets")
@ApiSecurity("apiKey")
@AllowAnonymous()
@UseGuards(ProjectApiKeyGuard)
export class DatasetsPublicController {
  constructor(private readonly datasetsService: DatasetsService) {}

  @Get()
  async findAll(
    @ProjectApiKeyContext() ctx: ProjectApiKeyContextData,
  ): Promise<DatasetListItemResponseDto[]> {
    return this.datasetsService.findAll(ctx.projectId);
  }

  @Get(":datasetId")
  @UsePipes(new ValidationPipe({ transform: true }))
  async findOne(
    @ProjectApiKeyContext() ctx: ProjectApiKeyContextData,
    @Param("datasetId", new ParseUUIDPipe()) datasetId: string,
    @Query() query: PaginationQueryDto,
  ): Promise<PaginatedDatasetResponseDto> {
    return this.datasetsService.findOnePaginated(
      ctx.projectId,
      datasetId,
      query,
    );
  }

  @Post(":datasetId/rows")
  @HttpCode(HttpStatus.CREATED)
  @UsePipes(new ValidationPipe({ transform: true }))
  async addRow(
    @ProjectApiKeyContext() ctx: ProjectApiKeyContextData,
    @Param("datasetId", new ParseUUIDPipe()) datasetId: string,
    @Body() dto: UpsertRowToDatasetRequestDto,
  ): Promise<DatasetRowResponseDto> {
    return this.datasetsService.upsertRow(ctx.projectId, datasetId, dto);
  }
}
