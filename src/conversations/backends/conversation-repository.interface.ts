import { Datasource } from "src/datasources/entities/datasource.entity";
import { ConversationListItemResponseDto } from "../dto/response/conversation-list-item-response.dto";
import { FullConversationResponseDto } from "../dto/response/conversation-response.dto";

export interface ProjectTraceFilter {
  attributeName: string;
  attributeValue: string;
}

export interface GetConversationsParams {
  start?: string;
  end?: string;
  projectTraceFilter?: ProjectTraceFilter;
}

export interface GetFullConversationParams {
  start?: string;
  end?: string;
  value: string;
  projectTraceFilter?: ProjectTraceFilter;
}

export interface GetConversationsByTraceIdsParams {
  traceIds: string[];
  startDate?: string;
  endDate?: string;
  projectTraceFilter?: ProjectTraceFilter;
}

export interface ConversationRepository {
  getConversations(
    datasource: Datasource,
    attributes: string[],
    params: GetConversationsParams,
  ): Promise<ConversationListItemResponseDto[]>;

  getFullConversation(
    datasource: Datasource,
    attributes: string[],
    params: GetFullConversationParams,
  ): Promise<FullConversationResponseDto>;

  getConversationsByTraceIds(
    datasource: Datasource,
    params: GetConversationsByTraceIdsParams,
  ): Promise<FullConversationResponseDto>;
}
