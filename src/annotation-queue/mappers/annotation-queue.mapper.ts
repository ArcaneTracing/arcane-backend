import { AnnotationQueue } from "../entities/annotation-queue.entity";
import { QueuedTrace } from "../entities/queued-trace.entity";
import { QueuedConversation } from "../entities/queued-conversation.entity";
import { Annotation } from "../entities/annotation.entity";
import { AnnotationQueueResponseDto } from "../dto/response/annotation-queue-response.dto";
import { AnnotationQueueType } from "../entities/annotation-queue-type.enum";
import { AnnotationMapper } from "./annotation.mapper";
import { ConversationMapper } from "./conversation.mapper";
import { QueuedTraceResponseDto } from "../dto/response/queued-trace-response.dto";
import { QueuedConversationResponseDto } from "../dto/response/queued-conversation-response.dto";

export class AnnotationQueueMapper {
  static toResponseDto(
    queue: AnnotationQueue,
    traces: QueuedTrace[] = [],
    conversations: QueuedConversation[] = [],
  ): AnnotationQueueResponseDto {
    const annotations: Annotation[] = [];
    const annotatedQueueTraceIds = new Set<string>();
    const annotatedConversationIds = new Set<string>();

    let tracesToBeAnnotated: QueuedTraceResponseDto[] = [];
    if (queue.type === AnnotationQueueType.TRACES) {
      traces.forEach((queueTrace) => {
        if (queueTrace.annotations && queueTrace.annotations.length > 0) {
          annotations.push(...queueTrace.annotations);
          annotatedQueueTraceIds.add(queueTrace.id);
        }
      });

      tracesToBeAnnotated = traces
        .filter((qt) => !annotatedQueueTraceIds.has(qt.id))
        .map((qt) => ({
          otelTraceId: qt.otelTraceId,
          id: qt.id,
          datasourceId: qt.datasourceId,
          startDate: qt.startDate,
          endDate: qt.endDate,
        }));
    }

    let conversationsToBeAnnotated: Array<QueuedConversationResponseDto> = [];
    if (queue.type === AnnotationQueueType.CONVERSATIONS) {
      conversations.forEach((conversation) => {
        if (conversation.annotations && conversation.annotations.length > 0) {
          annotations.push(...conversation.annotations);
          annotatedConversationIds.add(conversation.id);
        }
      });

      conversationsToBeAnnotated = conversations
        .filter((conv) => !annotatedConversationIds.has(conv.id))
        .map((conv) => ConversationMapper.toDto(conv));
    }

    return {
      id: queue.id,
      name: queue.name,
      description: queue.description,
      type: queue.type,
      templateId: queue.templateId,
      annotations: annotations.map((annotation) =>
        AnnotationMapper.toDto(annotation),
      ),
      tracesToBeAnnotated,
      conversationsToBeAnnotated,
    };
  }
}
