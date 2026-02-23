import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Annotation } from "../entities/annotation.entity";
import { AnnotationAnswer } from "../entities/annotation-answer.entity";
import { AnnotationAnswerMapper, AnnotationMapper } from "../mappers";
import { AnnotationResponseDto } from "../dto/response/annotation-response.dto";
import { UpdateAnnotationRequestDto } from "../dto/request/update-annotation-request.dto";
import { AnnotationManagementService } from "./annotation-management.service";
import { AuditService } from "../../audit/audit.service";
import { AnnotationQueue } from "../entities/annotation-queue.entity";
import { Project } from "../../projects/entities/project.entity";

@Injectable()
export class AnnotationUpdateService {
  private readonly logger = new Logger(AnnotationUpdateService.name);

  constructor(
    @InjectRepository(Annotation)
    private readonly annotationRepository: Repository<Annotation>,
    @InjectRepository(AnnotationQueue)
    private readonly annotationQueueRepository: Repository<AnnotationQueue>,
    @InjectRepository(Project)
    private readonly projectRepository: Repository<Project>,
    private readonly annotationManagementService: AnnotationManagementService,
    private readonly auditService: AuditService,
  ) {}

  async updateAnnotationAnswer(
    annotationId: string,
    updateDto: UpdateAnnotationRequestDto,
  ): Promise<AnnotationResponseDto> {
    const annotation = await this.annotationRepository.findOne({
      where: { id: annotationId },
      relations: ["answers", "trace", "conversation"],
    });

    if (!annotation) {
      throw new NotFoundException(`Annotation ${annotationId} not found`);
    }

    const queueId =
      annotation.trace?.queueId || annotation.conversation?.queueId;
    if (!queueId) {
      throw new NotFoundException(
        `Queue not found for annotation ${annotationId}`,
      );
    }

    const queue = await this.annotationQueueRepository.findOne({
      where: { id: queueId },
      select: ["id", "projectId"],
    });

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

    await this.annotationRepository.manager
      .createQueryBuilder()
      .delete()
      .from(AnnotationAnswer)
      .where("annotationId = :annotationId", { annotationId })
      .execute();

    annotation.answers = updateDto.answers.map((answerDto) =>
      AnnotationAnswerMapper.toEntity(answerDto, annotation, annotation.id),
    );

    const updatedAnnotation = await this.annotationRepository.save(annotation);
    this.logger.log(
      `Updated annotation ${annotationId} with ${updateDto.answers.length} answers`,
    );

    await this.auditService.record({
      action: "annotation.updated",
      actorType: "user",
      resourceType: "annotation",
      resourceId: annotationId,
      organisationId: project?.organisationId,
      projectId: queue?.projectId,
      beforeState,
      afterState: {
        id: updatedAnnotation.id,
        traceId: updatedAnnotation.traceId,
        conversationId: updatedAnnotation.conversationId,
        answersCount: updateDto.answers.length,
      },
      metadata: {
        queueId,
        projectId: queue?.projectId,
        previousAnswersCount: beforeState.answersCount,
        newAnswersCount: updateDto.answers.length,
      },
    });

    return AnnotationMapper.toDto(updatedAnnotation);
  }
}
