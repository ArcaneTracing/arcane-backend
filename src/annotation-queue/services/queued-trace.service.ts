import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { QueuedTrace } from "../entities/queued-trace.entity";
import { QueuedTraceResponseDto } from "../dto/response/queued-trace-response.dto";
import { BulkQueueTraceResponseDto } from "../dto/response/bulk-queue-trace-response.dto";
import { MessageResponseDto } from "../dto/response/message-response.dto";
import { QueuedTraceMapper } from "../mappers/queued-trace.mapper";
import { EnqueueTraceRequestDto } from "../dto/request/enqueue-trace-request.dto";
import { EnqueueTraceBulkRequestDto } from "../dto/request/enqueue-trace-bulk-request.dto";

@Injectable()
export class QueuedTraceService {
  private readonly logger = new Logger(QueuedTraceService.name);

  constructor(
    @InjectRepository(QueuedTrace)
    private readonly queueTraceRepository: Repository<QueuedTrace>,
  ) {}

  async addTraceToQueue(
    queueId: string,
    userId: string,
    createDto: EnqueueTraceRequestDto,
  ): Promise<QueuedTraceResponseDto> {
    const alreadyQueued = await this.queueTraceRepository.existsBy({
      otelTraceId: createDto.otelTraceId,
      datasourceId: createDto.datasourceId,
      queueId: queueId,
    });

    if (alreadyQueued) {
      throw new BadRequestException("Trace already exists in this queue");
    }

    const queueTrace = this.queueTraceRepository.create(
      QueuedTraceMapper.toEntity(createDto, queueId, userId),
    );

    const savedQueueTrace = await this.queueTraceRepository.save(queueTrace);

    return QueuedTraceMapper.toDto(savedQueueTrace);
  }

  async removeTraceFromQueueByOtelTraceId(
    queueId: string,
    otelTraceId: string,
  ): Promise<MessageResponseDto> {
    const queueTrace = await this.queueTraceRepository.findOne({
      where: { otelTraceId: otelTraceId, queueId },
    });

    if (!queueTrace) {
      throw new NotFoundException(
        `Trace from otel with id ${otelTraceId} not found in queue ${queueId}`,
      );
    }

    await this.queueTraceRepository.remove(queueTrace);
    this.logger.log(
      `Removed trace from otel with id ${otelTraceId}  from queue ${queueId}`,
    );

    return QueuedTraceMapper.toMessageResponse(
      "Trace removed from queue successfully",
    );
  }

  async removeTraceFromQueue(
    queueId: string,
    id: string,
  ): Promise<MessageResponseDto> {
    const queueTrace = await this.queueTraceRepository.findOne({
      where: { id: id, queueId },
    });

    if (!queueTrace) {
      throw new NotFoundException(
        `Queue trace with ID ${id} not found in queue ${queueId}`,
      );
    }

    await this.queueTraceRepository.remove(queueTrace);
    this.logger.log(`Removed queue trace ${id} from queue ${queueId}`);

    return QueuedTraceMapper.toMessageResponse(
      "Trace removed from queue successfully",
    );
  }

  async addTracesToQueueBulk(
    queueId: string,
    userId: string,
    createDto: EnqueueTraceBulkRequestDto,
  ): Promise<BulkQueueTraceResponseDto> {
    const existingQueueTraces = await this.queueTraceRepository.find({
      where: {
        queueId: queueId,
        datasourceId: createDto.datasourceId,
      },
    });

    const existingTraceIds = new Set(
      existingQueueTraces.map((qt) => qt.otelTraceId),
    );

    const newTraceIds = createDto.otelTraceIds.filter(
      (traceId) => !existingTraceIds.has(traceId),
    );
    const skippedTraceIds = createDto.otelTraceIds.filter((traceId) =>
      existingTraceIds.has(traceId),
    );

    const queueTracesToCreate = newTraceIds.map((traceId) =>
      this.queueTraceRepository.create(
        QueuedTraceMapper.toEntityFromBulk(
          traceId,
          createDto.datasourceId,
          queueId,
          userId,
          createDto.startDate,
          createDto.endDate,
        ),
      ),
    );

    const savedQueueTraces =
      await this.queueTraceRepository.save(queueTracesToCreate);

    return QueuedTraceMapper.toBulkResponseDto(
      savedQueueTraces,
      skippedTraceIds,
      createDto.otelTraceIds.length,
    );
  }
}
