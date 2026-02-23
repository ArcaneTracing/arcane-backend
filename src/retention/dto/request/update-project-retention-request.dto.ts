import { IsInt, IsOptional, Min, Max } from "class-validator";
import { ApiPropertyOptional } from "@nestjs/swagger";
import { RETENTION_CONFIG } from "../../config/retention.config";

export class UpdateProjectRetentionRequestDto {
  @ApiPropertyOptional({
    description:
      "Number of days to retain evaluations (includes score_results via cascade)",
    minimum: RETENTION_CONFIG.EVALUATIONS.MIN_DAYS,
    maximum: RETENTION_CONFIG.EVALUATIONS.MAX_DAYS,
    example: 90,
  })
  @IsOptional()
  @IsInt()
  @Min(RETENTION_CONFIG.EVALUATIONS.MIN_DAYS)
  @Max(RETENTION_CONFIG.EVALUATIONS.MAX_DAYS)
  evaluationRetentionDays?: number;

  @ApiPropertyOptional({
    description:
      "Number of days to retain experiments (includes experiment_results and evaluations that reference them via cascade)",
    minimum: RETENTION_CONFIG.EXPERIMENTS.MIN_DAYS,
    maximum: RETENTION_CONFIG.EXPERIMENTS.MAX_DAYS,
    example: 90,
  })
  @IsOptional()
  @IsInt()
  @Min(RETENTION_CONFIG.EXPERIMENTS.MIN_DAYS)
  @Max(RETENTION_CONFIG.EXPERIMENTS.MAX_DAYS)
  experimentRetentionDays?: number;
}
