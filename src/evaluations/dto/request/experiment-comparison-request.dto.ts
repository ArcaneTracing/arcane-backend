import { IsUUID } from "class-validator";

export class ExperimentComparisonRequestDto {
  @IsUUID("4")
  evaluationId: string;

  @IsUUID("4")
  experimentIdA: string;

  @IsUUID("4")
  experimentIdB: string;

  @IsUUID("4")
  scoreId: string;
}
