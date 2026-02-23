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
  EvaluationScope,
  EvaluationType,
} from "../../entities/evaluation.entity";

export class CreateEvaluationRequestDto {
  @IsEnum(EvaluationType)
  evaluationType: EvaluationType;

  @IsEnum(EvaluationScope)
  evaluationScope: EvaluationScope;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsArray()
  @ArrayMinSize(1)
  @IsUUID("4", { each: true })
  scoreIds: string[];

  @ValidateIf(
    (dto: CreateEvaluationRequestDto) =>
      dto.evaluationScope === EvaluationScope.DATASET,
  )
  @IsUUID("4")
  datasetId?: string;

  @ValidateIf(
    (dto: CreateEvaluationRequestDto) =>
      dto.evaluationScope === EvaluationScope.EXPERIMENT,
  )
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID("4", { each: true })
  experimentIds?: string[];

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  scoreMappings?: Record<string, Record<string, unknown>>;

  @IsOptional()
  @IsUUID("4")
  ragasModelConfigurationId?: string;
}

export class ScoreResultInputRequestDto {
  @IsUUID("4")
  scoreId: string;

  @IsNotEmpty()
  @IsNumber()
  value: number;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  reasoning?: string;
}

export class CreateEvaluationResultRequestDto {
  @ValidateIf(
    (dto: CreateEvaluationResultRequestDto) => !dto.experimentResultId,
  )
  @IsUUID("4")
  datasetRowId?: string;

  @ValidateIf((dto: CreateEvaluationResultRequestDto) => !dto.datasetRowId)
  @IsUUID("4")
  experimentResultId?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ScoreResultInputRequestDto)
  scoreResults: ScoreResultInputRequestDto[];
}
