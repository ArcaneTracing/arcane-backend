import { Type } from "class-transformer";
import { IsArray, ValidateNested } from "class-validator";
import { CreateAnnotationAnswerRequestDto } from "./create-annotation-answer-request.dto";

export class UpdateAnnotationRequestDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateAnnotationAnswerRequestDto)
  answers: CreateAnnotationAnswerRequestDto[];
}
