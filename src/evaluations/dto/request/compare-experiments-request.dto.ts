import { IsUUID } from "class-validator";

export class CompareExperimentsRequestDto {
  @IsUUID("4")
  experimentIdA: string;

  @IsUUID("4")
  experimentIdB: string;

  @IsUUID("4")
  scoreId: string;
}
