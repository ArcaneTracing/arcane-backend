import { ApiProperty } from "@nestjs/swagger";

export class OrganisationRetentionResponseDto {
  @ApiProperty({
    description: "Number of days to retain audit logs",
    nullable: true,
    example: 365,
  })
  auditLogRetentionDays: number | null;
}
