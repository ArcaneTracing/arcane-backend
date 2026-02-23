import { Evaluation } from "../entities/evaluation.entity";
import { ScoreResult } from "../entities/score-result.entity";
import { DatasetRow } from "../../datasets/entities/dataset-row.entity";
import {
  EvaluationExperimentRefResponseDto,
  EvaluationResponseDto,
  EvaluationResultResponseDto,
  EvaluationScoreRefResponseDto,
  ScoreResultResponseDto,
} from "../dto/response/evaluation-response.dto";
import { DatasetMapper } from "../../datasets/mappers";

export class EvaluationMapper {
  static toScoreResultDto(scoreResult: ScoreResult): ScoreResultResponseDto {
    return {
      id: scoreResult.id,
      scoreId: scoreResult.scoreId,
      value: scoreResult.value,
      reasoning: scoreResult.reasoning ?? null,
      status: scoreResult.status,
      datasetRowId: scoreResult.datasetRowId ?? null,
      experimentResultId: scoreResult.experimentResultId ?? null,
    };
  }

  static toEvaluationResultDto(
    scoreResults: ScoreResult[],
    datasetRowId: string | null,
    experimentResultId: string | null,
    createdAt: Date,
    datasetRow?: DatasetRow | null,
    experimentResult?: string | null,
  ): EvaluationResultResponseDto {
    const id = `${scoreResults[0]?.evaluationId}-${datasetRowId ?? "null"}-${experimentResultId ?? "null"}`;

    return {
      id,
      datasetRowId: datasetRowId ?? null,
      datasetRow: datasetRow ? DatasetMapper.toRowDto(datasetRow) : null,
      experimentResultId: experimentResultId ?? null,
      experimentResult: experimentResult ?? null,
      createdAt,
      scoreResults: scoreResults.map((scoreResult) =>
        this.toScoreResultDto(scoreResult),
      ),
    };
  }

  static toDto(evaluation: Evaluation): EvaluationResponseDto {
    return {
      id: evaluation.id,
      projectId: evaluation.projectId,
      evaluationType: evaluation.evaluationType,
      evaluationScope: evaluation.evaluationScope,
      name: evaluation.name,
      description: evaluation.description ?? null,
      datasetId: evaluation.datasetId ?? null,
      metadata: evaluation.metadata || null,
      scoreMappings: evaluation.scoreMappings || null,
      ragasModelConfigurationId: evaluation.ragasModelConfigurationId ?? null,
      scores: (evaluation.scores || []).map<EvaluationScoreRefResponseDto>(
        (score) => ({
          id: score.id,
          description: score.description,
          scoringType: score.scoringType,
        }),
      ),
      experiments: (
        evaluation.experiments || []
      ).map<EvaluationExperimentRefResponseDto>((experiment) => ({
        id: experiment.id,
        promptVersionId: experiment.promptVersionId,
        datasetId: experiment.datasetId,
      })),
      createdAt: evaluation.createdAt,
      updatedAt: evaluation.updatedAt,
    };
  }
}
