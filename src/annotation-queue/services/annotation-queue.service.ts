import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { AnnotationQueue } from "../entities/annotation-queue.entity";
import { AnnotationQueueResponseDto } from "../dto/response/annotation-queue-response.dto";
import { AnnotationQueueType } from "../entities/annotation-queue-type.enum";
import { AnnotationQueueMapper } from "../mappers/annotation-queue.mapper";
import { QueueTemplateService } from "./queue-template.service";
import { AnnotationQueueListItemResponseDto } from "../dto/response/annotation-queue-list-item-response.dto";
import { AnnotationQueueValidator } from "../validators/annotation-queue.validator";
import { AnnotationQueueUpdater } from "./annotation-queue-updater.service";
import {
  CreateAnnotationQueueRequestDto,
  UpdateAnnotationQueueRequestDto,
} from "../dto/request/create-annotation-queue-request.dto";
import { AuditService } from "../../audit/audit.service";
import { Project } from "../../projects/entities/project.entity";

@Injectable()
export class AnnotationQueueService {
  private readonly logger = new Logger(AnnotationQueueService.name);

  constructor(
    @InjectRepository(AnnotationQueue)
    private readonly annotationQueueRepository: Repository<AnnotationQueue>,
    @InjectRepository(Project)
    private readonly projectRepository: Repository<Project>,
    private readonly queueTemplateService: QueueTemplateService,
    private readonly annotationQueueValidator: AnnotationQueueValidator,
    private readonly annotationQueueUpdater: AnnotationQueueUpdater,
    private readonly auditService: AuditService,
  ) {}

  async findAll(
    projectId: string,
    type?: AnnotationQueueType,
  ): Promise<AnnotationQueueListItemResponseDto[]> {
    const logMessage = type
      ? `Finding annotation queues of type ${type} for project ${projectId}`
      : `Finding all annotation queues for project ${projectId}`;
    this.logger.debug(logMessage);

    const whereClause = type ? { projectId, type } : { projectId };
    const queues = await this.annotationQueueRepository.find({
      where: whereClause,
      relations: ["template", "template.questions"],
      order: { createdAt: "DESC" },
    });

    return queues.map((queue) => AnnotationQueueMapper.toResponseDto(queue));
  }

  async create(
    projectId: string,
    createDto: CreateAnnotationQueueRequestDto,
    userId: string,
  ): Promise<AnnotationQueueResponseDto> {
    const project = await this.projectRepository.findOne({
      where: { id: projectId },
      select: ["id", "organisationId"],
    });

    const template = await this.queueTemplateService.createTemplate(
      createDto.template.questions,
    );

    const savedQueue = await this.annotationQueueRepository.save({
      name: createDto.name,
      description: createDto.description,
      type: createDto.type || AnnotationQueueType.TRACES,
      projectId: projectId,
      template: template,
      templateId: template.id,
      createdById: userId,
    });
    this.logger.log(
      `Created annotation queue ${savedQueue.id} for project ${projectId}`,
    );

    await this.auditService.record({
      action: "annotation_queue.created",
      actorId: userId,
      actorType: "user",
      resourceType: "annotation_queue",
      resourceId: savedQueue.id,
      organisationId: project?.organisationId,
      projectId,
      afterState: {
        id: savedQueue.id,
        name: savedQueue.name,
        description: savedQueue.description,
        type: savedQueue.type,
        projectId: savedQueue.projectId,
        templateId: savedQueue.templateId,
      },
      metadata: {
        creatorId: userId,
        projectId,
      },
    });

    return AnnotationQueueMapper.toResponseDto(savedQueue);
  }

  async findOne(
    projectId: string,
    queueId: string,
  ): Promise<AnnotationQueueResponseDto> {
    this.logger.debug(
      `Finding annotation queue ${queueId} for project ${projectId}`,
    );

    const queueBasic: AnnotationQueue =
      await this.annotationQueueRepository.findOne({
        where: { id: queueId, projectId },
        select: ["id", "type"],
      });

    this.annotationQueueValidator.validateQueueExists(
      queueBasic,
      queueId,
      projectId,
    );

    const relations = ["template", "template.questions"];
    if (queueBasic.type === AnnotationQueueType.TRACES) {
      relations.push(
        "traces",
        "traces.annotations",
        "traces.annotations.answers",
        "traces.annotations.trace",
      );
    } else if (queueBasic.type === AnnotationQueueType.CONVERSATIONS) {
      relations.push(
        "conversations",
        "conversations.annotations",
        "conversations.annotations.answers",
        "conversations.annotations.conversation",
      );
    }

    const queue = await this.annotationQueueRepository.findOne({
      where: { id: queueId, projectId },
      relations,
    });

    if (!queue) {
      throw new NotFoundException(`Annotation queue ${queueId} not found`);
    }

    const traces = queue.traces || [];
    const conversations = queue.conversations || [];

    return AnnotationQueueMapper.toResponseDto(queue, traces, conversations);
  }

