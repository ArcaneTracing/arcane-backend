import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsDateString,
  IsUUID,
} from "class-validator";

export class EnqueueTraceRequestDto {
  @IsString()
  @IsNotEmpty()
  otelTraceId: string;

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
