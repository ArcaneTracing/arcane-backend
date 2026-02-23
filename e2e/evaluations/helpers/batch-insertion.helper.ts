import { DataSource } from "typeorm";
import { DatasetRow } from "../../../src/datasets/entities/dataset-row.entity";
import {
  ScoreResult,
  ScoreResultStatus,
} from "../../../src/evaluations/entities/score-result.entity";
import { ExperimentResult } from "../../../src/experiments/entities/experiment-result.entity";

const DEFAULT_BATCH_SIZE = 1000;
const log = (msg: string) => console.log(`[E2E] ${msg}`);

export async function batchInsertDatasetRows(
  dataSource: DataSource,
  datasetId: string,
  numRows: number,
  batchSize: number = DEFAULT_BATCH_SIZE,
): Promise<DatasetRow[]> {
  const datasetRowRepo = dataSource.getRepository(DatasetRow);
  const allRows: DatasetRow[] = [];
  const totalBatches = Math.ceil(numRows / batchSize);

  for (let i = 0; i < numRows; i += batchSize) {
    const batchNum = Math.floor(i / batchSize) + 1;
    if (
      totalBatches > 5 &&
      (batchNum === 1 || batchNum % 10 === 0 || batchNum === totalBatches)
    ) {
      log(`    Dataset rows: batch ${batchNum}/${totalBatches}`);
    }
    const batchSizeActual = Math.min(batchSize, numRows - i);
    const batch: DatasetRow[] = [];

    for (let j = 0; j < batchSizeActual; j++) {
      const rowIndex = i + j;
      batch.push(
        datasetRowRepo.create({
          datasetId,
          values: [`test input ${rowIndex}`, `test output ${rowIndex}`],
        }),
      );
    }

    const saved = await dataSource.manager.transaction(async (manager) => {
      return manager.getRepository(DatasetRow).save(batch);
    });

    allRows.push(...saved);
  }

  return allRows;
}

export async function batchInsertScoreResults(
  dataSource: DataSource,
  evaluationId: string,
  scoreId: string,
  datasetRows: DatasetRow[],
  values: number[],
  batchSize: number = DEFAULT_BATCH_SIZE,
): Promise<void> {
  const scoreResultRepo = dataSource.getRepository(ScoreResult);

  if (datasetRows.length !== values.length) {
    throw new Error(
      `Dataset rows length (${datasetRows.length}) must match values length (${values.length})`,
    );
  }

  const totalBatches = Math.ceil(datasetRows.length / batchSize);

  for (let i = 0; i < datasetRows.length; i += batchSize) {
    const batchNum = Math.floor(i / batchSize) + 1;
    if (
      totalBatches > 5 &&
      (batchNum === 1 || batchNum % 10 === 0 || batchNum === totalBatches)
    ) {
      log(`    Score results: batch ${batchNum}/${totalBatches}`);
    }
    const batchSizeActual = Math.min(batchSize, datasetRows.length - i);
    const batch: ScoreResult[] = [];

    for (let j = 0; j < batchSizeActual; j++) {
      const index = i + j;
      batch.push(
        scoreResultRepo.create({
          evaluationId,
          scoreId,
          datasetRowId: datasetRows[index].id,
          value: values[index],
          status: ScoreResultStatus.DONE,
        }),
      );
    }

    await dataSource.manager.transaction(async (manager) => {
      await manager.getRepository(ScoreResult).save(batch);
    });
  }
}

export async function batchInsertScoreResultsForExperiment(
  dataSource: DataSource,
  evaluationId: string,
  scoreId: string,
  experimentResults: ExperimentResult[],
  values: number[],
  batchSize: number = DEFAULT_BATCH_SIZE,
): Promise<void> {
  const scoreResultRepo = dataSource.getRepository(ScoreResult);

  if (experimentResults.length !== values.length) {
    throw new Error(
      `Experiment results length (${experimentResults.length}) must match values length (${values.length})`,
    );
  }

  const totalBatches = Math.ceil(experimentResults.length / batchSize);

  for (let i = 0; i < experimentResults.length; i += batchSize) {
    const batchNum = Math.floor(i / batchSize) + 1;
    if (
      totalBatches > 5 &&
      (batchNum === 1 || batchNum % 10 === 0 || batchNum === totalBatches)
    ) {
      log(`    Score results (exp): batch ${batchNum}/${totalBatches}`);
    }
    const batchSizeActual = Math.min(batchSize, experimentResults.length - i);
    const batch: ScoreResult[] = [];

    for (let j = 0; j < batchSizeActual; j++) {
      const index = i + j;
      batch.push(
        scoreResultRepo.create({
          evaluationId,
          scoreId,
          experimentResultId: experimentResults[index].id,
          value: values[index],
          status: ScoreResultStatus.DONE,
        }),
      );
    }

    await dataSource.manager.transaction(async (manager) => {
      await manager.getRepository(ScoreResult).save(batch);
    });
  }
}

export async function batchInsertExperimentResults(
  dataSource: DataSource,
  experimentId: string,
  datasetRows: DatasetRow[],
  batchSize: number = DEFAULT_BATCH_SIZE,
): Promise<ExperimentResult[]> {
  const experimentResultRepo = dataSource.getRepository(ExperimentResult);
  const allResults: ExperimentResult[] = [];
  const totalBatches = Math.ceil(datasetRows.length / batchSize);

  for (let i = 0; i < datasetRows.length; i += batchSize) {
    const batchNum = Math.floor(i / batchSize) + 1;
    if (
      totalBatches > 5 &&
      (batchNum === 1 || batchNum % 10 === 0 || batchNum === totalBatches)
    ) {
      log(`    Experiment results: batch ${batchNum}/${totalBatches}`);
    }
    const batchSizeActual = Math.min(batchSize, datasetRows.length - i);
    const batch: ExperimentResult[] = [];

    for (let j = 0; j < batchSizeActual; j++) {
      const index = i + j;
      batch.push(
        experimentResultRepo.create({
          experimentId,
          datasetRowId: datasetRows[index].id,
          status: "DONE" as any,
        }),
      );
    }

    const saved = await dataSource.manager.transaction(async (manager) => {
      return manager.getRepository(ExperimentResult).save(batch);
    });

    allResults.push(...saved);
  }

  return allResults;
}
