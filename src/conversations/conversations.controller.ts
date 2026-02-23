import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  Body,
  UseGuards,
  UsePipes,
  ValidationPipe,
  ParseUUIDPipe,
} from "@nestjs/common";
import { ConversationsService } from "./conversations.service";
import { GetConversationsRequestDto } from "./dto/request/get-conversations-request.dto";
import { GetFullConversationRequestDto } from "./dto/request/get-full-conversation-request.dto";
import { GetConversationsByTracesRequestDto } from "./dto/request/get-conversations-by-traces-request.dto";
import {
  ConversationResponseDto,
  FullConversationResponseDto,
} from "./dto/response/conversation-response.dto";
import { OrgProjectPermissionGuard } from "../rbac/guards/org-project-permission.guard";
import { Permission } from "../rbac/decorators/permission.decorator";
import { CONVERSATION_PERMISSIONS } from "../rbac/permissions/permissions";
import { Session, UserSession } from "@thallesp/nestjs-better-auth";

@Controller(
  "v1/organisations/:organisationId/projects/:projectId/datasources/:datasourceId/conversations",
)
@UseGuards(OrgProjectPermissionGuard)
@Permission(CONVERSATION_PERMISSIONS.READ)
export class ConversationsController {
  constructor(private readonly conversationsService: ConversationsService) {}

  @Get("by-traces")
  @UsePipes(new ValidationPipe({ transform: true }))
  async getConversationsByTraceIds(
    @Param("organisationId", new ParseUUIDPipe()) organisationId: string,
    @Param("projectId", new ParseUUIDPipe()) projectId: string,
    @Param("datasourceId", new ParseUUIDPipe()) datasourceId: string,
    @Session() userSession: UserSession,
    @Query() query: GetConversationsByTracesRequestDto,
  ): Promise<FullConversationResponseDto> {
    return this.conversationsService.getConversationsByTraceIds(
      organisationId,
      projectId,
      datasourceId,
      userSession.user.id,
      query,
    );
  }

  @Get("/config/:conversationConfigId")
  @UsePipes(new ValidationPipe({ transform: true }))
  async getConversations(
    @Param("organisationId", new ParseUUIDPipe()) organisationId: string,
    @Param("projectId", new ParseUUIDPipe()) projectId: string,
    @Param("datasourceId", new ParseUUIDPipe()) datasourceId: string,
    @Param("conversationConfigId", new ParseUUIDPipe())
    conversationConfigId: string,
    @Session() userSession: UserSession,
    @Query() query: GetConversationsRequestDto,
  ): Promise<ConversationResponseDto> {
    return this.conversationsService.getConversations(
      organisationId,
      projectId,
      datasourceId,
      conversationConfigId,
      userSession.user.id,
      query,
    );
  }

  @Post("config/:conversationConfigId/full")
  @UsePipes(new ValidationPipe({ transform: true }))
  async getFullConversation(
    @Param("organisationId", new ParseUUIDPipe()) organisationId: string,
    @Param("projectId", new ParseUUIDPipe()) projectId: string,
    @Param("datasourceId", new ParseUUIDPipe()) datasourceId: string,
    @Param("conversationConfigId", new ParseUUIDPipe())
    conversationConfigId: string,
    @Session() userSession: UserSession,
    @Body() body: GetFullConversationRequestDto,
  ): Promise<FullConversationResponseDto> {
    return this.conversationsService.getFullConversation(
      organisationId,
      projectId,
      datasourceId,
      conversationConfigId,
      userSession.user.id,
      body,
    );
  }
}
