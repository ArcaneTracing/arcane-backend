import { Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Evaluation } from "../../entities/evaluation.entity";
import {
  CreateEvaluationRequestDto,
  CreateEvaluationResultRequestDto,
} from "../../dto/request/create-evaluation-request.dto";
import { ImportScoreResultsRequestDto } from "../../dto/request/import-score-results-request.dto";
import { ExperimentComparisonRequestDto } from "../../dto/request/experiment-comparison-request.dto";
import {
  EvaluationResponseDto,
  EvaluationResultResponseDto,
  ImportScoreResultsResponseDto,
} from "../../dto/response/evaluation-response.dto";
import { EvaluationStatisticsResponseDto } from "../../dto/response/evaluation-statistics-response.dto";
import { DatasetStatisticsResponseDto } from "../../dto/response/dataset-statistics-response.dto";
import { ExperimentComparisonResponseDto } from "../../dto/response/experiment-comparison-response.dto";
import { ExperimentScoresResponseDto } from "../../dto/response/experiment-scores-response.dto";
import { EvaluationMapper } from "../../mappers/evaluation.mapper";
import { ExperimentComparisonService } from "../comparison/experiment-comparison.service";
import { EvaluationLoaderService } from "./evaluation-loader.service";
import { EvaluationWriterService } from "./evaluation-writer.service";
import { EvaluationResultsService } from "../results/evaluation-results.service";
import { EvaluationStatisticsQueryService } from "../statistics/evaluation-statistics-query.service";
import { PaginationQueryDto } from "../../../common/dto/pagination.dto";
import {
  PaginatedEvaluationResultsResponseDto,
  PaginatedPendingScoreResultsResponseDto,
} from "../../dto/response/paginated-evaluation-result.dto";
@Injectable()
export class EvaluationsService {
  private readonly logger = new Logger(EvaluationsService.name);
  constructor(
    @InjectRepository(Evaluation)
    private readonly evaluationRepository: Repository<Evaluation>,
    private readonly experimentComparisonService: ExperimentComparisonService,
    private readonly evaluationLoaderService: EvaluationLoaderService,
    private readonly evaluationWriterService: EvaluationWriterService,
    private readonly evaluationResultsService: EvaluationResultsService,
    private readonly evaluationStatisticsQueryService: EvaluationStatisticsQueryService,
  ) {}

  async create(
    organisationId: string,
    projectId: string,
    dto: CreateEvaluationRequestDto,
    userId: string,
  ): Promise<EvaluationResponseDto> {
    const evaluation = await this.evaluationWriterService.create(
      organisationId,
      projectId,
      dto,
      userId,
    );
    return EvaluationMapper.toDto(evaluation);
  }
  async findAll(
    organisationId: string,
    projectId: string,
  ): Promise<EvaluationResponseDto[]> {
    const evaluations = await this.evaluationRepository
      .createQueryBuilder("evaluation")
      .innerJoin("evaluation.project", "project")
      .where("evaluation.projectId = :projectId", { projectId })
      .andWhere("project.organisationId = :organisationId", { organisationId })
      .leftJoinAndSelect("evaluation.scores", "scores")
      .leftJoinAndSelect("evaluation.experiments", "experiments")
      .orderBy("evaluation.createdAt", "DESC")
      .getMany();
    return evaluations.map((evaluation) => EvaluationMapper.toDto(evaluation));
  }
  async findOne(
    organisationId: string,
    projectId: string,
    evaluationId: string,
  ): Promise<EvaluationResponseDto> {
    const evaluation = await this.evaluationLoaderService.loadEvaluationOrFail(
      organisationId,
      projectId,
      evaluationId,
    );
    return EvaluationMapper.toDto(evaluation);
  }
  async rerun(
    organisationId: string,
    projectId: string,
    evaluationId: string,
    userId: string,
  ): Promise<EvaluationResponseDto> {
    const evaluation = await this.evaluationWriterService.rerun(
      organisationId,
      projectId,
      evaluationId,
      userId,
    );
    return EvaluationMapper.toDto(evaluation);
  }
  async remove(
    organisationId: string,
    projectId: string,
    evaluationId: string,
    userId?: string,
  ): Promise<void> {
    await this.evaluationWriterService.remove(
      organisationId,
      projectId,
      evaluationId,
      userId,
    );
  }
  async createResult(
    organisationId: string,
    projectId: string,
    evaluationId: string,
    dto: CreateEvaluationResultRequestDto,
  ): Promise<EvaluationResultResponseDto> {
    return this.evaluationResultsService.createResult(
      organisationId,
      projectId,
      evaluationId,
      dto,
    );
  }
  async importScoreResults(
    organisationId: string,
    projectId: string,
    evaluationId: string,
    scoreId: string,
    dto: ImportScoreResultsRequestDto,
  ): Promise<ImportScoreResultsResponseDto> {
    return this.evaluationResultsService.importScoreResults(
      organisationId,
      projectId,
      evaluationId,
      scoreId,
      dto,
    );
  }
  async listResultsForDatasetPaginated(
    organisationId: string,
    projectId: string,
    evaluationId: string,
    query: PaginationQueryDto,
  ): Promise<PaginatedEvaluationResultsResponseDto> {
    return this.evaluationResultsService.listResultsForDatasetPaginated(
      organisationId,
      projectId,
      evaluationId,
      query,
    );
  }
  async listPendingScoreResults(
    organisationId: string,
    projectId: string,
    evaluationId: string,
    scoreId: string,
    options: { experimentId?: string; page?: number; limit?: number },
  ): Promise<PaginatedPendingScoreResultsResponseDto> {
    return this.evaluationResultsService.listPendingScoreResults(
      organisationId,
      projectId,
      evaluationId,
      scoreId,
      options,
    );
  }
  async listResultsForExperimentsPaginated(
    organisationId: string,
    projectId: string,
    evaluationId: string,
    experimentId: string,
    query: PaginationQueryDto,
  ): Promise<PaginatedEvaluationResultsResponseDto> {
    return this.evaluationResultsService.listResultsForExperimentsPaginated(
      organisationId,
      projectId,
      evaluationId,
      experimentId,
      query,
    );
  }
  async getStatisticsForDataset(
    organisationId: string,
    projectId: string,
    evaluationId: string,
  ): Promise<DatasetStatisticsResponseDto[]> {
    return this.evaluationStatisticsQueryService.getStatisticsForDataset(
      organisationId,
      projectId,
      evaluationId,
    );
  }
  async getStatisticsForExperiments(
    organisationId: string,
    projectId: string,
    evaluationId: string,
  ): Promise<EvaluationStatisticsResponseDto[]> {
    return this.evaluationStatisticsQueryService.getStatisticsForExperiments(
      organisationId,
      projectId,
      evaluationId,
    );
  }
  async compareExperiments(
    organisationId: string,
    projectId: string,
    dto: ExperimentComparisonRequestDto,
  ): Promise<ExperimentComparisonResponseDto> {
    const evaluation = await this.evaluationLoaderService.loadEvaluationOrFail(
      organisationId,
      projectId,
      dto.evaluationId,
    );
    return this.experimentComparisonService.compareExperiments(evaluation, dto);
  }
  async getExperimentScores(
    organisationId: string,
    projectId: string,
    evaluationId: string,
    experimentId: string,
  ): Promise<ExperimentScoresResponseDto> {
    return this.evaluationResultsService.getExperimentScores(
      organisationId,
      projectId,
      evaluationId,
      experimentId,
    );
  }
}
