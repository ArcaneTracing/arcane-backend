import { ApiProperty } from "@nestjs/swagger";
import {
  MatchPatternType,
  EntityType,
  Highlight,
  MessageMatching,
} from "../../entities/entity.entity";

export class EntityResponseDto {
  @ApiProperty({ type: "string", format: "uuid", description: "Entity ID" })
  id: string;

  @ApiProperty({ type: "string", description: "Entity name" })
  name: string;

  @ApiProperty({
    type: "string",
    required: false,
    description: "Entity description",
  })
  description?: string;

  @ApiProperty({ type: "string", description: "Entity type identifier" })
  type: string;

  @ApiProperty({
    type: "string",
    description: "Attribute name used for matching",
  })
  matchingAttributeName: string;

  @ApiProperty({
    enum: MatchPatternType,
    description: "Pattern type for matching",
    enumName: "MatchPatternType",
  })
  matchingPatternType: MatchPatternType;

  @ApiProperty({
    type: "string",
    nullable: true,
    required: false,
    description: "Regex pattern for matching (if patternType is REGEX)",
  })
  matchingPattern?: string | null;

  @ApiProperty({
    type: "string",
    nullable: true,
    required: false,
    description: "Exact value for matching (if patternType is VALUE)",
  })
  matchingValue?: string | null;

  @ApiProperty({
    enum: EntityType,
    description: "Type of entity",
    enumName: "EntityType",
  })
  entityType: EntityType;

  @ApiProperty({
    type: "array",
    items: {
      type: "object",
      properties: {
        title: { type: "string" },
        key: { type: "string" },
        valueType: { enum: ["string", "number", "boolean", "object"] },
      },
    },
    required: false,
    description: "Entity highlights configuration",
  })
  entityHighlights?: Highlight[];

  @ApiProperty({
    type: Object,
    nullable: true,
    description:
      "Message matching configuration (required for MODEL entity type)",
    required: false,
  })
  messageMatching: MessageMatching | null;

  @ApiProperty({
    type: "string",
    nullable: true,
    required: false,
    description: "Custom icon identifier for UI display",
  })
  iconId?: string | null;

  @ApiProperty({
    type: "string",
    nullable: true,
    required: false,
    description: "External identifier",
  })
  externalId?: string | null;

  @ApiProperty({
    type: "string",
    format: "date-time",
    description: "Creation timestamp",
  })
  createdAt: Date;

  @ApiProperty({
    type: "string",
    format: "date-time",
    description: "Last update timestamp",
  })
  updatedAt: Date;
}
