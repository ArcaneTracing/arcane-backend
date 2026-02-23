import {
  OrdinalConfig,
  ScaleOption,
  ScoringType,
} from "../../entities/score.entity";

export interface ScoreEvaluatorResponseDto {
  id: string;
  name?: string | null;
}

export interface ScoreResponseDto {
  id: string;
  projectId: string | null;
  name: string;
  description: string;
  scoringType: ScoringType;
  scale?: ScaleOption[] | null;
  ordinalConfig?: OrdinalConfig | null;
  evaluatorPrompt?: ScoreEvaluatorResponseDto | null;
  ragasScoreKey?: string | null;
  createdAt: Date;
  updatedAt: Date;
}
