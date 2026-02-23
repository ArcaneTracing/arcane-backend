import { Annotation } from "../entities/annotation.entity";
import { QueuedTrace } from "../entities/queued-trace.entity";
import { QueuedConversation } from "../entities/queued-conversation.entity";
import { AnnotationAnswerMapper } from "./annotation-answer.mapper";
import { MessageResponseDto } from "../dto/response/message-response.dto";
import { AnnotationResponseDto } from "../dto/response/annotation-response.dto";
import { CreateAnnotationRequestDto } from "../dto/request/create-annotation-request.dto";

export class AnnotationMapper {
  static toDto(annotation: Annotation): AnnotationResponseDto {
    const dto: AnnotationResponseDto = {
      id: annotation.id,
      answers:
        annotation.answers?.map((answer) =>
          AnnotationAnswerMapper.toDto(answer),
        ) || [],
      startDate: annotation.startDate,
      endDate: annotation.endDate,
    };

    if (annotation.trace) {
      dto.otelTraceId = annotation.trace.otelTraceId;
      dto.datasourceId = annotation.trace.datasourceId;
      dto.traceId = annotation.traceId || undefined;
    }

    if (annotation.conversation) {
      dto.conversationId = annotation.conversationId || undefined;
      dto.otelConversationId = annotation.conversation.otelConversationId;
      dto.conversationConfigId = annotation.conversation.conversationConfigId;
      dto.conversationDatasourceId = annotation.conversation.datasourceId;
    }

    return dto;
  }

  static toEntityFromQueueTrace(
    queueTrace: QueuedTrace,
    createDto: CreateAnnotationRequestDto,
    userId: string,
  ) {
    return {
      startDate: queueTrace.startDate,
      endDate: queueTrace.endDate,
      createdById: userId,
      answers: createDto.answers.map((answerDto) =>
        AnnotationAnswerMapper.toEntity(answerDto),
      ),
      traceId: queueTrace.id,
    };
  }

  static toEntityFromConversation(
    conversation: QueuedConversation,
    createDto: CreateAnnotationRequestDto,
    userId: string,
  ) {
    return {
      startDate: conversation.startDate,
      endDate: conversation.endDate,
      createdById: userId,
      answers: createDto.answers.map((answerDto) =>
        AnnotationAnswerMapper.toEntity(answerDto),
      ),
      conversationId: conversation.id,
    };
  }

  static toMessageResponse(message: string): MessageResponseDto {
    return { message };
  }
}
