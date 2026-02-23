import {
  EvaluationScope,
  EvaluationType,
} from "../../entities/evaluation.entity";
import { DatasetRowResponseDto } from "../../../datasets/dto/response/dataset-row.dto";

export class EvaluationScoreRefResponseDto {
  id: string;
  description: string;
  scoringType: string;
}

export class EvaluationExperimentRefResponseDto {
  id: string;
  promptVersionId: string;
  datasetId: string;
}

export class ScoreResultResponseDto {
  id: string;
  scoreId: string;
  value: number | null;
  reasoning?: string | null;
  status: string;
  datasetRowId?: string | null;
  experimentResultId?: string | null;
}

export class EvaluationResultResponseDto {
  id: string;
  datasetRowId?: string | null;
  datasetRow?: DatasetRowResponseDto | null;
  experimentResultId?: string | null;
  experimentResult?: string | null;
  scoreResults: ScoreResultResponseDto[];
  createdAt: Date;
}

export class EvaluationResponseDto {
  id: string;
  projectId: string;
  evaluationType: EvaluationType;
  evaluationScope: EvaluationScope;
  name: string;
  description?: string | null;
  datasetId?: string | null;
  metadata?: Record<string, unknown> | null;
  scoreMappings?: Record<string, Record<string, unknown>> | null;
  ragasModelConfigurationId?: string | null;
  scores: EvaluationScoreRefResponseDto[];
  experiments: EvaluationExperimentRefResponseDto[];
  createdAt: Date;
  updatedAt: Date;
}

export class ImportScoreResultsResponseDto {
  importedCount: number;
}
