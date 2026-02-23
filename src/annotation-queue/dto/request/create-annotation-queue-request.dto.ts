import {
  IsString,
  IsNotEmpty,
  IsOptional,
  ValidateNested,
  IsArray,
  IsEnum,
  IsNumber,
  IsBoolean,
  ArrayMinSize,
} from "class-validator";
import { Type } from "class-transformer";
import { PartialType } from "@nestjs/mapped-types";
import { AnnotationQuestionType } from "../../entities/annotation-question-type.enum";
import { AnnotationQueueType } from "../../entities/annotation-queue-type.enum";

export class TemplateReferenceDto {
  @IsString()
  @IsNotEmpty()
  id: string;
}

export class CreateAnnotationQuestionDto {
  @IsString()
  @IsNotEmpty()
  question: string;

  @IsString()
  @IsOptional()
  helperText?: string;

  @IsString()
  @IsOptional()
  placeholder?: string;

  @IsEnum(AnnotationQuestionType)
  type: AnnotationQuestionType;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  options?: string[];

  @IsNumber()
  @IsOptional()
  min?: number;

  @IsNumber()
  @IsOptional()
  max?: number;

  @IsBoolean()
  @IsOptional()
  required?: boolean;

  @IsOptional()
  default?: string | number | boolean;
}

export class CreateAnnotationTemplateDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateAnnotationQuestionDto)
  @ArrayMinSize(1)
  questions: CreateAnnotationQuestionDto[];
}

export class TemplateDto {
  @IsString()
  @IsOptional()
  id?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateAnnotationQuestionDto)
  @IsOptional()
  questions?: CreateAnnotationQuestionDto[];
}

export class CreateAnnotationQueueRequestDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsEnum(AnnotationQueueType)
  @IsOptional()
  type?: AnnotationQueueType;

  @ValidateNested()
  @Type(() => CreateAnnotationTemplateDto)
  template: CreateAnnotationTemplateDto;
}

export class UpdateAnnotationQueueRequestDto extends PartialType(
  CreateAnnotationQueueRequestDto,
) {}
