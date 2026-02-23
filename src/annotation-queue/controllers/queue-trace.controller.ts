import {
  Controller,
  Post,
  Delete,
  Body,
  Param,
  UseGuards,
  UseInterceptors,
  HttpCode,
  HttpStatus,
  UsePipes,
  ValidationPipe,
  ParseUUIDPipe,
} from "@nestjs/common";
import { QueuedTraceService } from "../services/queued-trace.service";
import { QueuedTraceResponseDto } from "../dto/response/queued-trace-response.dto";
import { BulkQueueTraceResponseDto } from "../dto/response/bulk-queue-trace-response.dto";
import { MessageResponseDto } from "../dto/response/message-response.dto";
import { OrgProjectPermissionGuard } from "../../rbac/guards/org-project-permission.guard";
import { Permission } from "../../rbac/decorators/permission.decorator";
import { ANNOTATION_QUEUE_PERMISSIONS } from "../../rbac/permissions/permissions";
import { QueueBelongsToProjectGuard } from "../guards/queue-belongs-to-project.guard";
import { DatasourceBelongsToOrganisationInterceptor } from "../interceptors/datasource-belongs-to-organisation.interceptor";
import { Session, UserSession } from "@thallesp/nestjs-better-auth";
import { TracesQueueGuard } from "../guards/traces-queue.guard";
import { EnqueueTraceRequestDto } from "../dto/request/enqueue-trace-request.dto";
import { EnqueueTraceBulkRequestDto } from "../dto/request/enqueue-trace-bulk-request.dto";

@Controller(
  "v1/organisations/:organisationId/projects/:projectId/queues/:queueId/traces",
)
@UseGuards(
  OrgProjectPermissionGuard,
  QueueBelongsToProjectGuard,
  TracesQueueGuard,
)
export class QueueTraceController {
  constructor(private readonly queueTraceService: QueuedTraceService) {}

  @Post()
  @UseInterceptors(DatasourceBelongsToOrganisationInterceptor)
  @Permission(ANNOTATION_QUEUE_PERMISSIONS.TRACES_CREATE)
  @UsePipes(new ValidationPipe({ transform: true }))
  @HttpCode(HttpStatus.CREATED)
  async addTraceToQueue(
    @Param("queueId", ParseUUIDPipe) queueId: string,
    @Body() createDto: EnqueueTraceRequestDto,
    @Session() userSession: UserSession,
  ): Promise<QueuedTraceResponseDto> {
    return this.queueTraceService.addTraceToQueue(
      queueId,
      userSession.user.id,
      createDto,
    );
  }

  @Post("bulk")
  @UseInterceptors(DatasourceBelongsToOrganisationInterceptor)
  @Permission(ANNOTATION_QUEUE_PERMISSIONS.TRACES_CREATE)
  @UsePipes(new ValidationPipe({ transform: true }))
  @HttpCode(HttpStatus.CREATED)
  async addTracesToQueueBulk(
    @Param("queueId", ParseUUIDPipe) queueId: string,
    @Body() createDto: EnqueueTraceBulkRequestDto,
    @Session() userSession: UserSession,
  ): Promise<BulkQueueTraceResponseDto> {
    return this.queueTraceService.addTracesToQueueBulk(
      queueId,
      userSession.user.id,
      createDto,
    );
  }

  @Delete("by-id/:id")
  @Permission(ANNOTATION_QUEUE_PERMISSIONS.TRACES_DELETE)
  @UsePipes(new ValidationPipe({ transform: true }))
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeTraceFromQueueById(
    @Param("queueId", ParseUUIDPipe) queueId: string,
    @Param("id", ParseUUIDPipe) id: string,
  ): Promise<MessageResponseDto> {
    return this.queueTraceService.removeTraceFromQueue(queueId, id);
  }

  @Delete(":otelTraceId")
  @Permission(ANNOTATION_QUEUE_PERMISSIONS.TRACES_DELETE)
  @UsePipes(new ValidationPipe({ transform: true }))
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeTraceFromQueue(
    @Param("queueId", ParseUUIDPipe) queueId: string,
    @Param("otelTraceId") otelTraceId: string,
  ): Promise<MessageResponseDto> {
    return this.queueTraceService.removeTraceFromQueueByOtelTraceId(
      queueId,
      otelTraceId,
    );
  }
}
