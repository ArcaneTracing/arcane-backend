import { Inject, BadRequestException, Injectable } from "@nestjs/common";
import { CACHE_MANAGER } from "@nestjs/cache-manager";
import { Cache } from "cache-manager";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import {
  ERROR_MESSAGES,
  formatError,
} from "../../../common/constants/error-messages.constants";
import { EvaluationScope } from "../../entities/evaluation.entity";
import { ScoringType } from "../../../scores/entities/score.entity";
import { EvaluationStatisticsResponseDto } from "../../dto/response/evaluation-statistics-response.dto";
import { EvaluationLoaderService } from "../core/evaluation-loader.service";
import { StatisticsCalculationOrchestrator } from "./statistics-calculation-orchestrator.service";
import { ScoreResult } from "../../entities/score-result.entity";

@Injectable()
export class ExperimentStatisticsService {
  private readonly STATISTICS_CACHE_TTL = 900;

  constructor(
    private readonly evaluationLoaderService: EvaluationLoaderService,
    private readonly calculationOrchestrator: StatisticsCalculationOrchestrator,
    @InjectRepository(ScoreResult)
    private readonly scoreResultRepository: Repository<ScoreResult>,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
  ) {}

  private async validateExperimentEvaluation(
    organisationId: string,
    projectId: string,
    evaluationId: string,
  ): Promise<string> {
    const evaluation = await this.evaluationLoaderService.loadEvaluationOrFail(
      organisationId,
      projectId,
      evaluationId,
    );

    if (evaluation.evaluationScope !== EvaluationScope.EXPERIMENT) {
      throw new BadRequestException(
        formatError(ERROR_MESSAGES.EVALUATION_SCOPE_MISMATCH, "experiment"),
      );
    }

    return evaluationId;
  }

  async getStatistics(
    organisationId: string,
    projectId: string,
    evaluationId: string,
  ): Promise<EvaluationStatisticsResponseDto[]> {
    const cacheKey = `eval:stats:experiment:${evaluationId}`;

    const cached =
      await this.cacheManager.get<EvaluationStatisticsResponseDto[]>(cacheKey);
    if (cached) {
      return cached;
    }

    const evalId = await this.validateExperimentEvaluation(
      organisationId,
      projectId,
      evaluationId,
    );

    const evaluation = await this.evaluationLoaderService.loadEvaluationOrFail(
      organisationId,
      projectId,
      evalId,
    );

    if (!evaluation.experiments || evaluation.experiments.length === 0) {
      return [];
    }

    const rows: Array<{ experimentId: string }> =
      await this.scoreResultRepository.manager.query(
        `SELECT DISTINCT er.experiment_id AS "experimentId"
       FROM score_results sr
       INNER JOIN experiment_results er ON sr.experiment_result_id = er.id
       WHERE sr.evaluation_id = $1`,
        [evalId],
      );

    const experimentIdsWithData = new Set(rows.map((r) => r.experimentId));

    const statistics: EvaluationStatisticsResponseDto[] = [];

    for (const experiment of evaluation.experiments) {
      if (!experimentIdsWithData.has(experiment.id)) {
        continue;
      }

      for (const score of evaluation.scores || []) {
        const stats =
          await this.calculationOrchestrator.calculateStatisticsForScoreGroup(
            evalId,
            score,
            experiment.id,
          );

        statistics.push({
          experimentId: experiment.id,
          scoreId: score.id,
          numeric: stats.numeric || null,
          nominal: stats.nominal || null,
          ordinal: stats.ordinal || null,
        });
      }
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
  ): Promise<EvaluationStatisticsResponseDto[]> {
    const cacheKey = `eval:stats:experiment:nominal:${evaluationId}`;

    const cached =
      await this.cacheManager.get<EvaluationStatisticsResponseDto[]>(cacheKey);
    if (cached) {
      return cached;
    }

    const evalId = await this.validateExperimentEvaluation(
      organisationId,
      projectId,
      evaluationId,
    );

    const evaluation = await this.evaluationLoaderService.loadEvaluationOrFail(
      organisationId,
      projectId,
      evalId,
    );

    if (!evaluation.experiments || evaluation.experiments.length === 0) {
      return [];
    }

    const rows: Array<{ experimentId: string }> =
      await this.scoreResultRepository.manager.query(
        `SELECT DISTINCT er.experiment_id AS "experimentId"
       FROM score_results sr
       INNER JOIN experiment_results er ON sr.experiment_result_id = er.id
       WHERE sr.evaluation_id = $1`,
        [evalId],
      );

    const experimentIdsWithData = new Set(rows.map((r) => r.experimentId));
    const statistics: EvaluationStatisticsResponseDto[] = [];

    for (const experiment of evaluation.experiments) {
      if (!experimentIdsWithData.has(experiment.id)) {
        continue;
      }

      for (const score of evaluation.scores || []) {
        if (score.scoringType !== ScoringType.NOMINAL) {
          continue;
        }

        const stats =
          await this.calculationOrchestrator.calculateStatisticsForScoreGroup(
            evalId,
            score,
            experiment.id,
          );

        statistics.push({
          experimentId: experiment.id,
          scoreId: score.id,
          numeric: null,
          nominal: stats.nominal || null,
          ordinal: null,
        });
      }
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
  ): Promise<EvaluationStatisticsResponseDto[]> {
    const cacheKey = `eval:stats:experiment:ordinal:${evaluationId}`;

    const cached =
      await this.cacheManager.get<EvaluationStatisticsResponseDto[]>(cacheKey);
    if (cached) {
      return cached;
    }

    const evalId = await this.validateExperimentEvaluation(
      organisationId,
      projectId,
      evaluationId,
    );

    const evaluation = await this.evaluationLoaderService.loadEvaluationOrFail(
      organisationId,
      projectId,
      evalId,
    );

    if (!evaluation.experiments || evaluation.experiments.length === 0) {
      return [];
    }

    const rows: Array<{ experimentId: string }> =
      await this.scoreResultRepository.manager.query(
        `SELECT DISTINCT er.experiment_id AS "experimentId"
       FROM score_results sr
       INNER JOIN experiment_results er ON sr.experiment_result_id = er.id
       WHERE sr.evaluation_id = $1`,
        [evalId],
      );

    const experimentIdsWithData = new Set(rows.map((r) => r.experimentId));
    const statistics: EvaluationStatisticsResponseDto[] = [];

    for (const experiment of evaluation.experiments) {
      if (!experimentIdsWithData.has(experiment.id)) {
        continue;
      }

      for (const score of evaluation.scores || []) {
        if (score.scoringType !== ScoringType.ORDINAL) {
          continue;
        }

        const stats =
          await this.calculationOrchestrator.calculateStatisticsForScoreGroup(
            evalId,
            score,
            experiment.id,
          );

        statistics.push({
          experimentId: experiment.id,
          scoreId: score.id,
          numeric: null,
          nominal: null,
          ordinal: stats.ordinal || null,
        });
      }
    }

    await this.cacheManager.set(
      cacheKey,
      statistics,
      this.STATISTICS_CACHE_TTL,
    );
    return statistics;
  }
}
