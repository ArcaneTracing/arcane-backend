import { Expose } from "class-transformer";

export class QueuedTraceResponseDto {
  @Expose()
  id: string;

  @Expose()
  otelTraceId: string;

  @Expose()
  datasourceId: string | null;

  @Expose()
  startDate?: Date;

  @Expose()
  endDate?: Date;
}
