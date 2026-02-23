import { ScoreResultResponseDto } from "./evaluation-response.dto";

export class ExperimentScoresResponseDto {
  experimentId: string;
  evaluationId: string;
  scoreResults: ScoreResultResponseDto[];
  totalCount: number;
}
