import { QueuedTrace } from "../entities/queued-trace.entity";
import { QueuedTraceResponseDto } from "../dto/response/queued-trace-response.dto";
import { BulkQueueTraceResponseDto } from "../dto/response/bulk-queue-trace-response.dto";
import { MessageResponseDto } from "../dto/response/message-response.dto";
import { EnqueueTraceRequestDto } from "../dto/request/enqueue-trace-request.dto";

export class QueuedTraceMapper {
  static toDto(queueTrace: QueuedTrace): QueuedTraceResponseDto {
    return {
      id: queueTrace.id,
      otelTraceId: queueTrace.otelTraceId,
      datasourceId: queueTrace.datasourceId,
      startDate: queueTrace.startDate,
      endDate: queueTrace.endDate,
    };
  }

  static toEntity(
    createDto: EnqueueTraceRequestDto,
    queueId: string,
    userId: string,
  ): Partial<QueuedTrace> {
    return {
      otelTraceId: createDto.otelTraceId,
      datasourceId: createDto.datasourceId,
      queueId,
      createdById: userId,
      createdAt: new Date(),
      startDate: createDto.startDate
        ? new Date(createDto.startDate)
        : undefined,
      endDate: createDto.endDate ? new Date(createDto.endDate) : undefined,
    };
  }

  static toEntityFromBulk(
    otelTraceId: string,
    datasourceId: string,
    queueId: string,
    userId: string,
    startDate?: string,
    endDate?: string,
  ): Partial<QueuedTrace> {
    return {
      otelTraceId,
      datasourceId,
      queueId,
      createdById: userId,
      createdAt: new Date(),
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
    };
  }

  static toBulkResponseDto(
    added: QueuedTrace[],
    skipped: string[],
    total: number,
  ): BulkQueueTraceResponseDto {
    return {
      added: added.map((qt) => this.toDto(qt)),
      skipped,
      total,
      addedCount: added.length,
      skippedCount: skipped.length,
    };
  }

  static toMessageResponse(message: string): MessageResponseDto {
    return { message };
  }
}
