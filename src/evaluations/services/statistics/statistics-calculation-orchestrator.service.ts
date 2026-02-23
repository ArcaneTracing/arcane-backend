import { Injectable } from "@nestjs/common";
import {
  ScoreResult,
  ScoreResultStatus,
} from "../../entities/score-result.entity";
import { Score, ScoringType } from "../../../scores/entities/score.entity";
import { EvaluationStatisticsService } from "./evaluation-statistics.service";
import { EvaluationStatisticsSqlService } from "./evaluation-statistics-sql.service";
import { EvaluationStatisticsStreamingService } from "./evaluation-statistics-streaming.service";
import {
  NumericDatasetStatisticsResponseDto,
  NumericEvaluationStatisticsResponseDto,
} from "../../dto/response/numeric-statistics-response.dto";
import { NominalStatisticsResponseDto } from "../../dto/response/nominal-statistics-response.dto";
import { OrdinalStatisticsResponseDto } from "../../dto/response/ordinal-statistics-response.dto";

@Injectable()
export class StatisticsCalculationOrchestrator {
  constructor(
    private readonly evaluationStatisticsService: EvaluationStatisticsService,
    private readonly sqlService: EvaluationStatisticsSqlService,
    private readonly streamingService: EvaluationStatisticsStreamingService,
  ) {}

  filterScoredResults(scoreResults: ScoreResult[]): ScoreResult[] {
    return scoreResults.filter(
      (result) =>
        result.status === ScoreResultStatus.DONE &&
        result.value !== null &&
        result.value !== undefined,
    );
  }

  extractCategoryValues(scoreResults: ScoreResult[]): string[] {
    return scoreResults
      .map((result) => String(result.value))
      .filter((val) => val !== "null" && val !== "undefined");
  }

  extractNumericValues(scoreResults: ScoreResult[]): number[] {
    return scoreResults
      .map((result) => {
        const value = result.value;
        if (typeof value === "number") {
          return value;
        }
        if (typeof value === "string") {
          const parsed = Number.parseFloat(value);
          return Number.isNaN(parsed) ? null : parsed;
        }
        return null;
      })
      .filter((val): val is number => val !== null);
  }

  calculateStatisticsForScoreGroupFromMemory(
    scoreResults: ScoreResult[],
    score: Score,
    totalCount: number,
  ): {
    nominal?: NominalStatisticsResponseDto;
    ordinal?: OrdinalStatisticsResponseDto;
    numeric?:
      | NumericDatasetStatisticsResponseDto
      | NumericEvaluationStatisticsResponseDto;
  } {
    const scoredResults = this.filterScoredResults(scoreResults);

    if (score.scoringType === ScoringType.NOMINAL) {
      const categoryValues = this.extractCategoryValues(scoredResults);
      const stats = this.evaluationStatisticsService.calculateNominalStatistics(
        categoryValues,
        totalCount,
      );
      return {
        nominal: {
          scoreId: score.id,
          ...stats,
        },
      };
    } else if (score.scoringType === ScoringType.ORDINAL) {
      const categoryValues = this.extractCategoryValues(scoredResults);
      const stats = this.evaluationStatisticsService.calculateOrdinalStatistics(
        categoryValues,
        totalCount,
        score.scale || null,
        score.ordinalConfig || null,
      );
      return {
        ordinal: {
          scoreId: score.id,
          ...stats,
        },
      };
    } else if (
      score.scoringType === ScoringType.NUMERIC ||
      score.scoringType === ScoringType.RAGAS
    ) {
      const numericValues = this.extractNumericValues(scoredResults);
      const stats = this.evaluationStatisticsService.calculateStatistics(
        numericValues,
        totalCount,
      );
      return {
        numeric: stats,
      };
    }

    return {};
  }

  async calculateStatisticsForScoreGroup(
    evaluationId: string,
    score: Score,
    experimentId?: string,
  ): Promise<{
    nominal?: NominalStatisticsResponseDto;
    ordinal?: OrdinalStatisticsResponseDto;
    numeric?:
      | NumericDatasetStatisticsResponseDto
      | NumericEvaluationStatisticsResponseDto;
  }> {
    if (score.scoringType === ScoringType.NOMINAL) {
      const aggregated = await this.streamingService.aggregateNominalFromStream(
        evaluationId,
        score.id,
        experimentId,
      );

      const stats =
        this.evaluationStatisticsService.calculateNominalStatisticsFromCounts(
          aggregated.countsByCode,
          aggregated.nTotal,
          aggregated.nScored,
        );

      return {
        nominal: {
          scoreId: score.id,
          ...stats,
        },
      };
    } else if (score.scoringType === ScoringType.ORDINAL) {
      const rawResult = await this.sqlService.getOrdinalAggregates(
        evaluationId,
        score.id,
        score.scale || [],
        score.ordinalConfig || null,
        experimentId,
      );

      const nominalAggregated =
        await this.streamingService.aggregateNominalFromStream(
          evaluationId,
          score.id,
          experimentId,
        );
      const nominalStats =
        this.evaluationStatisticsService.calculateNominalStatisticsFromCounts(
          nominalAggregated.countsByCode,
          rawResult.nTotal,
          rawResult.nScored,
        );

      const ordinalStats: OrdinalStatisticsResponseDto = {
        ...nominalStats,
        scoreId: score.id,
        median_category: rawResult.p50,
        percentile_categories: {
          p10: rawResult.p10,
          p50: rawResult.p50,
          p90: rawResult.p90,
        },
        cdf: rawResult.cdf,
        iqr_rank: rawResult.iqrRank,
        pass_rate: rawResult.passRate
          ? {
              acceptable_set: score.ordinalConfig?.acceptable_set || [],
              proportion:
                rawResult.passRate.acceptableCount /
                rawResult.passRate.totalScored,
              ci: this.evaluationStatisticsService.wilsonCI(
                rawResult.passRate.totalScored,
                rawResult.passRate.acceptableCount,
              ),
            }
          : null,
        tail_mass_below: null,
      };

      return {
        ordinal: ordinalStats,
      };
    } else if (
      score.scoringType === ScoringType.NUMERIC ||
      score.scoringType === ScoringType.RAGAS
    ) {
      const [numericAggregated, sqlResult] = await Promise.all([
        this.streamingService.aggregateNumericFromStream(
          evaluationId,
          score.id,
          experimentId,
        ),
        this.sqlService.getNumericCountAndPercentiles(
          evaluationId,
          score.id,
          experimentId,
        ),
      ]);

      const stats =
        this.evaluationStatisticsService.buildNumericStatisticsFromAggregates(
          numericAggregated.mean,
          numericAggregated.std,
          sqlResult.nScored,
          sqlResult.nTotal,
          sqlResult.p10,
          sqlResult.p50,
          sqlResult.p90,
        );

      return {
        numeric: stats,
      };
    }

    return {};
  }
}
