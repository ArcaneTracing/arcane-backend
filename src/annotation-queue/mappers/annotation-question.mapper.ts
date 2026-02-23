import { CreateAnnotationQuestionDto } from "../dto/request/create-annotation-queue-request.dto";
import { AnnotationQuestionResponseDto } from "../dto/response/annotation-question-response.dto";
import { AnnotationQuestion } from "../entities/annotation-question.entity";
export class AnnotationQuestionMapper {
  static toResponseDto(
    question: AnnotationQuestion,
  ): AnnotationQuestionResponseDto {
    return {
      id: question.id,
      question: question.question,
      helperText: question.helperText,
      placeholder: question.placeholder,
      type: question.type,
      options: question.options,
      min: question.min,
      max: question.max,
      required: question.required,
      default: question.default,
    };
  }

  static toEntity(
    questionDto: CreateAnnotationQuestionDto,
  ): AnnotationQuestion {
    const question = new AnnotationQuestion();
    question.question = questionDto.question;
    question.helperText = questionDto.helperText;
    question.placeholder = questionDto.placeholder;
    question.type = questionDto.type;
    question.options = questionDto.options;
    question.min = questionDto.min;
    question.max = questionDto.max;
    question.required = questionDto.required ?? false;
    question.default = questionDto.default;
    return question;
  }
}
