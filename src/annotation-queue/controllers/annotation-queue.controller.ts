import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
  UsePipes,
  ValidationPipe,
  ParseUUIDPipe,
  Query,
  BadRequestException,
} from "@nestjs/common";
import { AnnotationQueueService } from "../services/annotation-queue.service";
import { QueueTemplateService } from "../services/queue-template.service";
import {
  CreateAnnotationQueueRequestDto,
  UpdateAnnotationQueueRequestDto,
} from "../dto/request/create-annotation-queue-request.dto";
import { AnnotationQueueResponseDto } from "../dto/response/annotation-queue-response.dto";
import { AnnotationTemplateResponseDto } from "../dto/response/annotation-template-response.dto";
import { OrgProjectPermissionGuard } from "../../rbac/guards/org-project-permission.guard";
import { Permission } from "../../rbac/decorators/permission.decorator";
import { ANNOTATION_QUEUE_PERMISSIONS } from "../../rbac/permissions/permissions";
import { AnnotationQueueType } from "../entities/annotation-queue-type.enum";
import { AnnotationQueueListItemResponseDto } from "../dto/response/annotation-queue-list-item-response.dto";
import { QueueBelongsToProjectGuard } from "../guards/queue-belongs-to-project.guard";
import { Session, UserSession } from "@thallesp/nestjs-better-auth";

@Controller("v1/organisations/:organisationId/projects/:projectId/queues")
@UseGuards(OrgProjectPermissionGuard)
export class AnnotationQueueController {
  constructor(
    private readonly annotationQueueService: AnnotationQueueService,
    private readonly queueTemplateService: QueueTemplateService,
  ) {}

  @Get()
  @Permission(ANNOTATION_QUEUE_PERMISSIONS.READ)
  @UsePipes(new ValidationPipe({ transform: true }))
  async findAll(
    @Param("projectId", ParseUUIDPipe) projectId: string,
    @Query("type") type?: string,
  ): Promise<AnnotationQueueListItemResponseDto[]> {
    let validatedType: AnnotationQueueType | undefined;
    if (type) {
      if (
        !Object.values(AnnotationQueueType).includes(
          type as AnnotationQueueType,
        )
      ) {
        throw new BadRequestException(
          `Invalid type. Must be one of: ${Object.values(AnnotationQueueType).join(", ")}`,
        );
      }
      validatedType = type as AnnotationQueueType;
    }
    return this.annotationQueueService.findAll(projectId, validatedType);
  }

  @Post()
  @Permission(ANNOTATION_QUEUE_PERMISSIONS.CREATE)
  @UsePipes(new ValidationPipe({ transform: true }))
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Param("projectId", ParseUUIDPipe) projectId: string,
    @Body() createDto: CreateAnnotationQueueRequestDto,
    @Session() userSession: UserSession,
  ): Promise<AnnotationQueueResponseDto> {
    return this.annotationQueueService.create(
      projectId,
      createDto,
      userSession.user.id,
    );
  }

  @Get(":queueId/template")
  @UseGuards(QueueBelongsToProjectGuard)
  @Permission(ANNOTATION_QUEUE_PERMISSIONS.READ)
  @UsePipes(new ValidationPipe({ transform: true }))
  async getTemplate(
    @Param("projectId", ParseUUIDPipe) projectId: string,
    @Param("queueId", ParseUUIDPipe) queueId: string,
  ): Promise<AnnotationTemplateResponseDto> {
    return this.queueTemplateService.getTemplate(projectId, queueId);
  }

  @Get(":queueId")
  @UseGuards(QueueBelongsToProjectGuard)
  @Permission(ANNOTATION_QUEUE_PERMISSIONS.READ)
  @UsePipes(new ValidationPipe({ transform: true }))
  async findOne(
    @Param("projectId", ParseUUIDPipe) projectId: string,
    @Param("queueId", ParseUUIDPipe) queueId: string,
  ): Promise<AnnotationQueueResponseDto> {
    return this.annotationQueueService.findOne(projectId, queueId);
  }

  @Put(":queueId")
  @UseGuards(QueueBelongsToProjectGuard)
  @Permission(ANNOTATION_QUEUE_PERMISSIONS.UPDATE)
  @UsePipes(new ValidationPipe({ transform: true }))
  async update(
    @Param("projectId", ParseUUIDPipe) projectId: string,
    @Param("queueId", ParseUUIDPipe) queueId: string,
    @Body() updateDto: UpdateAnnotationQueueRequestDto,
  ): Promise<AnnotationQueueResponseDto> {
    return this.annotationQueueService.update(projectId, queueId, updateDto);
  }

  @Delete(":queueId")
  @UseGuards(QueueBelongsToProjectGuard)
  @Permission(ANNOTATION_QUEUE_PERMISSIONS.DELETE)
  @UsePipes(new ValidationPipe({ transform: true }))
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @Param("projectId", ParseUUIDPipe) projectId: string,
    @Param("queueId", ParseUUIDPipe) queueId: string,
  ): Promise<{ message: string }> {
    return this.annotationQueueService.remove(projectId, queueId);
  }
}
