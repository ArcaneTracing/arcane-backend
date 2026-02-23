import { Injectable } from "@nestjs/common";
import { ScoreResult } from "../../entities/score-result.entity";

@Injectable()
export class EvaluationResultGroupingService {
  groupResultsByDatasetRow(
    scoreResults: ScoreResult[],
  ): Map<string, ScoreResult[]> {
    const groupedResults = new Map<string, ScoreResult[]>();
    scoreResults
      .filter((sr): sr is ScoreResult & { datasetRowId: string } =>
        Boolean(sr.datasetRowId),
      )
      .forEach((scoreResult) => {
        const key = scoreResult.datasetRowId;
        let arr = groupedResults.get(key);
        if (!arr) {
          arr = [];
          groupedResults.set(key, arr);
        }
        arr.push(scoreResult);
      });
    return groupedResults;
  }

  groupResultsByDatasetRowAndExperiment(
    scoreResults: ScoreResult[],
  ): Map<string, ScoreResult[]> {
    const groupedResults = new Map<string, ScoreResult[]>();
    scoreResults
      .filter(
        (scoreResult) =>
          Boolean(scoreResult.datasetRowId) &&
          Boolean(scoreResult.experimentResultId),
      )
      .forEach((scoreResult) => {
        const key = `${scoreResult.datasetRowId}::${scoreResult.experimentResultId}`;
        let arr = groupedResults.get(key);
        if (!arr) {
          arr = [];
          groupedResults.set(key, arr);
        }
        arr.push(scoreResult);
      });
    return groupedResults;
  }
}
