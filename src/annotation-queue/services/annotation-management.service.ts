import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import {
  ERROR_MESSAGES,
  formatError,
} from "../../common/constants/error-messages.constants";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Annotation } from "../entities/annotation.entity";
import { AnnotationMapper } from "../mappers";
import { MessageResponseDto } from "../dto/response/message-response.dto";
import { AuditService } from "../../audit/audit.service";
import { AnnotationQueue } from "../entities/annotation-queue.entity";
import { Project } from "../../projects/entities/project.entity";

@Injectable()
export class AnnotationManagementService {
  private readonly logger = new Logger(AnnotationManagementService.name);

  constructor(
    @InjectRepository(Annotation)
    private readonly annotationRepository: Repository<Annotation>,
    @InjectRepository(AnnotationQueue)
    private readonly annotationQueueRepository: Repository<AnnotationQueue>,
    @InjectRepository(Project)
    private readonly projectRepository: Repository<Project>,
    private readonly auditService: AuditService,
  ) {}

  async findById(annotationId: string): Promise<Annotation> {
    const annotation = await this.annotationRepository.findOne({
      where: { id: annotationId },
      relations: ["answers"],
    });

    if (!annotation) {
      throw new NotFoundException(
        formatError(ERROR_MESSAGES.ANNOTATION_NOT_FOUND),
      );
    }

    return annotation;
  }

  async removeAnnotation(annotationId: string): Promise<MessageResponseDto> {
    const annotation = await this.annotationRepository.findOne({
      where: { id: annotationId },
      relations: ["trace", "conversation", "answers"],
    });

    if (!annotation) {
      throw new NotFoundException(
        formatError(ERROR_MESSAGES.ANNOTATION_NOT_FOUND),
      );
    }

    const queueId =
      annotation.trace?.queueId || annotation.conversation?.queueId;

    const queue = queueId
      ? await this.annotationQueueRepository.findOne({
          where: { id: queueId },
          select: ["id", "projectId"],
        })
      : null;

    const project = queue
      ? await this.projectRepository.findOne({
          where: { id: queue.projectId },
          select: ["id", "organisationId"],
        })
      : null;

    const beforeState = {
      id: annotation.id,
      traceId: annotation.traceId,
      conversationId: annotation.conversationId,
      answersCount: annotation.answers?.length || 0,
    };

    await this.annotationRepository.remove(annotation);
    this.logger.log(`Removed annotation ${annotationId}`);

    await this.auditService.record({
      action: "annotation.deleted",
      actorType: "user",
      resourceType: "annotation",
      resourceId: annotationId,
      organisationId: project?.organisationId,
      projectId: queue?.projectId,
      beforeState,
      afterState: null,
      metadata: {
        queueId: queueId || null,
        projectId: queue?.projectId || null,
      },
    });

    return AnnotationMapper.toMessageResponse(
      "Annotation deleted successfully",
    );
  }
}
