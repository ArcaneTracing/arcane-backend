import { AnnotationResponseDto } from "./annotation-response.dto";
import { QueuedConversationResponseDto } from "./queued-conversation-response.dto";
import { QueuedTraceResponseDto } from "./queued-trace-response.dto";

export class TraceToBeAnnotatedDto {
  otelTraceId: string;
  id: string;
  datasourceId: string | null;
  startDate?: Date;
  endDate?: Date;
}

export class AnnotationQueueResponseDto {
  id: string;
  name: string;
  description?: string;
  type: string;
  templateId: string;
  annotations: AnnotationResponseDto[];
  tracesToBeAnnotated: QueuedTraceResponseDto[];
  conversationsToBeAnnotated: QueuedConversationResponseDto[];
}
