import {
  Controller,
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
} from "@nestjs/common";
import { AnnotationService } from "../services/annotation.service";
import { OrgProjectPermissionGuard } from "../../rbac/guards/org-project-permission.guard";
import { Permission } from "../../rbac/decorators/permission.decorator";
import { ANNOTATION_PERMISSIONS } from "../../rbac/permissions/permissions";
import { Session, UserSession } from "@thallesp/nestjs-better-auth";
import { QueueBelongsToProjectGuard } from "../guards/queue-belongs-to-project.guard";
import { AnnotationBelongsToQueueGuard } from "../guards/annotation-belongs-to-queue.guard";
import { CreateAnnotationRequestDto } from "../dto/request/create-annotation-request.dto";
import { AnnotationResponseDto } from "../dto/response/annotation-response.dto";
import { UpdateAnnotationRequestDto } from "../dto/request/update-annotation-request.dto";
import { MessageResponseDto } from "../dto/response/message-response.dto";

@Controller(
  "v1/organisations/:organisationId/projects/:projectId/queues/:queueId/annotations",
)
@UseGuards(OrgProjectPermissionGuard, QueueBelongsToProjectGuard)
export class AnnotationController {
  constructor(private readonly annotationService: AnnotationService) {}

  @Post()
  @Permission(ANNOTATION_PERMISSIONS.CREATE)
  @UsePipes(new ValidationPipe({ transform: true }))
  @HttpCode(HttpStatus.CREATED)
  async createAnnotation(
    @Param("projectId", ParseUUIDPipe) projectId: string,
    @Param("queueId", ParseUUIDPipe) queueId: string,
    @Body() createDto: CreateAnnotationRequestDto,
    @Session() userSession: UserSession,
  ): Promise<AnnotationResponseDto> {
    return this.annotationService.createAnnotation(
      projectId,
      queueId,
      userSession.user.id,
      createDto,
    );
  }

  @Put(":annotationId")
  @UseGuards(AnnotationBelongsToQueueGuard)
  @Permission(ANNOTATION_PERMISSIONS.UPDATE)
  @UsePipes(new ValidationPipe({ transform: true }))
  async updateAnnotation(
    @Param("annotationId", ParseUUIDPipe) annotationId: string,
    @Body() updateDto: UpdateAnnotationRequestDto,
  ): Promise<AnnotationResponseDto> {
    return this.annotationService.updateAnnotationAnswer(
      annotationId,
      updateDto,
    );
  }

  @Delete(":annotationId")
  @UseGuards(AnnotationBelongsToQueueGuard)
  @Permission(ANNOTATION_PERMISSIONS.DELETE)
  @UsePipes(new ValidationPipe({ transform: true }))
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeAnnotation(
    @Param("annotationId", ParseUUIDPipe) annotationId: string,
  ): Promise<MessageResponseDto> {
    return this.annotationService.removeAnnotation(annotationId);
  }
}
