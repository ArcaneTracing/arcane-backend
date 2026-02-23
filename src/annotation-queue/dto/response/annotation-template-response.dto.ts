import { AnnotationQuestionResponseDto } from "./annotation-question-response.dto";

export class AnnotationTemplateResponseDto {
  id: string;
  questions: AnnotationQuestionResponseDto[];
}
