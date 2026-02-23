import { AnnotationAnswerResponseDto } from "./annotation-answer-response.dto";

export class AnnotationResponseDto {
  id: string;

  otelTraceId?: string;
  datasourceId?: string;
  traceId?: string;

  conversationId?: string;
  otelConversationId?: string;
  conversationConfigId?: string;
  conversationDatasourceId?: string;
  startDate?: Date;
  endDate?: Date;
  answers: AnnotationAnswerResponseDto[];
}
