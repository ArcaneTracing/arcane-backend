import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsArray,
  IsNumber,
  IsBoolean,
  IsUUID,
} from "class-validator";

export class CreateAnnotationAnswerRequestDto {
  @IsUUID()
  @IsNotEmpty()
  questionId: string;

  @IsString()
  @IsOptional()
  value?: string;

  @IsNumber()
  @IsOptional()
  numberValue?: number;

  @IsBoolean()
  @IsOptional()
  booleanValue?: boolean;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  stringArrayValue?: string[];
}
