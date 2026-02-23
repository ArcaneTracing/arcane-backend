import { Injectable, NotFoundException } from "@nestjs/common";
import { AnnotationQueue } from "../entities/annotation-queue.entity";
import { QueuedTrace } from "../entities/queued-trace.entity";
import { QueuedConversation } from "../entities/queued-conversation.entity";
import { AnnotationQueueType } from "../entities/annotation-queue-type.enum";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { CreateAnnotationRequestDto } from "../dto/request/create-annotation-request.dto";

@Injectable()
export class AnnotationValidator {
  constructor(
    @InjectRepository(AnnotationQueue)
    private readonly annotationQueueRepository: Repository<AnnotationQueue>,
    @InjectRepository(QueuedTrace)
    private readonly queueTraceRepository: Repository<QueuedTrace>,
    @InjectRepository(QueuedConversation)
    private readonly conversationRepository: Repository<QueuedConversation>,
  ) {}
  async validateDto(
    dto: CreateAnnotationRequestDto,
    queueId: string,
    projectId: string,
  ) {
    const queue = await this.annotationQueueRepository.findOne({
      where: { id: queueId, projectId },
      select: ["type"],
    });
    if (queue.type === AnnotationQueueType.TRACES) {
      await this.validateQueueTraceExists(queueId, dto.traceId);
    }

    if (queue.type === AnnotationQueueType.CONVERSATIONS) {
      await this.validateConversationExists(queueId, dto.conversationId);
    }
  }

  async validateQueueTraceExists(queueId: string, queueTraceId?: string) {
    if (!queueTraceId) {
      throw new NotFoundException(
        `Queue trace ID missing in queue with type trace`,
      );
    }
    const queueTraceExists = await this.queueTraceRepository.exists({
      where: { id: queueTraceId, queueId: queueId },
    });
    if (!queueTraceExists) {
      throw new NotFoundException(
        `Queue trace with ID ${queueTraceId} not found in queue ${queueId}`,
      );
    }
  }

  async validateConversationExists(queueId: string, conversationId?: string) {
    if (!conversationId) {
      throw new NotFoundException(
        `Conversation ID missing in queue with type trace`,
      );
    }
    const conversationExists = await this.conversationRepository.exists({
      where: { id: conversationId, queueId: queueId },
    });
    if (!conversationExists) {
      throw new NotFoundException(
        `Queued conversation with ID ${conversationId} not found in queue ${queueId}`,
      );
    }
  }
}
