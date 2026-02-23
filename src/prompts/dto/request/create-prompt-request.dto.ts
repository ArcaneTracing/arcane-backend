import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  ValidateNested,
  IsObject,
  IsArray,
} from "class-validator";
import { Type } from "class-transformer";
import {
  ModelProvider,
  TemplateType,
  TemplateFormat,
  PromptTemplate,
  InvocationParameters,
  Tools,
  ResponseFormat,
} from "../prompt-types";

export class CreatePromptRequestDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsOptional()
  description?: string | null;

  @IsObject()
  @IsOptional()
  metadata?: Record<string, unknown> | null;
}

export class CreatePromptVersionRequestDto {
  @IsString()
  @IsOptional()
  versionName?: string | null;

  @IsString()
  @IsOptional()
  description?: string | null;

  @IsString()
  @IsNotEmpty()
  modelConfigurationId: string;

  @IsObject()
  @ValidateNested()
  @Type(() => Object)
  template: PromptTemplate;

  @IsEnum(TemplateType)
  templateType: TemplateType;

  @IsEnum(TemplateFormat)
  templateFormat?: TemplateFormat;

  @IsObject()
  @ValidateNested()
  @Type(() => Object)
  invocationParameters: InvocationParameters;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => Object)
  tools?: Tools | null;

  @IsObject()
  @IsOptional()
  @ValidateNested()
  @Type(() => Object)
  responseFormat?: ResponseFormat | null;
}

export class CreatePromptRequestBodyDto {
  @ValidateNested()
  @Type(() => CreatePromptRequestDto)
  prompt: CreatePromptRequestDto;

  @ValidateNested()
  @Type(() => CreatePromptVersionRequestDto)
  version: CreatePromptVersionRequestDto;
}

export class UpdatePromptRequestDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  description?: string | null;
}
