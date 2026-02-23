import {
  IsArray,
  IsString,
  IsNotEmpty,
  ArrayMinSize,
  IsOptional,
  IsDateString,
} from "class-validator";

export class GetConversationsByTracesRequestDto {
  @IsArray()
  @ArrayMinSize(1, { message: "At least one trace ID is required" })
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  traceIds: string[];

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;
}
