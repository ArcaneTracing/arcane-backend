import {
  IsString,
  IsNotEmpty,
  IsArray,
  IsOptional,
  IsDateString,
  IsUUID,
} from "class-validator";

export class EnqueueConversationRequestDto {
  @IsUUID()
  @IsNotEmpty()
  conversationConfigId: string;

  @IsUUID()
  @IsNotEmpty()
  datasourceId: string;

  @IsString()
  @IsNotEmpty()
  otelConversationId: string;

  @IsArray()
  @IsString({ each: true })
  @IsNotEmpty()
  otelTraceIds: string[];

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;
}
