import { QueuedConversation } from "../entities/queued-conversation.entity";
import { QueuedConversationResponseDto } from "../dto/response/queued-conversation-response.dto";
import { MessageResponseDto } from "../dto/response/message-response.dto";
import { EnqueueConversationRequestDto } from "../dto/request/enqueue-conversation-request.dto";

export class ConversationMapper {
  static toDto(
    conversation: QueuedConversation,
  ): QueuedConversationResponseDto {
    return {
      id: conversation.id,
      otelConversationId: conversation.otelConversationId,
      conversationConfigId: conversation.conversationConfigId,
      datasourceId: conversation.datasourceId,
      traceIds: conversation.otelTraceIds,
      startDate: conversation.startDate,
      endDate: conversation.endDate,
    };
  }

  static toEntity(
    createDto: EnqueueConversationRequestDto,
    queueId: string,
    userId: string,
  ): Partial<QueuedConversation> {
    return {
      conversationConfigId: createDto.conversationConfigId,
      datasourceId: createDto.datasourceId,
      otelConversationId: createDto.otelConversationId,
      otelTraceIds: createDto.otelTraceIds,
      queueId,
      createdById: userId,
      startDate: createDto.startDate
        ? new Date(createDto.startDate)
        : undefined,
      endDate: createDto.endDate ? new Date(createDto.endDate) : undefined,
    };
  }

  static toMessageResponse(message: string): MessageResponseDto {
    return { message };
  }
}
