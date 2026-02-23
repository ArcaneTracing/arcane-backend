import { IsNotEmpty, IsString, IsUUID } from "class-validator";

export class CreateExperimentResultRequestDto {
  @IsUUID("4")
  datasetRowId: string;

  @IsString()
  @IsNotEmpty()
  result: string;
}
