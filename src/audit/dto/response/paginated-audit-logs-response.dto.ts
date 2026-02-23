import { ApiProperty } from "@nestjs/swagger";
import { AuditLog } from "../../entities/audit-log.entity";

export class PaginatedAuditLogsResponseDto {
  @ApiProperty({
    description: "Array of audit logs",
    type: [AuditLog],
  })
  data: AuditLog[];

  @ApiProperty({
    description:
      "Cursor for the next page (ISO timestamp string). Null if no more pages.",
    type: String,
    nullable: true,
    example: "2026-01-26T10:30:00.000Z",
  })
  nextCursor: string | null;

  @ApiProperty({
    description: "Whether there are more results available",
    type: Boolean,
    example: true,
  })
  hasMore: boolean;

  @ApiProperty({
    description: "The limit used for this query",
    type: Number,
    example: 50,
  })
  limit: number;
}
