import { ApiProperty } from "@nestjs/swagger";

export class ProjectRetentionResponseDto {
  @ApiProperty({
    description:
      "Number of days to retain evaluations (includes score_results via cascade)",
    nullable: true,
    example: 90,
  })
  evaluationRetentionDays: number | null;

  @ApiProperty({
    description:
      "Number of days to retain experiments (includes experiment_results and evaluations that reference them via cascade)",
    nullable: true,
    example: 90,
  })
  experimentRetentionDays: number | null;
}
