import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  ParseUUIDPipe,
  Query,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from "@nestjs/common";
import { EvaluationsService } from "./services/core/evaluations.service";
import {
  CreateEvaluationRequestDto,
  CreateEvaluationResultRequestDto,
} from "./dto/request/create-evaluation-request.dto";
import { ImportScoreResultsRequestDto } from "./dto/request/import-score-results-request.dto";
import { ExperimentComparisonRequestDto } from "./dto/request/experiment-comparison-request.dto";
import { CompareExperimentsRequestDto } from "./dto/request/compare-experiments-request.dto";
import {
  EvaluationResponseDto,
  EvaluationResultResponseDto,
  ImportScoreResultsResponseDto,
} from "./dto/response/evaluation-response.dto";
import { EvaluationStatisticsResponseDto } from "./dto/response/evaluation-statistics-response.dto";
import { DatasetStatisticsResponseDto } from "./dto/response/dataset-statistics-response.dto";
import { ExperimentComparisonResponseDto } from "./dto/response/experiment-comparison-response.dto";
import { ExperimentScoresResponseDto } from "./dto/response/experiment-scores-response.dto";
import { PaginationQueryDto } from "../common/dto/pagination.dto";
import { PaginatedEvaluationResultsResponseDto } from "./dto/response/paginated-evaluation-result.dto";
import { OrgProjectPermissionGuard } from "../rbac/guards/org-project-permission.guard";
import { Permission } from "../rbac/decorators/permission.decorator";
import { EVALUATION_PERMISSIONS } from "../rbac/permissions/permissions";
import { Session, UserSession } from "@thallesp/nestjs-better-auth";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiBody,
  ApiBearerAuth,
} from "@nestjs/swagger";
@Controller("v1/organisations/:organisationId/projects/:projectId/evaluations")
@ApiTags("evaluations")
@ApiBearerAuth("bearer")
@UseGuards(OrgProjectPermissionGuard)
export class EvaluationsController {
  constructor(private readonly evaluationsService: EvaluationsService) {}
  @Post()
  @Permission(EVALUATION_PERMISSIONS.CREATE)
  @HttpCode(HttpStatus.CREATED)
  @UsePipes(new ValidationPipe({ transform: true }))
  @ApiOperation({
    summary: "Create evaluation",
    description: "Create a new evaluation for a project",
  })
  @ApiParam({
    name: "organisationId",
    type: "string",
    format: "uuid",
    description: "Organisation ID",
  })
  @ApiParam({
    name: "projectId",
    type: "string",
    format: "uuid",
    description: "Project ID",
  })
  @ApiBody({ type: CreateEvaluationRequestDto })
  @ApiResponse({
    status: 201,
    description: "Evaluation created successfully",
    type: EvaluationResponseDto,
  })
  @ApiResponse({ status: 400, description: "Bad request - validation error" })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  @ApiResponse({ status: 403, description: "Forbidden" })
  create(
    @Param("organisationId", new ParseUUIDPipe()) organisationId: string,
    @Param("projectId", new ParseUUIDPipe()) projectId: string,
    @Body() dto: CreateEvaluationRequestDto,
    @Session() userSession: UserSession,
  ): Promise<EvaluationResponseDto> {
    return this.evaluationsService.create(
      organisationId,
      projectId,
      dto,
      userSession?.user?.id,
    );
  }
  @Get()
  @Permission(EVALUATION_PERMISSIONS.READ)
  @ApiOperation({
    summary: "List evaluations",
    description: "Get all evaluations for a project",
  })
  @ApiParam({
    name: "organisationId",
    type: "string",
    format: "uuid",
    description: "Organisation ID",
  })
  @ApiParam({
    name: "projectId",
    type: "string",
    format: "uuid",
    description: "Project ID",
  })
  @ApiResponse({
    status: 200,
    description: "List of evaluations",
    type: [EvaluationResponseDto],
  })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  @ApiResponse({ status: 403, description: "Forbidden" })
  findAll(
    @Param("organisationId", new ParseUUIDPipe()) organisationId: string,
    @Param("projectId", new ParseUUIDPipe()) projectId: string,
  ): Promise<EvaluationResponseDto[]> {
    return this.evaluationsService.findAll(organisationId, projectId);
  }
  @Get(":evaluationId/experiments/:experimentId/scores")
  @Permission(EVALUATION_PERMISSIONS.RESULTS_READ)
  getExperimentScores(
    @Param("organisationId", new ParseUUIDPipe()) organisationId: string,
    @Param("projectId", new ParseUUIDPipe()) projectId: string,
    @Param("evaluationId", new ParseUUIDPipe()) evaluationId: string,
    @Param("experimentId", new ParseUUIDPipe()) experimentId: string,
  ): Promise<ExperimentScoresResponseDto> {
    return this.evaluationsService.getExperimentScores(
      organisationId,
      projectId,
      evaluationId,
      experimentId,
    );
  }
  @Get(":evaluationId")
  @Permission(EVALUATION_PERMISSIONS.READ)
  @ApiOperation({
    summary: "Get evaluation",
    description: "Get a specific evaluation by ID",
  })
  @ApiParam({
    name: "organisationId",
    type: "string",
    format: "uuid",
    description: "Organisation ID",
  })
  @ApiParam({
    name: "projectId",
    type: "string",
    format: "uuid",
    description: "Project ID",
  })
  @ApiParam({
    name: "evaluationId",
    type: "string",
    format: "uuid",
    description: "Evaluation ID",
  })
  @ApiResponse({
    status: 200,
    description: "Evaluation details",
    type: EvaluationResponseDto,
  })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  @ApiResponse({ status: 403, description: "Forbidden" })
  @ApiResponse({ status: 404, description: "Evaluation not found" })
  findOne(
    @Param("organisationId", new ParseUUIDPipe()) organisationId: string,
    @Param("projectId", new ParseUUIDPipe()) projectId: string,
    @Param("evaluationId", new ParseUUIDPipe()) evaluationId: string,
  ): Promise<EvaluationResponseDto> {
    return this.evaluationsService.findOne(
      organisationId,
      projectId,
      evaluationId,
    );
  }
  @Post(":evaluationId/rerun")
  @Permission(EVALUATION_PERMISSIONS.RERUN)
  @HttpCode(HttpStatus.CREATED)
  rerun(
    @Param("organisationId", new ParseUUIDPipe()) organisationId: string,
    @Param("projectId", new ParseUUIDPipe()) projectId: string,
    @Param("evaluationId", new ParseUUIDPipe()) evaluationId: string,
    @Session() userSession: UserSession,
  ): Promise<EvaluationResponseDto> {
    return this.evaluationsService.rerun(
      organisationId,
      projectId,
      evaluationId,
      userSession?.user?.id,
    );
  }
  @Delete(":evaluationId")
  @Permission(EVALUATION_PERMISSIONS.DELETE)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: "Delete evaluation",
    description: "Delete an evaluation",
  })
  @ApiParam({
    name: "organisationId",
    type: "string",
    format: "uuid",
    description: "Organisation ID",
  })
  @ApiParam({
    name: "projectId",
    type: "string",
    format: "uuid",
    description: "Project ID",
  })
  @ApiParam({
    name: "evaluationId",
    type: "string",
    format: "uuid",
    description: "Evaluation ID",
  })
  @ApiResponse({ status: 204, description: "Evaluation deleted successfully" })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  @ApiResponse({ status: 403, description: "Forbidden" })
  @ApiResponse({ status: 404, description: "Evaluation not found" })
  async remove(
    @Param("organisationId", new ParseUUIDPipe()) organisationId: string,
    @Param("projectId", new ParseUUIDPipe()) projectId: string,
    @Param("evaluationId", new ParseUUIDPipe()) evaluationId: string,
    @Session() userSession: UserSession,
  ): Promise<void> {
    await this.evaluationsService.remove(
      organisationId,
      projectId,
      evaluationId,
      userSession?.user?.id,
    );
  }
  @Post(":evaluationId/results")
  @Permission(EVALUATION_PERMISSIONS.CREATE)
  @HttpCode(HttpStatus.CREATED)
  @UsePipes(new ValidationPipe({ transform: true }))
  createResult(
    @Param("organisationId", new ParseUUIDPipe()) organisationId: string,
    @Param("projectId", new ParseUUIDPipe()) projectId: string,
    @Param("evaluationId", new ParseUUIDPipe()) evaluationId: string,
    @Body() dto: CreateEvaluationResultRequestDto,
  ): Promise<EvaluationResultResponseDto> {
    return this.evaluationsService.createResult(
      organisationId,
      projectId,
      evaluationId,
      dto,
    );
  }
  @Post(":evaluationId/scores/:scoreId/import")
  @Permission(EVALUATION_PERMISSIONS.CREATE)
  @HttpCode(HttpStatus.CREATED)
  @UsePipes(new ValidationPipe({ transform: true }))
  @ApiOperation({
    summary: "Import score results",
    description:
      "Bulk import score results for a score in an evaluation. For dataset scope use datasetRowId per row; for experiment scope use experimentResultId.",
  })
  @ApiParam({ name: "organisationId", type: "string", format: "uuid" })
  @ApiParam({ name: "projectId", type: "string", format: "uuid" })
  @ApiParam({ name: "evaluationId", type: "string", format: "uuid" })
  @ApiParam({ name: "scoreId", type: "string", format: "uuid" })
  @ApiBody({ type: ImportScoreResultsRequestDto })
  @ApiResponse({
    status: 201,
    description: "Score results imported",
    type: ImportScoreResultsResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: "Bad request - validation or duplicate",
  })
  @ApiResponse({
    status: 404,
    description:
      "Evaluation, score, dataset row or experiment result not found",
  })
  importScoreResults(
    @Param("organisationId", new ParseUUIDPipe()) organisationId: string,
    @Param("projectId", new ParseUUIDPipe()) projectId: string,
    @Param("evaluationId", new ParseUUIDPipe()) evaluationId: string,
    @Param("scoreId", new ParseUUIDPipe()) scoreId: string,
    @Body() dto: ImportScoreResultsRequestDto,
  ): Promise<ImportScoreResultsResponseDto> {
    return this.evaluationsService.importScoreResults(
      organisationId,
      projectId,
      evaluationId,
      scoreId,
      dto,
    );
  }
  @Get(":evaluationId/datasets/results")
  @Permission(EVALUATION_PERMISSIONS.RESULTS_READ)
  @UsePipes(new ValidationPipe({ transform: true }))
  listResultsForDataset(
    @Param("organisationId", new ParseUUIDPipe()) organisationId: string,
    @Param("projectId", new ParseUUIDPipe()) projectId: string,
    @Param("evaluationId", new ParseUUIDPipe()) evaluationId: string,
    @Query() query: PaginationQueryDto,
  ): Promise<PaginatedEvaluationResultsResponseDto> {
    return this.evaluationsService.listResultsForDatasetPaginated(
      organisationId,
      projectId,
      evaluationId,
      query,
    );
  }
  @Get(":evaluationId/experiments/:experimentId/results")
  @Permission(EVALUATION_PERMISSIONS.RESULTS_READ)
  @UsePipes(new ValidationPipe({ transform: true }))
  listResultsForExperiments(
    @Param("organisationId", new ParseUUIDPipe()) organisationId: string,
    @Param("projectId", new ParseUUIDPipe()) projectId: string,
    @Param("evaluationId", new ParseUUIDPipe()) evaluationId: string,
    @Param("experimentId", new ParseUUIDPipe()) experimentId: string,
    @Query() query: PaginationQueryDto,
  ): Promise<PaginatedEvaluationResultsResponseDto> {
    return this.evaluationsService.listResultsForExperimentsPaginated(
      organisationId,
      projectId,
      evaluationId,
      experimentId,
      query,
    );
  }
  @Get(":evaluationId/datasets/statistics")
  @Permission(EVALUATION_PERMISSIONS.RESULTS_READ)
  getStatisticsForDataset(
    @Param("organisationId", new ParseUUIDPipe()) organisationId: string,
    @Param("projectId", new ParseUUIDPipe()) projectId: string,
    @Param("evaluationId", new ParseUUIDPipe()) evaluationId: string,
  ): Promise<DatasetStatisticsResponseDto[]> {
    return this.evaluationsService.getStatisticsForDataset(
      organisationId,
      projectId,
      evaluationId,
    );
  }
  @Get(":evaluationId/experiments/statistics")
  @Permission(EVALUATION_PERMISSIONS.RESULTS_READ)
  getStatisticsForExperiments(
    @Param("organisationId", new ParseUUIDPipe()) organisationId: string,
    @Param("projectId", new ParseUUIDPipe()) projectId: string,
    @Param("evaluationId", new ParseUUIDPipe()) evaluationId: string,
  ): Promise<EvaluationStatisticsResponseDto[]> {
    return this.evaluationsService.getStatisticsForExperiments(
      organisationId,
      projectId,
      evaluationId,
    );
  }
  @Post(":evaluationId/compare-experiments")
  @Permission(EVALUATION_PERMISSIONS.RESULTS_READ)
  @UsePipes(new ValidationPipe({ transform: true }))
  compareExperiments(
    @Param("organisationId", new ParseUUIDPipe()) organisationId: string,
    @Param("projectId", new ParseUUIDPipe()) projectId: string,
    @Param("evaluationId", new ParseUUIDPipe()) evaluationId: string,
    @Body() dto: CompareExperimentsRequestDto,
  ): Promise<ExperimentComparisonResponseDto> {
    const fullDto: ExperimentComparisonRequestDto = {
      ...dto,
      evaluationId,
    };
    return this.evaluationsService.compareExperiments(
      organisationId,
      projectId,
      fullDto,
    );
  }
}
