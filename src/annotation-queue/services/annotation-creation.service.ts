import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import {
  ERROR_MESSAGES,
  formatError,
} from "../../common/constants/error-messages.constants";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Annotation } from "../entities/annotation.entity";
import { QueuedTrace } from "../entities/queued-trace.entity";
import { QueuedConversation } from "../entities/queued-conversation.entity";
import { AnnotationValidator } from "../validators/annotation.validator";
import { AnnotationMapper } from "../mappers";
import { AnnotationResponseDto } from "../dto/response/annotation-response.dto";
import { CreateAnnotationRequestDto } from "../dto/request/create-annotation-request.dto";
import { AuditService } from "../../audit/audit.service";
import { AnnotationQueue } from "../entities/annotation-queue.entity";
import { Project } from "../../projects/entities/project.entity";

@Injectable()
export class AnnotationCreationService {
  private readonly logger = new Logger(AnnotationCreationService.name);

  constructor(
    @InjectRepository(Annotation)
    private readonly annotationRepository: Repository<Annotation>,
    @InjectRepository(QueuedTrace)
    private readonly queueTraceRepository: Repository<QueuedTrace>,
    @InjectRepository(QueuedConversation)
    private readonly conversationRepository: Repository<QueuedConversation>,
    @InjectRepository(AnnotationQueue)
    private readonly annotationQueueRepository: Repository<AnnotationQueue>,
    @InjectRepository(Project)
    private readonly projectRepository: Repository<Project>,
    private readonly annotationValidator: AnnotationValidator,
    private readonly auditService: AuditService,
  ) {}

  private async createTraceAnnotation(
    queueId: string,
    userId: string,
    createDto: CreateAnnotationRequestDto,
  ): Promise<Annotation> {
    const queueTrace = await this.queueTraceRepository.findOne({
      where: { id: createDto.traceId, queueId },
    });

    if (!queueTrace) {
      throw new NotFoundException(
        formatError(
          ERROR_MESSAGES.QUEUE_TRACE_NOT_FOUND_IN_QUEUE,
          createDto.traceId,
          queueId,
        ),
      );
    }

    return this.annotationRepository.save(
      AnnotationMapper.toEntityFromQueueTrace(queueTrace, createDto, userId),
    );
  }

  private async createConversationAnnotation(
    queueId: string,
    userId: string,
    createDto: CreateAnnotationRequestDto,
  ): Promise<Annotation> {
    const conversation = await this.conversationRepository.findOne({
      where: { id: createDto.conversationId, queueId },
    });

    if (!conversation) {
      throw new NotFoundException(
        formatError(
          ERROR_MESSAGES.QUEUED_CONVERSATION_NOT_FOUND_IN_QUEUE,
          createDto.conversationId,
          queueId,
        ),
      );
    }

    return this.annotationRepository.save(
      AnnotationMapper.toEntityFromConversation(
        conversation,
        createDto,
        userId,
      ),
    );
  }

  async createAnnotation(
    projectId: string,
    queueId: string,
    userId: string,
    createDto: CreateAnnotationRequestDto,
  ): Promise<AnnotationResponseDto> {
    await this.annotationValidator.validateDto(createDto, queueId, projectId);

    const project = await this.projectRepository.findOne({
      where: { id: projectId },
      select: ["id", "organisationId"],
    });

    const annotation = createDto.traceId
      ? await this.createTraceAnnotation(queueId, userId, createDto)
      : await this.createConversationAnnotation(queueId, userId, createDto);

    this.logger.log(`Created annotation ${annotation.id} for queue ${queueId}`);

    await this.auditService.record({
      action: "annotation.created",
      actorId: userId,
      actorType: "user",
      resourceType: "annotation",
      resourceId: annotation.id,
      organisationId: project?.organisationId,
      projectId,
      afterState: {
        id: annotation.id,
        traceId: annotation.traceId,
        conversationId: annotation.conversationId,
        startDate: annotation.startDate,
        endDate: annotation.endDate,
        createdById: annotation.createdById,
      },
      metadata: {
        queueId,
        projectId,
        traceId: createDto.traceId,
        conversationId: createDto.conversationId,
        answersCount: createDto.answers?.length || 0,
      },
    });

    return AnnotationMapper.toDto(annotation);
  }
}
