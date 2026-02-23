import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
  UsePipes,
  ValidationPipe,
  HttpCode,
  HttpStatus,
} from "@nestjs/common";
import { AllowAnonymous } from "@thallesp/nestjs-better-auth";
import { ApiSecurity, ApiTags } from "@nestjs/swagger";
import { EvaluationsService } from "../services/core/evaluations.service";
import {
  CreateEvaluationRequestDto,
  CreateEvaluationResultRequestDto,
} from "../dto/request/create-evaluation-request.dto";
import { ImportScoreResultsRequestDto } from "../dto/request/import-score-results-request.dto";
import {
  EvaluationResponseDto,
  EvaluationResultResponseDto,
  ImportScoreResultsResponseDto,
} from "../dto/response/evaluation-response.dto";
import { ExperimentScoresResponseDto } from "../dto/response/experiment-scores-response.dto";
import { PaginatedPendingScoreResultsResponseDto } from "../dto/response/paginated-evaluation-result.dto";
import { ProjectApiKeyGuard } from "../../projects/guards/project-api-key.guard";
import {
  ProjectApiKeyContext,
  ProjectApiKeyContextData,
} from "../../common/decorators/project-api-key-context.decorator";

const API_KEY_ACTOR_ID = "api-key";

@Controller("api/public/evaluations")
@ApiTags("public-evaluations")
@ApiSecurity("apiKey")
@AllowAnonymous()
@UseGuards(ProjectApiKeyGuard)
export class EvaluationsPublicController {
  constructor(private readonly evaluationsService: EvaluationsService) {}

  @Get()
  async findAll(
    @ProjectApiKeyContext() ctx: ProjectApiKeyContextData,
  ): Promise<EvaluationResponseDto[]> {
    return this.evaluationsService.findAll(ctx.organisationId, ctx.projectId);
  }

  @Get(":evaluationId")
  async findOne(
    @ProjectApiKeyContext() ctx: ProjectApiKeyContextData,
    @Param("evaluationId", new ParseUUIDPipe()) evaluationId: string,
  ): Promise<EvaluationResponseDto> {
    return this.evaluationsService.findOne(
      ctx.organisationId,
      ctx.projectId,
      evaluationId,
    );
  }

  @Get(":evaluationId/scores/:scoreId/pending-results")
  @UsePipes(new ValidationPipe({ transform: true }))
  async listPendingScoreResults(
    @ProjectApiKeyContext() ctx: ProjectApiKeyContextData,
    @Param("evaluationId", new ParseUUIDPipe()) evaluationId: string,
    @Param("scoreId", new ParseUUIDPipe()) scoreId: string,
    @Query("experimentId") experimentId?: string,
    @Query("page") page?: number,
    @Query("limit") limit?: number,
  ): Promise<PaginatedPendingScoreResultsResponseDto> {
    return this.evaluationsService.listPendingScoreResults(
      ctx.organisationId,
      ctx.projectId,
      evaluationId,
      scoreId,
      { experimentId, page, limit },
    );
  }

  @Post(":evaluationId/scores/:scoreId/import-results")
  @HttpCode(HttpStatus.CREATED)
  @UsePipes(new ValidationPipe({ transform: true }))
  async importScoreResults(
    @ProjectApiKeyContext() ctx: ProjectApiKeyContextData,
    @Param("evaluationId", new ParseUUIDPipe()) evaluationId: string,
    @Param("scoreId", new ParseUUIDPipe()) scoreId: string,
    @Body() dto: ImportScoreResultsRequestDto,
  ): Promise<ImportScoreResultsResponseDto> {
    return this.evaluationsService.importScoreResults(
      ctx.organisationId,
      ctx.projectId,
      evaluationId,
      scoreId,
      dto,
    );
  }

  @Get(":evaluationId/experiments/:experimentId/scores")
  async getExperimentScores(
    @ProjectApiKeyContext() ctx: ProjectApiKeyContextData,
    @Param("evaluationId", new ParseUUIDPipe()) evaluationId: string,
    @Param("experimentId", new ParseUUIDPipe()) experimentId: string,
  ): Promise<ExperimentScoresResponseDto> {
    return this.evaluationsService.getExperimentScores(
      ctx.organisationId,
      ctx.projectId,
      evaluationId,
      experimentId,
    );
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UsePipes(new ValidationPipe({ transform: true }))
  async create(
    @ProjectApiKeyContext() ctx: ProjectApiKeyContextData,
    @Body() dto: CreateEvaluationRequestDto,
  ): Promise<EvaluationResponseDto> {
    return this.evaluationsService.create(
      ctx.organisationId,
      ctx.projectId,
      dto,
      API_KEY_ACTOR_ID,
    );
  }

  @Post(":evaluationId/results")
  @HttpCode(HttpStatus.CREATED)
  @UsePipes(new ValidationPipe({ transform: true }))
  async createResult(
    @ProjectApiKeyContext() ctx: ProjectApiKeyContextData,
    @Param("evaluationId", new ParseUUIDPipe()) evaluationId: string,
    @Body() dto: CreateEvaluationResultRequestDto,
  ): Promise<EvaluationResultResponseDto> {
    return this.evaluationsService.createResult(
      ctx.organisationId,
      ctx.projectId,
      evaluationId,
      dto,
    );
  }
}
