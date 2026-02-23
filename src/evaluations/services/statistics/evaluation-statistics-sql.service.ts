import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import {
  ScoreResult,
  ScoreResultStatus,
} from "../../entities/score-result.entity";
import {
  ScaleOption,
  OrdinalConfig,
} from "../../../scores/entities/score.entity";

export interface OrdinalRawResult {
  scoreId: string;
  cdf: Record<string, number>;
  p10: string | null;
  p50: string | null;
  p90: string | null;
  iqrRank: number | null;
  passRate: {
    acceptableCount: number;
    totalScored: number;
  } | null;
  tailMassBelow: {
    belowThresholdCount: number;
    totalScored: number;
  } | null;
  nTotal: number;
  nScored: number;
}

@Injectable()
export class EvaluationStatisticsSqlService {
  constructor(
    @InjectRepository(ScoreResult)
    private readonly scoreResultRepository: Repository<ScoreResult>,
  ) {}

  async getOrdinalAggregates(
    evaluationId: string,
    scoreId: string,
    scale: ScaleOption[],
    ordinalConfig?: OrdinalConfig | null,
    experimentId?: string,
  ): Promise<OrdinalRawResult> {
    const { join: countJoin, params: countParams } =
      this.buildExperimentJoinAndParams(evaluationId, scoreId, experimentId, 4);
    const totalCounts = await this.runCountQuery(countJoin, countParams);
    const nTotal = Number.parseInt(totalCounts?.n_total || "0", 10);
    const nScored = Number.parseInt(totalCounts?.n_scored || "0", 10);

    if (nScored === 0 || !scale?.length) {
      return this.buildEmptyOrdinalResult(scoreId, nTotal);
    }

    const cdf = await this.buildCdf(evaluationId, scoreId, experimentId);
    const rankToLabel = new Map(scale.map((opt) => [opt.value, opt.label]));
    const percentileResult = await this.runPercentileQuery(
      evaluationId,
      scoreId,
      scale,
      experimentId,
    );
    const passRate = await this.fetchPassRateIfConfigured(
      evaluationId,
      scoreId,
      scale,
      ordinalConfig,
      experimentId,
    );

    return this.buildOrdinalResult(
      scoreId,
      cdf,
      percentileResult,
      rankToLabel,
      passRate,
      nTotal,
      nScored,
    );
  }

  private static readonly EXPERIMENT_JOIN =
    "INNER JOIN experiment_results er ON sr.experiment_result_id = er.id AND er.experiment_id = $";

  private buildExperimentJoinAndParams(
    evaluationId: string,
    scoreId: string,
    experimentId?: string,
    paramIndex = 4,
  ): { join: string; params: unknown[] } {
    const join = experimentId
      ? `${EvaluationStatisticsSqlService.EXPERIMENT_JOIN}${paramIndex}`
      : "";
    const params: unknown[] = [evaluationId, scoreId, ScoreResultStatus.DONE];
    if (experimentId) params.push(experimentId);
    return { join, params };
  }

  private async runCountQuery(
    countJoin: string,
    countParams: unknown[],
  ): Promise<{ n_total: string; n_scored: string } | undefined> {
    const countSql = `
      SELECT
        COUNT(*) AS n_total,
        COUNT(*) FILTER (WHERE sr.status = $3 AND sr.value IS NOT NULL) AS n_scored
      FROM score_results sr
      ${countJoin}
      WHERE sr.evaluation_id = $1 AND sr.score_id = $2
    `;
    return (
      await this.scoreResultRepository.manager.query(countSql, countParams)
    )?.[0] as { n_total: string; n_scored: string } | undefined;
  }

  private buildEmptyOrdinalResult(
    scoreId: string,
    nTotal: number,
  ): OrdinalRawResult {
    return {
      scoreId,
      cdf: {},
      p10: null,
      p50: null,
      p90: null,
      iqrRank: null,
      passRate: null,
      tailMassBelow: null,
      nTotal,
      nScored: 0,
    };
  }