  async update(
    projectId: string,
    queueId: string,
    updateDto: UpdateAnnotationQueueRequestDto,
  ): Promise<AnnotationQueueResponseDto> {
    const project = await this.projectRepository.findOne({
      where: { id: projectId },
      select: ["id", "organisationId"],
    });

    const queue = await this.annotationQueueRepository.findOne({
      where: { id: queueId, projectId },
    });

    this.annotationQueueValidator.validateQueueExists(
      queue,
      queueId,
      projectId,
    );

    const beforeState = {
      id: queue.id,
      name: queue.name,
      description: queue.description,
      type: queue.type,
      projectId: queue.projectId,
      templateId: queue.templateId,
    };

    await this.annotationQueueUpdater.applyUpdates(queue, updateDto);

    const updatedQueue = await this.annotationQueueRepository.save(queue);
    this.logger.log(
      `Updated annotation queue ${queueId} in project ${projectId}`,
    );

    const relations = ["template", "template.questions"];
    if (updatedQueue.type === AnnotationQueueType.TRACES) {
      relations.push(
        "traces",
        "traces.annotations",
        "traces.annotations.answers",
        "traces.annotations.trace",
      );
    } else if (updatedQueue.type === AnnotationQueueType.CONVERSATIONS) {
      relations.push(
        "conversations",
        "conversations.annotations",
        "conversations.annotations.answers",
        "conversations.annotations.conversation",
      );
    }

    const queueWithRelations = await this.annotationQueueRepository.findOne({
      where: { id: updatedQueue.id },
      relations,
    });

    const changedFields: string[] = [];
    if (updateDto.name !== undefined && updateDto.name !== beforeState.name) {
      changedFields.push("name");
    }
    if (
      updateDto.description !== undefined &&
      updateDto.description !== beforeState.description
    ) {
      changedFields.push("description");
    }
    if (updateDto.template !== undefined) {
      changedFields.push("template");
    }

    await this.auditService.record({
      action: "annotation_queue.updated",
      actorType: "user",
      resourceType: "annotation_queue",
      resourceId: queueId,
      organisationId: project?.organisationId,
      projectId,
      beforeState,
      afterState: {
        id: updatedQueue.id,
        name: updatedQueue.name,
        description: updatedQueue.description,
        type: updatedQueue.type,
        projectId: updatedQueue.projectId,
        templateId: updatedQueue.templateId,
      },
      metadata: {
        changedFields,
        projectId,
      },
    });

    return AnnotationQueueMapper.toResponseDto(
      queueWithRelations,
      queueWithRelations.traces,
      queueWithRelations.conversations,
    );
  }

  async remove(
    projectId: string,
    queueId: string,
  ): Promise<{ message: string }> {
    const project = await this.projectRepository.findOne({
      where: { id: projectId },
      select: ["id", "organisationId"],
    });

    const queue = await this.annotationQueueRepository.findOne({
      where: { id: queueId, projectId },
    });

    this.annotationQueueValidator.validateQueueExists(
      queue,
      queueId,
      projectId,
    );

    const beforeState = {
      id: queue.id,
      name: queue.name,
      description: queue.description,
      type: queue.type,
      projectId: queue.projectId,
    };

    await this.annotationQueueRepository.remove(queue);
    this.logger.log(
      `Removed annotation queue ${queueId} from project ${projectId}`,
    );

    await this.auditService.record({
      action: "annotation_queue.deleted",
      actorType: "user",
      resourceType: "annotation_queue",
      resourceId: queueId,
      organisationId: project?.organisationId,
      projectId,
      beforeState,
      afterState: null,
      metadata: {
        projectId,
      },
    });

    return { message: "Annotation queue deleted successfully" };
  }
}
