import { Inject, BadRequestException, Injectable } from "@nestjs/common";
import { CACHE_MANAGER } from "@nestjs/cache-manager";
import { Cache } from "cache-manager";
import {
  ERROR_MESSAGES,
  formatError,
} from "../../../common/constants/error-messages.constants";
import { EvaluationScope } from "../../entities/evaluation.entity";
import { ScoringType } from "../../../scores/entities/score.entity";
import { DatasetStatisticsResponseDto } from "../../dto/response/dataset-statistics-response.dto";
import { EvaluationLoaderService } from "../core/evaluation-loader.service";
import { StatisticsCalculationOrchestrator } from "./statistics-calculation-orchestrator.service";

@Injectable()
export class DatasetStatisticsService {
  private readonly STATISTICS_CACHE_TTL = 900;

  constructor(
    private readonly evaluationLoaderService: EvaluationLoaderService,
    private readonly calculationOrchestrator: StatisticsCalculationOrchestrator,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
  ) {}

  private async validateDatasetEvaluation(
    organisationId: string,
    projectId: string,
    evaluationId: string,
  ): Promise<{ evaluationId: string; datasetId: string }> {
    const evaluation = await this.evaluationLoaderService.loadEvaluationOrFail(
      organisationId,
      projectId,
      evaluationId,
    );

    if (evaluation.evaluationScope !== EvaluationScope.DATASET) {
      throw new BadRequestException(
        formatError(
          ERROR_MESSAGES.THIS_ENDPOINT_ONLY_FOR_DATASET_SCOPED_EVALUATIONS,
        ),
      );
    }

    if (!evaluation.datasetId) {
      throw new BadRequestException(
        formatError(ERROR_MESSAGES.EVALUATION_DOES_NOT_HAVE_DATASET),
      );
    }

    return { evaluationId, datasetId: evaluation.datasetId };
  }

  async getStatistics(
    organisationId: string,
    projectId: string,
    evaluationId: string,
  ): Promise<DatasetStatisticsResponseDto[]> {
    const cacheKey = `eval:stats:dataset:${evaluationId}`;

    const cached =
      await this.cacheManager.get<DatasetStatisticsResponseDto[]>(cacheKey);
    if (cached) {
      return cached;
    }

    const { evaluationId: evalId, datasetId } =
      await this.validateDatasetEvaluation(
        organisationId,
        projectId,
        evaluationId,
      );

    const evaluation = await this.evaluationLoaderService.loadEvaluationOrFail(
      organisationId,
      projectId,
      evalId,
    );

    const statistics: DatasetStatisticsResponseDto[] = [];

    for (const score of evaluation.scores || []) {
      const stats =
        await this.calculationOrchestrator.calculateStatisticsForScoreGroup(
          evalId,
          score,
        );

      statistics.push({
        datasetId,
        scoreId: score.id,
        numeric: stats.numeric || null,
        nominal: stats.nominal || null,
        ordinal: stats.ordinal || null,
      });
    }

    await this.cacheManager.set(
      cacheKey,
      statistics,
      this.STATISTICS_CACHE_TTL,
    );
    return statistics;
  }

  async getNominalStatistics(
    organisationId: string,
    projectId: string,
    evaluationId: string,
  ): Promise<DatasetStatisticsResponseDto[]> {
    const cacheKey = `eval:stats:dataset:nominal:${evaluationId}`;

    const cached =
      await this.cacheManager.get<DatasetStatisticsResponseDto[]>(cacheKey);
    if (cached) {
      return cached;
    }

    const { evaluationId: evalId, datasetId } =
      await this.validateDatasetEvaluation(
        organisationId,
        projectId,
        evaluationId,
      );

    const evaluation = await this.evaluationLoaderService.loadEvaluationOrFail(
      organisationId,
      projectId,
      evalId,
    );

    const statistics: DatasetStatisticsResponseDto[] = [];

    for (const score of evaluation.scores || []) {
      if (score.scoringType !== ScoringType.NOMINAL) {
        continue;
      }

      const stats =
        await this.calculationOrchestrator.calculateStatisticsForScoreGroup(
          evalId,
          score,
        );

      statistics.push({
        datasetId,
        scoreId: score.id,
        numeric: null,
        nominal: stats.nominal || null,
        ordinal: null,
      });
    }

    await this.cacheManager.set(
      cacheKey,
      statistics,
      this.STATISTICS_CACHE_TTL,
    );
    return statistics;
  }

  async getOrdinalStatistics(
    organisationId: string,
    projectId: string,
    evaluationId: string,
  ): Promise<DatasetStatisticsResponseDto[]> {
    const cacheKey = `eval:stats:dataset:ordinal:${evaluationId}`;

    const cached =
      await this.cacheManager.get<DatasetStatisticsResponseDto[]>(cacheKey);
    if (cached) {
      return cached;
    }

    const { evaluationId: evalId, datasetId } =
      await this.validateDatasetEvaluation(
        organisationId,
        projectId,
        evaluationId,
      );

    const evaluation = await this.evaluationLoaderService.loadEvaluationOrFail(
      organisationId,
      projectId,
      evalId,
    );

    const statistics: DatasetStatisticsResponseDto[] = [];

    for (const score of evaluation.scores || []) {
      if (score.scoringType !== ScoringType.ORDINAL) {
        continue;
      }

      const stats =
        await this.calculationOrchestrator.calculateStatisticsForScoreGroup(
          evalId,
          score,
        );

      statistics.push({
        datasetId,
        scoreId: score.id,
        numeric: null,
        nominal: null,
        ordinal: stats.ordinal || null,
      });
    }

    await this.cacheManager.set(
      cacheKey,
      statistics,
      this.STATISTICS_CACHE_TTL,
    );
    return statistics;
  }
}
