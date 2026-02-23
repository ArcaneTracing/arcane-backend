import { PartialType } from "@nestjs/mapped-types";
import {
  IsString,
  IsNotEmpty,
  IsObject,
  IsNumber,
  Min,
  IsOptional,
  IsArray,
  ValidateIf,
} from "class-validator";
import { ValidateNested } from "class-validator";
import { Type } from "class-transformer";
import { ModelConfigurationData } from "../model-configuration-types";

class ModelConfigurationDto {
  @IsString()
  @IsNotEmpty()
  adapter: string;

  @IsString()
  @IsNotEmpty()
  modelName: string;

  @ValidateIf((o, v) => v == null || o.adapter === "bedrock")
  @IsString()
  @IsNotEmpty()
  apiKey?: string | null;

  @IsOptional()
  @IsNumber()
  @Min(0)
  inputCostPerToken?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  outputCostPerToken?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  temperature?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  maxTokens?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  topP?: number;

  @IsOptional()
  @IsNumber()
  frequencyPenalty?: number;

  @IsOptional()
  @IsNumber()
  presencePenalty?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  stopSequences?: string[];

  @IsOptional()
  @IsObject()
  config?: Record<string, unknown>;
}

export class CreateModelConfigurationRequestDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @ValidateNested()
  @Type(() => ModelConfigurationDto)
  @IsObject()
  @IsNotEmpty()
  configuration: ModelConfigurationData;
}

export class UpdateModelConfigurationRequestDto extends PartialType(
  CreateModelConfigurationRequestDto,
) {}
