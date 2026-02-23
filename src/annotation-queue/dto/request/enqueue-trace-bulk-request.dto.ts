import {
  IsString,
  IsNotEmpty,
  IsArray,
  IsOptional,
  IsDateString,
  IsUUID,
} from "class-validator";

export class EnqueueTraceBulkRequestDto {
  @IsArray()
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  otelTraceIds: string[];

  @IsUUID()
  @IsNotEmpty()
  datasourceId: string;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;
}
