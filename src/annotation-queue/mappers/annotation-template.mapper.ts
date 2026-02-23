import { AnnotationTemplate } from "../entities/annotation-template.entity";
import { AnnotationTemplateResponseDto } from "../dto/response/annotation-template-response.dto";
import { AnnotationQuestionMapper } from "./annotation-question.mapper";

export class AnnotationTemplateMapper {
  static toResponseDto(
    template: AnnotationTemplate,
  ): AnnotationTemplateResponseDto {
    return {
      id: template.id,
      questions:
        template.questions?.map((question) =>
          AnnotationQuestionMapper.toResponseDto(question),
        ) || [],
    };
  }
}
