import { Expose, Type } from "class-transformer";
import { QueuedTraceResponseDto } from "./queued-trace-response.dto";

export class BulkQueueTraceResponseDto {
  @Expose()
  @Type(() => QueuedTraceResponseDto)
  added: QueuedTraceResponseDto[];

  @Expose()
  skipped: string[];

  @Expose()
  total: number;

  @Expose()
  addedCount: number;

  @Expose()
  skippedCount: number;
}
