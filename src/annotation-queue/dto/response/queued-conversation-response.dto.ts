import { Expose } from "class-transformer";

export class QueuedConversationResponseDto {
  @Expose()
  id: string;

  @Expose()
  otelConversationId: string;

  @Expose()
  conversationConfigId: string;

  @Expose()
  datasourceId: string | null;

  @Expose()
  traceIds: string[];

  @Expose()
  startDate?: Date;

  @Expose()
  endDate?: Date;
}
