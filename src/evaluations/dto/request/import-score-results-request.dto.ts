import {
  ArrayMinSize,
  IsArray,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  ValidateNested,
} from "class-validator";
import { Type } from "class-transformer";

export class ImportScoreResultRowDto {
  @IsOptional()
  @IsUUID("4")
  datasetRowId?: string;

  @IsOptional()
  @IsUUID("4")
  experimentResultId?: string;

  @IsNotEmpty()
  @IsNumber()
  value: number;

  @IsOptional()
  @IsString()
  reasoning?: string;
}

export class ImportScoreResultsRequestDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ImportScoreResultRowDto)
  results: ImportScoreResultRowDto[];
}
