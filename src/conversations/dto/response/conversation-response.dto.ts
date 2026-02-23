import { ConversationListItemResponseDto } from "./conversation-list-item-response.dto";
import type { TempoTraceResponse } from "../../../traces/backends/tempo/tempo.types";

export class ConversationResponseDto {
  conversations: ConversationListItemResponseDto[];
}

export class FullConversationResponseDto {
  traces: TempoTraceResponse[];
}
