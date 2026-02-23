import { Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import {
  ScoreResult,
  ScoreResultStatus,
} from "../../entities/score-result.entity";
import { ExperimentResult } from "../../../experiments/entities/experiment-result.entity";

export interface PairedData<T> {
  pairedData: Array<{ valueA: T; valueB: T }>;
  commonDatasetRowIds: string[];
}

export interface ExperimentResultMaps {
  mapA: Map<string, string>;
  mapB: Map<string, string>;
}

export interface ScoreResultValueRow {
  experimentResultId: string;
  value: number | null;
}

@Injectable()
export class ExperimentComparisonDataBuilder {
  private readonly logger = new Logger(ExperimentComparisonDataBuilder.name);

  constructor(
    @InjectRepository(ExperimentResult)
    private readonly experimentResultRepository: Repository<ExperimentResult>,
    @InjectRepository(ScoreResult)
    private readonly scoreResultRepository: Repository<ScoreResult>,
  ) {}

  async buildExperimentResultMaps(
    experimentIdA: string,
    experimentIdB: string,
  ): Promise<ExperimentResultMaps> {
    const sql = `SELECT id, dataset_row_id AS "datasetRowId" FROM experiment_results WHERE experiment_id = $1`;
    const [rowsA, rowsB] = await Promise.all([
      this.scoreResultRepository.manager.query(sql, [experimentIdA]),
      this.scoreResultRepository.manager.query(sql, [experimentIdB]),
    ]);

    const mapA = new Map<string, string>();
    const mapB = new Map<string, string>();

    for (const row of rowsA) {
      mapA.set(row.datasetRowId, row.id);
    }
    for (const row of rowsB) {
      mapB.set(row.datasetRowId, row.id);
    }

    return { mapA, mapB };
  }

  extractScoreValuesAsStrings(
    scoreResults: ReadonlyArray<ScoreResultValueRow>,
  ): Map<string, string> {
    const scoreMap = new Map<string, string>();
    for (const scoreResult of scoreResults) {
      if (
        scoreResult.experimentResultId &&
        scoreResult.value !== null &&
        scoreResult.value !== undefined
      ) {
        const categoryCode = String(scoreResult.value ?? "");
        scoreMap.set(scoreResult.experimentResultId, categoryCode);
      }
    }
    return scoreMap;
  }

  extractScoreValuesAsNumbers(
    scoreResults: ReadonlyArray<ScoreResultValueRow>,
  ): Map<string, number> {
    const scoreMap = new Map<string, number>();
    for (const scoreResult of scoreResults) {
      if (
        scoreResult.experimentResultId &&
        scoreResult.value !== null &&
        scoreResult.value !== undefined
      ) {
        const num =
          typeof scoreResult.value === "number"
            ? scoreResult.value
            : Number(scoreResult.value);
        if (!Number.isNaN(num)) {
          scoreMap.set(scoreResult.experimentResultId, num);
        }
      }
    }
    return scoreMap;
  }

  buildPairedDataForStrings(
    commonDatasetRowIds: string[],
    experimentResultMapA: Map<string, string>,
    experimentResultMapB: Map<string, string>,
    scoreMap: Map<string, string>,
  ): Array<{ valueA: string; valueB: string }> {
    const pairedData: Array<{ valueA: string; valueB: string }> = [];
    for (const datasetRowId of commonDatasetRowIds) {
      const experimentResultIdA = experimentResultMapA.get(datasetRowId);
      const experimentResultIdB = experimentResultMapB.get(datasetRowId);

      if (experimentResultIdA && experimentResultIdB) {
        const valueA = scoreMap.get(experimentResultIdA);
        const valueB = scoreMap.get(experimentResultIdB);

        if (valueA !== undefined && valueB !== undefined) {
          pairedData.push({ valueA, valueB });
        }
      }
    }
    return pairedData;
  }

  buildPairedDataForNumbers(
    commonDatasetRowIds: string[],
    experimentResultMapA: Map<string, string>,
    experimentResultMapB: Map<string, string>,
    scoreMap: Map<string, number>,
  ): Array<{ valueA: number; valueB: number }> {
    const pairedData: Array<{ valueA: number; valueB: number }> = [];
    for (const datasetRowId of commonDatasetRowIds) {
      const experimentResultIdA = experimentResultMapA.get(datasetRowId);
      const experimentResultIdB = experimentResultMapB.get(datasetRowId);

      if (experimentResultIdA && experimentResultIdB) {
        const valueA = scoreMap.get(experimentResultIdA);
        const valueB = scoreMap.get(experimentResultIdB);

        if (valueA !== undefined && valueB !== undefined) {
          pairedData.push({ valueA, valueB });
        }
      }
    }
    return pairedData;
  }

  async getScoreResults(
    evaluationId: string,
    scoreId: string,
  ): Promise<ScoreResultValueRow[]> {
    const rows: ScoreResultValueRow[] =
      await this.scoreResultRepository.manager.query(
        `SELECT experiment_result_id AS "experimentResultId", value
       FROM score_results
       WHERE evaluation_id = $1 AND score_id = $2
         AND status = $3 AND experiment_result_id IS NOT NULL`,
        [evaluationId, scoreId, ScoreResultStatus.DONE],
      );
    return rows;
  }

  findCommonDatasetRowIds(
    experimentResultMapA: Map<string, string>,
    experimentResultMapB: Map<string, string>,
  ): string[] {
    return Array.from(experimentResultMapA.keys()).filter((datasetId) =>
      experimentResultMapB.has(datasetId),
    );
  }

  async getPairedNumericAggregates(
    evaluationId: string,
    scoreId: string,
    experimentIdA: string,
    experimentIdB: string,
  ): Promise<{
    n_paired: number;
    mean_a: number;
    mean_b: number;
    delta_mean: number;
    std_delta: number;
    win_rate: number;
    loss_rate: number;
    tie_rate: number;
  } | null> {
    const sql = `
      SELECT
        COUNT(*)::int AS n_paired,
        AVG(sr_a.value) AS mean_a,
        AVG(sr_b.value) AS mean_b,
        AVG(sr_b.value - sr_a.value) AS delta_mean,
        STDDEV_SAMP(sr_b.value - sr_a.value) AS std_delta,
        (COUNT(*) FILTER (WHERE (sr_b.value - sr_a.value) > 0))::double precision / NULLIF(COUNT(*), 0) AS win_rate,
        (COUNT(*) FILTER (WHERE (sr_b.value - sr_a.value) < 0))::double precision / NULLIF(COUNT(*), 0) AS loss_rate,
        (COUNT(*) FILTER (WHERE (sr_b.value - sr_a.value) = 0))::double precision / NULLIF(COUNT(*), 0) AS tie_rate
      FROM (
        SELECT er_a.id AS id_a, er_b.id AS id_b
        FROM experiment_results er_a
        JOIN experiment_results er_b
          ON er_b.dataset_row_id = er_a.dataset_row_id
         AND er_b.experiment_id = $2
        WHERE er_a.experiment_id = $1
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
    `;
    const params = [experimentIdA, experimentIdB, evaluationId, scoreId];

    await this.scoreResultRepository.manager.query(
      "ANALYZE experiment_results",
    );
    await this.scoreResultRepository.manager.query("ANALYZE score_results");

    const raw = await this.scoreResultRepository.manager.query(sql, params);
    const row = raw?.[0];
    if (!row || row.n_paired === 0) return null;
    return {
      n_paired: row.n_paired,
      mean_a: row.mean_a ?? 0,
      mean_b: row.mean_b ?? 0,
      delta_mean: row.delta_mean ?? 0,
      std_delta: row.std_delta ?? 0,
      win_rate: row.win_rate ?? 0,
      loss_rate: row.loss_rate ?? 0,
      tie_rate: row.tie_rate ?? 0,
    };
  }

  async getPairedChangeTable(
    evaluationId: string,
    scoreId: string,
    experimentIdA: string,
    experimentIdB: string,
  ): Promise<
    Array<{ val_a: string | number; val_b: string | number; n: number }>
  > {
    const raw = await this.scoreResultRepository.manager.query(
      `
      WITH paired AS (
        SELECT sr_a.value AS val_a, sr_b.value AS val_b
        FROM experiment_results er_a
        JOIN score_results sr_a
          ON sr_a.experiment_result_id = er_a.id
         AND sr_a.evaluation_id = $3
         AND sr_a.score_id = $4
         AND sr_a.status = 'DONE'
         AND sr_a.value IS NOT NULL
        JOIN experiment_results er_b
          ON er_b.dataset_row_id = er_a.dataset_row_id
         AND er_b.experiment_id = $2
        JOIN score_results sr_b
          ON sr_b.experiment_result_id = er_b.id
         AND sr_b.evaluation_id = $3
         AND sr_b.score_id = sr_a.score_id
         AND sr_b.status = 'DONE'
         AND sr_b.value IS NOT NULL
        WHERE er_a.experiment_id = $1
      )
      SELECT val_a, val_b, COUNT(*)::int AS n
      FROM paired
      GROUP BY val_a, val_b
      `,
      [experimentIdA, experimentIdB, evaluationId, scoreId],
    );
    return (raw ?? []).map(
      (r: { val_a: number; val_b: number; n: number }) => ({
        val_a: r.val_a,
        val_b: r.val_b,
        n: r.n,
      }),
    );
  }
}
