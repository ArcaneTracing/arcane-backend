import { AnnotationQuestionType } from "../../entities/annotation-question-type.enum";

export class AnnotationQuestionResponseDto {
  id: string;
  question: string;
  helperText?: string;
  placeholder?: string;
  type: AnnotationQuestionType;
  options?: string[];
  min?: number;
  max?: number;
  required?: boolean;
  default?: string | number | boolean;
}
