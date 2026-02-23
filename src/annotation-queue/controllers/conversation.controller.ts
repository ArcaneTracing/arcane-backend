import {
  Controller,
  Post,
  Delete,
  Param,
  Body,
  UseGuards,
  UseInterceptors,
  HttpCode,
  HttpStatus,
  UsePipes,
  ValidationPipe,
  ParseUUIDPipe,
} from "@nestjs/common";
import { Session, UserSession } from "@thallesp/nestjs-better-auth";
import { ConversationService } from "../services/conversation.service";
import { MessageResponseDto } from "../dto/response/message-response.dto";
import { OrgProjectPermissionGuard } from "../../rbac/guards/org-project-permission.guard";
import { Permission } from "../../rbac/decorators/permission.decorator";
import { ANNOTATION_QUEUE_PERMISSIONS } from "../../rbac/permissions/permissions";
import { QueueBelongsToProjectGuard } from "../guards/queue-belongs-to-project.guard";
import { DatasourceBelongsToOrganisationInterceptor } from "../interceptors/datasource-belongs-to-organisation.interceptor";
import { ConversationConfigExistsGuard } from "../guards/conversation-config-exists.guard";
import { ConversationsQueueGuard } from "../guards/conversations-queue.guard";
import { EnqueueConversationRequestDto } from "../dto/request/enqueue-conversation-request.dto";
import { QueuedConversationResponseDto } from "../dto/response/queued-conversation-response.dto";

@Controller(
  "v1/organisations/:organisationId/projects/:projectId/queues/:queueId/conversations",
)
@UseGuards(OrgProjectPermissionGuard, QueueBelongsToProjectGuard)
export class ConversationController {
  constructor(private readonly conversationService: ConversationService) {}

  @Post()
  @UseGuards(ConversationsQueueGuard, ConversationConfigExistsGuard)
  @UseInterceptors(DatasourceBelongsToOrganisationInterceptor)
  @Permission(ANNOTATION_QUEUE_PERMISSIONS.CONVERSATIONS_CREATE)
  @UsePipes(new ValidationPipe({ transform: true }))
  @HttpCode(HttpStatus.CREATED)
  async addConversationToQueue(
    @Param("queueId", ParseUUIDPipe) queueId: string,
    @Body() enqueueRequest: EnqueueConversationRequestDto,
    @Session() userSession: UserSession,
  ): Promise<QueuedConversationResponseDto> {
    return this.conversationService.addConversationToQueue(
      queueId,
      userSession.user.id,
      enqueueRequest,
    );
  }

  @Delete(":id")
  @Permission(ANNOTATION_QUEUE_PERMISSIONS.CONVERSATIONS_DELETE)
  @UsePipes(new ValidationPipe({ transform: true }))
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeConversationFromQueue(
    @Param("queueId", ParseUUIDPipe) queueId: string,
    @Param("id", ParseUUIDPipe) id: string,
  ): Promise<MessageResponseDto> {
    return this.conversationService.removeConversationFromQueue(id, queueId);
  }
}
