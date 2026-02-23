import { IsInt, IsOptional, Min, Max } from "class-validator";
import { ApiPropertyOptional } from "@nestjs/swagger";
import { RETENTION_CONFIG } from "../../config/retention.config";

export class UpdateOrganisationRetentionRequestDto {
  @ApiPropertyOptional({
    description: "Number of days to retain audit logs",
    minimum: RETENTION_CONFIG.AUDIT_LOGS.MIN_DAYS,
    maximum: RETENTION_CONFIG.AUDIT_LOGS.MAX_DAYS,
    example: 365,
  })
  @IsOptional()
  @IsInt()
  @Min(RETENTION_CONFIG.AUDIT_LOGS.MIN_DAYS)
  @Max(RETENTION_CONFIG.AUDIT_LOGS.MAX_DAYS)
  auditLogRetentionDays?: number;
}
