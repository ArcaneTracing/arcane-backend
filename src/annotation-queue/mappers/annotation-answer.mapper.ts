import { AnnotationAnswerResponseDto } from "../dto/response/annotation-answer-response.dto";
import { AnnotationAnswer } from "../entities/annotation-answer.entity";
import { Annotation } from "../entities/annotation.entity";

export class AnnotationAnswerMapper {
  static toDto(answer: AnnotationAnswer): AnnotationAnswerResponseDto {
    return {
      id: answer.id,
      questionId: answer.questionId,
      value: answer.value,
      numberValue: answer.numberValue,
      booleanValue: answer.booleanValue,
      stringArrayValue: answer.stringArrayValue,
    };
  }

  static toEntity(
    answerDto: any,
    annotation?: Annotation,
    annotationId?: string,
  ): AnnotationAnswer {
    const answer = new AnnotationAnswer();
    answer.questionId = answerDto.questionId;
    answer.value = answerDto.value;
    answer.numberValue = answerDto.numberValue;
    answer.booleanValue = answerDto.booleanValue;
    answer.stringArrayValue = answerDto.stringArrayValue;
    if (annotation) {
      answer.annotation = annotation;
    }
    if (annotationId) {
      answer.annotationId = annotationId;
    }
    return answer;
  }
}
