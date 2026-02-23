import {
  Entity as TypeOrmEntity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from "typeorm";
import { Organisation } from "../../organisations/entities/organisation.entity";

export enum MatchPatternType {
  VALUE = "value",
  REGEX = "regex",
}

export enum EntityType {
  MODEL = "model",
  TOOL = "tool",
  EMBEDDING = "embedding",
  RETRIEVER = "retriever",
  GUARDRAIL = "guardrail",
  EVALUATOR = "evaluator",
  AGENT = "agent",
  CUSTOM = "custom",
}

export enum MessageType {
  USER = "user",
  ASSISTANT = "assistant",
  SYSTEM = "system",
  TOOL = "tool",
}

export enum HighlightValueType {
  STRING = "string",
  NUMBER = "number",
  BOOLEAN = "boolean",
  OBJECT = "object",
}

export interface Highlight {
  title: string;
  key: string;
  valueType: HighlightValueType;
}

export interface FlatMessageMatchingPatterns {
  rolePattern: string;
  contentPattern: string;
  namePattern: string;
  toolMessageCallIdPattern: string;
  toolCallFunctionNamePattern: string;
  toolCallIdPattern: string;
  toolCallFunctionArgumentPattern: string;
}

export interface CanonicalMessageMatchingConfiguration {
  inputAttributeKey: string;
  outputAttributeKey: string;
}

export interface FlatMessageMatchingConfiguration {
  flatInputMessageMatchingKeys: FlatMessageMatchingPatterns;
  flatOutputMessageMatchingKeys: FlatMessageMatchingPatterns;
}

export enum MessageMatchingType {
  CANONICAL = "canonical",
  FLAT = "flat",
}

export interface MessageMatching {
  type: MessageMatchingType;
  canonicalMessageMatchingConfiguration: CanonicalMessageMatchingConfiguration | null;
  flatMessageMatchingConfiguration: FlatMessageMatchingConfiguration | null;
}

@TypeOrmEntity("entities")
export class Entity {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column()
  name: string;

  @Column({ type: "text", nullable: true })
  description?: string;

  @Column()
  type: string;

  @Column({ name: "matching_attribute_name" })
  matchingAttributeName: string;

  @Column({
    type: "enum",
    enum: MatchPatternType,
    name: "matching_pattern_type",
  })
  matchingPatternType: MatchPatternType;

  @Column({ type: "text", nullable: true, name: "matching_pattern" })
  matchingPattern?: string | null;

  @Column({ type: "text", nullable: true, name: "matching_value" })
  matchingValue?: string | null;

  @Column({
    type: "enum",
    enum: EntityType,
    name: "entity_type",
  })
  entityType: EntityType;

  @Column({
    type: "jsonb",
    nullable: true,
    default: () => "'[]'::jsonb",
    name: "entity_highlights",
  })
  entityHighlights?: Highlight[];

  @Column({ type: "jsonb", nullable: true, name: "message_matching" })
  messageMatching: MessageMatching | null;

  @Column({ type: "varchar", length: 255, nullable: true, name: "icon_id" })
  iconId?: string;

  @Column({ type: "varchar", length: 255, nullable: true, name: "external_id" })
  externalId?: string | null;

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt: Date;

  @Column({ name: "created_by_id" })
  createdById: string;

  @ManyToOne(() => Organisation, {
    onDelete: "CASCADE",
  })
  @JoinColumn({ name: "organisation_id" })
  organisation: Organisation;

  @Column({ name: "organisation_id" })
  organisationId: string;
}
