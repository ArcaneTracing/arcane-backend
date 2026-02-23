import { IsUUID, IsOptional, IsArray, ValidateNested } from "class-validator";
import { Type } from "class-transformer";
import { CreateAnnotationAnswerRequestDto } from "./create-annotation-answer-request.dto";

export class CreateAnnotationRequestDto {
  @IsUUID()
  @IsOptional()
  traceId?: string;

  @IsUUID()
  @IsOptional()
  conversationId?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateAnnotationAnswerRequestDto)
  answers: CreateAnnotationAnswerRequestDto[];
}
