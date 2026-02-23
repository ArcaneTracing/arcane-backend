import {
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
} from "class-validator";

export class CreateExperimentRequestDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsOptional()
  @IsString()
  description?: string | null;

  @IsUUID("4")
  promptVersionId: string;

  @IsUUID("4")
  datasetId: string;

  @IsOptional()
  @IsObject()
  promptInputMappings?: Record<string, string>;
}
