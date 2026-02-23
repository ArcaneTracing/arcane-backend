import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  ValidateIf,
  ValidateNested,
} from "class-validator";
import { Type } from "class-transformer";
import {
  OrdinalConfig,
  ScaleOption,
  ScoringType,
} from "../../entities/score.entity";

export class ScaleOptionRequestDto implements ScaleOption {
  @IsString()
  @IsNotEmpty()
  label: string;

  @IsNumber()
  value: number;
}

export class OrdinalConfigRequestDto implements OrdinalConfig {
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  acceptable_set?: string[];

  @IsOptional()
  @IsNumber()
  threshold_rank?: number;
}

export class CreateScoreRequestDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsEnum(ScoringType)
  scoringType: ScoringType;

  @ValidateIf(
    (dto: CreateScoreRequestDto) =>
      dto.scoringType === ScoringType.NOMINAL ||
      dto.scoringType === ScoringType.ORDINAL,
  )
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ScaleOptionRequestDto)
  scale?: ScaleOptionRequestDto[];

  @ValidateIf(
    (dto: CreateScoreRequestDto) => dto.scoringType === ScoringType.ORDINAL,
  )
  @IsOptional()
  @ValidateNested()
  @Type(() => OrdinalConfigRequestDto)
  @IsObject()
  ordinalConfig?: OrdinalConfigRequestDto;

  @IsOptional()
  @IsUUID("4")
  evaluatorPromptId?: string;
}