  private async buildCdf(
    evaluationId: string,
    scoreId: string,
    experimentId?: string,
  ): Promise<Record<string, number>> {
    const { join: experimentJoin, params: cdfParams } =
      this.buildExperimentJoinAndParams(evaluationId, scoreId, experimentId, 4);
    const cdfQuery = `
      WITH counts AS (
        SELECT sr.value::text AS code, COUNT(*)::int AS n
        FROM score_results sr
        ${experimentJoin}
        WHERE sr.evaluation_id = $1
          AND sr.score_id = $2
          AND sr.status = $3
          AND sr.value IS NOT NULL
        GROUP BY sr.value::text
      )
      SELECT
        code,
        SUM(n) OVER (ORDER BY code) AS cumulative_count,
        SUM(n) OVER () AS total_scored
      FROM counts
      ORDER BY code
    `;
    const cdfRows = await this.scoreResultRepository.query(cdfQuery, cdfParams);
    const totalScoredForCdf = Number.parseInt(
      cdfRows[0]?.total_scored || "0",
      10,
    );
    const cdf: Record<string, number> = {};
    for (const row of cdfRows) {
      const cumulative = Number.parseInt(row.cumulative_count, 10);
      cdf[row.code] =
        totalScoredForCdf > 0 ? cumulative / totalScoredForCdf : 0;
    }
    return cdf;
  }

  private async runPercentileQuery(
    evaluationId: string,
    scoreId: string,
    scale: ScaleOption[],
    experimentId?: string,
  ): Promise<
    | {
        p10: number | null;
        p50: number | null;
        p90: number | null;
        iqr_rank: number | null;
      }
    | undefined
  > {
    const rankCaseWhen = scale
      .map((opt) => `WHEN sr.value = ${opt.value} THEN ${opt.value}`)
      .join(" ");
    const { join: percentileJoin, params: queryParams } =
      this.buildExperimentJoinAndParams(evaluationId, scoreId, experimentId, 4);
    const percentileQuery = `
      SELECT 
        PERCENTILE_CONT(0.10) WITHIN GROUP (ORDER BY rank_value) as p10,
        PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY rank_value) as p50,
        PERCENTILE_CONT(0.90) WITHIN GROUP (ORDER BY rank_value) as p90,
        PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY rank_value) - 
        PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY rank_value) as iqr_rank
      FROM (
        SELECT 
          CASE ${rankCaseWhen} ELSE NULL END as rank_value
        FROM score_results sr
        ${percentileJoin}
        WHERE sr.evaluation_id = $1
          AND sr.score_id = $2
          AND sr.status = $3
          AND sr.value IS NOT NULL
      ) ranked
      WHERE rank_value IS NOT NULL
    `;
    const percentileRows = await this.scoreResultRepository.query(
      percentileQuery,
      queryParams,
    );
    return percentileRows?.[0] as
      | {
          p10: number | null;
          p50: number | null;
          p90: number | null;
          iqr_rank: number | null;
        }
      | undefined;
  }

  private async fetchPassRateIfConfigured(
    evaluationId: string,
    scoreId: string,
    scale: ScaleOption[],
    ordinalConfig?: OrdinalConfig | null,
    experimentId?: string,
  ): Promise<{ acceptableCount: number; totalScored: number } | null> {
    const acceptableSet = ordinalConfig?.acceptable_set;
    if (!acceptableSet?.length) return null;

    const acceptableLabels = new Set(acceptableSet);
    const acceptableValues = scale
      .filter((opt) => acceptableLabels.has(opt.label))
      .map((opt) => opt.value);
    const { join: passRateJoin, params: passRateParams } =
      this.buildExperimentJoinAndParams(evaluationId, scoreId, experimentId, 5);
    passRateParams.splice(3, 0, acceptableValues);

    const passRateSql = `
      SELECT
        COUNT(*) FILTER (WHERE sr.value = ANY($4::double precision[])) AS acceptable_count,
        COUNT(*) FILTER (WHERE sr.status = $3 AND sr.value IS NOT NULL) AS total_scored
      FROM score_results sr
      ${passRateJoin}
      WHERE sr.evaluation_id = $1 AND sr.score_id = $2
    `;
    const passRateRow = (
      await this.scoreResultRepository.manager.query(
        passRateSql,
        passRateParams,
      )
    )?.[0] as { acceptable_count: string; total_scored: string } | undefined;

    if (!passRateRow) return null;
    return {
      acceptableCount: Number.parseInt(passRateRow.acceptable_count || "0", 10),
      totalScored: Number.parseInt(passRateRow.total_scored || "0", 10),
    };
  }

