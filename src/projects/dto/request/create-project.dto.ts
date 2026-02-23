import {
  IsNotEmpty,
  IsString,
  IsOptional,
  IsArray,
  ValidateIf,
} from "class-validator";

export class CreateProjectDto {
  @IsNotEmpty()
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsArray()
  userIds?: string[];

  @ValidateIf((o) => o.traceFilterAttributeName || o.traceFilterAttributeValue)
  @IsNotEmpty()
  @IsString()
  traceFilterAttributeName?: string;

  @ValidateIf((o) => o.traceFilterAttributeName || o.traceFilterAttributeValue)
  @IsNotEmpty()
  @IsString()
  traceFilterAttributeValue?: string;
}
