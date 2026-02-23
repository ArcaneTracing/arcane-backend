import { Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import {
  ScoreResult,
  ScoreResultStatus,
} from "../../entities/score-result.entity";
const incrmean = require("@stdlib/stats-incr-mean") as () => (
  x?: number,
) => number | null;
const incrvariance = require("@stdlib/stats-incr-variance") as () => (
  x?: number,
) => number | null;

const DEFAULT_BATCH_SIZE = 2000;

export interface StreamScoreResultRow {
  scoreId: string;
  value: number | null;
  status: string;
  id: string;
  createdAt: Date;
}

@Injectable()
export class EvaluationStatisticsStreamingService {
  private readonly logger = new Logger(
    EvaluationStatisticsStreamingService.name,
  );

  constructor(
    @InjectRepository(ScoreResult)
    private readonly scoreResultRepository: Repository<ScoreResult>,
  ) {}

  async *streamByEvaluationAndScore(
    evaluationId: string,
    scoreId: string,
    batchSize: number = DEFAULT_BATCH_SIZE,
  ): AsyncGenerator<StreamScoreResultRow[]> {
    const sql = `
      SELECT sr.id, sr.created_at AS "createdAt", sr.score_id AS "scoreId", sr.value, sr.status
      FROM score_results sr
      WHERE sr.evaluation_id = $1 AND sr.score_id = $2
      ORDER BY sr.created_at ASC, sr.id ASC
      OFFSET $3 LIMIT $4
    `;
    yield* this.executeStream(
      sql,
      (skip) => [evaluationId, scoreId, skip, batchSize],
      batchSize,
    );
  }

  async *streamByEvaluationExperimentAndScore(
    evaluationId: string,
    experimentId: string,
    scoreId: string,
    batchSize: number = DEFAULT_BATCH_SIZE,
  ): AsyncGenerator<StreamScoreResultRow[]> {
    const sql = `
      SELECT sr.id, sr.created_at AS "createdAt", sr.score_id AS "scoreId", sr.value, sr.status
      FROM score_results sr
      INNER JOIN experiment_results er ON sr.experiment_result_id = er.id AND er.experiment_id = $5
      WHERE sr.evaluation_id = $1 AND sr.score_id = $2
      ORDER BY sr.created_at ASC, sr.id ASC
      OFFSET $3 LIMIT $4
    `;
    yield* this.executeStream(
      sql,
      (skip) => [evaluationId, scoreId, skip, batchSize, experimentId],
      batchSize,
    );
  }

  private async *executeStream(
    sql: string,
    buildParams: (skip: number) => unknown[],
    batchSize: number,
  ): AsyncGenerator<StreamScoreResultRow[]> {
    let skip = 0;
    let hasMore = true;

    while (hasMore) {
      const rawRows: Array<{
        id: string;
        createdAt: string | Date;
        scoreId: string;
        value: number | null;
        status: string;
      }> = await this.scoreResultRepository.manager.query(
        sql,
        buildParams(skip),
      );

      const batch: StreamScoreResultRow[] = rawRows.map((r) => ({
        id: r.id,
        createdAt:
          typeof r.createdAt === "string" ? new Date(r.createdAt) : r.createdAt,
        scoreId: r.scoreId,
        value: r.value,
        status: r.status,
      }));

      if (batch.length === 0) {
        break;
      }

      yield batch;
      skip += batchSize;

      if (batch.length < batchSize) {
        hasMore = false;
      }
    }
  }

  async aggregateNominalFromStream(
    evaluationId: string,
    scoreId: string,
    experimentId?: string,
  ): Promise<{
    countsByCode: Record<string, number>;
    nTotal: number;
    nScored: number;
    modeCode: string | null;
  }> {
    const countsByCode = new Map<string, number>();
    let nTotal = 0;
    let nScored = 0;

    const stream = experimentId
      ? this.streamByEvaluationExperimentAndScore(
          evaluationId,
          experimentId,
          scoreId,
        )
      : this.streamByEvaluationAndScore(evaluationId, scoreId);

    for await (const batch of stream) {
      for (const result of batch) {
        nTotal++;

        if (
          result.status === ScoreResultStatus.DONE &&
          result.value !== null &&
          result.value !== undefined
        ) {
          nScored++;
          const code = String(result.value ?? "");
          countsByCode.set(code, (countsByCode.get(code) || 0) + 1);
        }
      }
    }

    let modeCode: string | null = null;
    let maxCount = 0;
    for (const [code, count] of countsByCode.entries()) {
      if (count > maxCount) {
        maxCount = count;
        modeCode = code;
      }
    }

    const countsRecord: Record<string, number> = {};
    for (const [code, count] of countsByCode.entries()) {
      countsRecord[code] = count;
    }

    return {
      countsByCode: countsRecord,
      nTotal,
      nScored,
      modeCode,
    };
  }

  async aggregateNumericFromStream(
    evaluationId: string,
    scoreId: string,
    experimentId?: string,
  ): Promise<{
    mean: number;
    variance: number;
    std: number;
  }> {
    const meanAccumulator = incrmean();
    const varianceAccumulator = incrvariance();

    const stream = experimentId
      ? this.streamByEvaluationExperimentAndScore(
          evaluationId,
          experimentId,
          scoreId,
        )
      : this.streamByEvaluationAndScore(evaluationId, scoreId);

    for await (const batch of stream) {
      for (const result of batch) {
        if (
          result.status === ScoreResultStatus.DONE &&
          result.value !== null &&
          result.value !== undefined &&
          !Number.isNaN(result.value)
        ) {
          meanAccumulator(result.value);
          varianceAccumulator(result.value);
        }
      }
    }

    const mean = meanAccumulator();
    const variance = varianceAccumulator();
    const std = Math.sqrt(variance);

    return {
      mean: mean || 0,
      variance: variance || 0,
      std: std || 0,
    };
  }

  async *streamPairedRows(
    evaluationId: string,
    scoreId: string,
    experimentIdA: string,
    experimentIdB: string,
    batchSize: number = DEFAULT_BATCH_SIZE,
  ): AsyncGenerator<Array<{ valueA: string; valueB: string }>> {
    let skip = 0;
    let hasMore = true;

    const sql = `
      SELECT sr_a.value AS val_a, sr_b.value AS val_b
      FROM (
        SELECT er_a.id AS id_a, er_b.id AS id_b, er_a.dataset_row_id AS dataset_row_id
        FROM experiment_results er_a
        JOIN experiment_results er_b
          ON er_b.dataset_row_id = er_a.dataset_row_id
         AND er_b.experiment_id = $2
        WHERE er_a.experiment_id = $1
        ORDER BY er_a.dataset_row_id ASC
      ) paired
      JOIN score_results sr_a
        ON sr_a.experiment_result_id = paired.id_a
       AND sr_a.evaluation_id = $3
       AND sr_a.score_id = $4
       AND sr_a.status = 'DONE'
       AND sr_a.value IS NOT NULL
      JOIN score_results sr_b
        ON sr_b.experiment_result_id = paired.id_b
       AND sr_b.evaluation_id = $3
       AND sr_b.score_id = $4
       AND sr_b.status = 'DONE'
       AND sr_b.value IS NOT NULL
      ORDER BY paired.dataset_row_id ASC
      OFFSET $5 LIMIT $6
    `;

    while (hasMore) {
      const rawRows: Array<{ val_a: string | number; val_b: string | number }> =
        await this.scoreResultRepository.manager.query(sql, [
          experimentIdA,
          experimentIdB,
          evaluationId,
          scoreId,
          skip,
          batchSize,
        ]);
      const batch = (rawRows ?? []).map((r) => ({
        valueA: String(r.val_a ?? ""),
        valueB: String(r.val_b ?? ""),
      }));

      if (batch.length === 0) {
        break;
      }

      yield batch;
      skip += batchSize;

      if (batch.length < batchSize) {
        hasMore = false;
      }
    }
  }
}
