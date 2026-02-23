import {
  IsString,
  IsNotEmpty,
  IsEnum,
  IsOptional,
  IsArray,
  ValidateNested,
  ValidateIf,
} from "class-validator";
import { ApiProperty } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { PartialType } from "@nestjs/mapped-types";
import {
  MatchPatternType,
  EntityType,
  HighlightValueType,
  MessageMatchingType,
} from "../../entities/entity.entity";

export class HighlightDto {
  @ApiProperty({
    type: "string",
    description: "Highlight title",
    example: "Model Name",
  })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({
    type: "string",
    description: "Attribute key to highlight",
    example: "llm.model",
  })
  @IsString()
  @IsNotEmpty()
  key: string;

  @ApiProperty({
    enum: HighlightValueType,
    description: "Type of the highlight value",
    enumName: "HighlightValueType",
  })
  @IsEnum(HighlightValueType)
  @IsNotEmpty()
  valueType: HighlightValueType;
}

export class CanonicalMessageMatchingConfigurationDto {
  @ApiProperty({
    type: "string",
    description: "Input attribute key for message matching",
    example: "input.llm.model",
  })
  @IsString()
  @IsNotEmpty()
  inputAttributeKey: string;

  @ApiProperty({
    type: "string",
    description: "Output attribute key for message matching",
    example: "output.llm.model",
  })
  @IsString()
  @IsNotEmpty()
  outputAttributeKey: string;
}

export class FlatMessageMatchingPatternsDto {
  @IsString()
  @IsNotEmpty()
  rolePattern: string;

  @IsString()
  @IsNotEmpty()
  contentPattern: string;

  @IsString()
  @IsNotEmpty()
  namePattern: string;

  @IsString()
  @IsNotEmpty()
  toolMessageCallIdPattern: string;

  @IsString()
  @IsNotEmpty()
  toolCallFunctionNamePattern: string;

  @IsString()
  @IsNotEmpty()
  toolCallIdPattern: string;

  @IsString()
  @IsNotEmpty()
  toolCallFunctionArgumentPattern: string;
}

export class FlatMessageMatchingConfigurationDto {
  @ValidateNested()
  @Type(() => FlatMessageMatchingPatternsDto)
  @IsNotEmpty()
  flatInputMessageMatchingKeys: FlatMessageMatchingPatternsDto;

  @ValidateNested()
  @Type(() => FlatMessageMatchingPatternsDto)
  @IsNotEmpty()
  flatOutputMessageMatchingKeys: FlatMessageMatchingPatternsDto;
}

export class MessageMatchingDto {
  @ApiProperty({
    enum: MessageMatchingType,
    description: "Type of message matching",
    enumName: "MessageMatchingType",
  })
  @IsEnum(MessageMatchingType)
  type: MessageMatchingType;

  @ApiProperty({
    type: CanonicalMessageMatchingConfigurationDto,
    nullable: true,
    required: false,
    description:
      "Canonical message matching configuration (required when type is CANONICAL)",
  })
  @ValidateIf((o) => o.type === MessageMatchingType.CANONICAL)
  @IsNotEmpty({
    message:
      "canonicalMessageMatchingConfiguration is required when type is canonical",
  })
  @ValidateIf(
    (o) =>
      o.type === MessageMatchingType.CANONICAL &&
      o.canonicalMessageMatchingConfiguration !== null &&
      o.canonicalMessageMatchingConfiguration !== undefined,
  )
  @ValidateNested()
  @Type(() => CanonicalMessageMatchingConfigurationDto)
  canonicalMessageMatchingConfiguration: CanonicalMessageMatchingConfigurationDto | null;

  @ApiProperty({
    type: FlatMessageMatchingConfigurationDto,
    nullable: true,
    required: false,
    description:
      "Flat message matching configuration (required when type is FLAT)",
  })
  @ValidateIf((o) => o.type === MessageMatchingType.FLAT)
  @IsNotEmpty({
    message: "flatMessageMatchingConfiguration is required when type is flat",
  })
  @ValidateIf(
    (o) =>
      o.type === MessageMatchingType.FLAT &&
      o.flatMessageMatchingConfiguration !== null &&
      o.flatMessageMatchingConfiguration !== undefined,
  )
  @ValidateNested()
  @Type(() => FlatMessageMatchingConfigurationDto)
  flatMessageMatchingConfiguration: FlatMessageMatchingConfigurationDto | null;
}

export class CreateEntityRequestDto {
  @ApiProperty({ type: "string", description: "Entity name", example: "GPT-4" })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({
    type: "string",
    required: false,
    description: "Entity description",
    example: "OpenAI GPT-4 model",
  })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({
    type: "string",
    description: "Entity type identifier",
    example: "gpt-4",
  })
  @IsString()
  @IsNotEmpty()
  type: string;

  @ApiProperty({
    type: "string",
    description: "Attribute name used for matching traces",
    example: "llm.model",
  })
  @IsString()
  @IsNotEmpty()
  matchingAttributeName: string;

  @ApiProperty({
    enum: MatchPatternType,
    description: "Pattern type for matching",
    enumName: "MatchPatternType",
  })
  @IsEnum(MatchPatternType)
  @IsNotEmpty()
  matchingPatternType: MatchPatternType;

  @ApiProperty({
    type: "string",
    required: false,
    description:
      "Regex pattern for matching (required if matchingPatternType is REGEX)",
    example: "^gpt-4",
  })
  @IsString()
  @IsOptional()
  matchingPattern?: string;

  @ApiProperty({
    type: "string",
    required: false,
    description:
      "Exact value for matching (required if matchingPatternType is VALUE)",
    example: "gpt-4",
  })
  @IsString()
  @IsOptional()
  matchingValue?: string;

  @ApiProperty({
    enum: EntityType,
    description: "Type of entity",
    enumName: "EntityType",
    example: EntityType.MODEL,
  })
  @IsEnum(EntityType)
  @IsNotEmpty()
  entityType: EntityType;

  @ApiProperty({
    type: [HighlightDto],
    required: false,
    description: "Entity highlights configuration",
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => HighlightDto)
  @IsOptional()
  entityHighlights?: HighlightDto[];

  @ApiProperty({
    type: MessageMatchingDto,
    required: false,
    description:
      "Message matching configuration (required when entityType is MODEL)",
  })
  @ValidateIf((o) => o.entityType === EntityType.MODEL)
  @IsNotEmpty({
    message: "messageMatching is required when entityType is MODEL",
  })
  @ValidateIf(
    (o) => o.messageMatching !== undefined && o.messageMatching !== null,
  )
  @ValidateNested()
  @Type(() => MessageMatchingDto)
  messageMatching?: MessageMatchingDto;

  @ApiProperty({
    type: "string",
    required: false,
    description: "Custom icon identifier for UI display",
    example: "cloud",
  })
  @IsString()
  @IsOptional()
  iconId?: string;

  @ApiProperty({
    type: "string",
    required: false,
    description: "External identifier for entity updates",
  })
  @IsString()
  @IsOptional()
  externalId?: string;
}

export class UpdateEntityRequestDto extends PartialType(
  CreateEntityRequestDto,
) {}