  private buildOrdinalResult(
    scoreId: string,
    cdf: Record<string, number>,
    percentileResult:
      | {
          p10: number | null;
          p50: number | null;
          p90: number | null;
          iqr_rank: number | null;
        }
      | undefined,
    rankToLabel: Map<number, string>,
    passRate: { acceptableCount: number; totalScored: number } | null,
    nTotal: number,
    nScored: number,
  ): OrdinalRawResult {
    const toLabel = (rank: number | null | undefined) =>
      rank == null ? null : (rankToLabel.get(rank) ?? null);
    return {
      scoreId,
      cdf,
      p10: toLabel(percentileResult?.p10),
      p50: toLabel(percentileResult?.p50),
      p90: toLabel(percentileResult?.p90),
      iqrRank: percentileResult?.iqr_rank ?? null,
      passRate,
      tailMassBelow: null,
      nTotal,
      nScored,
    };
  }

  async getNumericCountAndPercentiles(
    evaluationId: string,
    scoreId: string,
    experimentId?: string,
  ): Promise<{
    nScored: number;
    nTotal: number;
    p10: number | null;
    p50: number | null;
    p90: number | null;
  }> {
    const countJoin = experimentId
      ? "INNER JOIN experiment_results er ON sr.experiment_result_id = er.id AND er.experiment_id = $4"
      : "";
    const countParams: unknown[] = [
      evaluationId,
      scoreId,
      ScoreResultStatus.DONE,
    ];
    if (experimentId) countParams.push(experimentId);
    const countSql = `
      SELECT
        COUNT(*) AS n_total,
        COUNT(*) FILTER (WHERE sr.status = $3 AND sr.value IS NOT NULL) AS n_scored
      FROM score_results sr
      ${countJoin}
      WHERE sr.evaluation_id = $1 AND sr.score_id = $2
    `;
    const counts = (
      await this.scoreResultRepository.manager.query(countSql, countParams)
    )?.[0] as { n_total: string; n_scored: string } | undefined;

    const nTotal = Number.parseInt(counts?.n_total || "0", 10);
    const nScored = Number.parseInt(counts?.n_scored || "0", 10);

    if (nScored === 0) {
      return {
        nTotal,
        nScored: 0,
        p10: null,
        p50: null,
        p90: null,
      };
    }

    const percentileJoin = experimentId
      ? "INNER JOIN experiment_results er ON sr.experiment_result_id = er.id AND er.experiment_id = $4"
      : "";
    const percentileParams: unknown[] = [
      evaluationId,
      scoreId,
      ScoreResultStatus.DONE,
    ];
    if (experimentId) percentileParams.push(experimentId);
    const percentileSql = `
      SELECT
        PERCENTILE_CONT(0.10) WITHIN GROUP (ORDER BY sr.value::numeric) AS p10,
        PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY sr.value::numeric) AS p50,
        PERCENTILE_CONT(0.90) WITHIN GROUP (ORDER BY sr.value::numeric) AS p90
      FROM score_results sr
      ${percentileJoin}
      WHERE sr.evaluation_id = $1 AND sr.score_id = $2
        AND sr.status = $3 AND sr.value IS NOT NULL
    `;
    const percentiles = (
      await this.scoreResultRepository.manager.query(
        percentileSql,
        percentileParams,
      )
    )?.[0] as
      | { p10: number | null; p50: number | null; p90: number | null }
      | undefined;

    return {
      nTotal,
      nScored,
      p10: percentiles?.p10 ?? null,
      p50: percentiles?.p50 ?? null,
      p90: percentiles?.p90 ?? null,
    };
  }
}
