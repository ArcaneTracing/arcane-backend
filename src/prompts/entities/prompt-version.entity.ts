import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from "typeorm";
import { Prompt } from "./prompt.entity";
import { ModelConfiguration } from "../../model-configuration/entities/model-configuration.entity";

export enum ModelProvider {
  OPENAI = "OPENAI",
  AZURE_OPENAI = "AZURE_OPENAI",
  ANTHROPIC = "ANTHROPIC",
  GOOGLE = "GOOGLE",
  DEEPSEEK = "DEEPSEEK",
  XAI = "XAI",
  OLLAMA = "OLLAMA",
  AWS = "AWS",
}

export enum TemplateType {
  CHAT = "CHAT",
  STR = "STR",
}

export enum TemplateFormat {
  MUSTACHE = "MUSTACHE",
  F_STRING = "F_STRING",
  NONE = "NONE",
}

@Entity("prompt_versions")
export class PromptVersion {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ name: "prompt_id" })
  promptId: string;

  @ManyToOne(() => Prompt, (prompt) => prompt.versions, {
    onDelete: "CASCADE",
  })
  @JoinColumn({ name: "prompt_id" })
  prompt: Prompt;

  @Column({ name: "user_id", nullable: true })
  userId: string | null;

  @Column({ name: "version_name", nullable: true })
  versionName: string | null;

  @Column({ type: "text", nullable: true })
  description: string | null;

  @Column({ name: "model_configuration_id" })
  modelConfigurationId: string;

  @ManyToOne(() => ModelConfiguration, {
    onDelete: "RESTRICT",
  })
  @JoinColumn({ name: "model_configuration_id" })
  modelConfiguration: ModelConfiguration;

  @Column({
    name: "template_type",
    type: "enum",
    enum: TemplateType,
  })
  templateType: TemplateType;

  @Column({
    name: "template_format",
    type: "enum",
    enum: TemplateFormat,
  })
  templateFormat: TemplateFormat;

  @Column({ type: "jsonb" })
  template: unknown;

  @Column({ name: "invocation_parameters", type: "jsonb" })
  invocationParameters: unknown;

  @Column({ type: "jsonb", nullable: true })
  tools: unknown | null;

  @Column({ name: "response_format", type: "jsonb", nullable: true })
  responseFormat: unknown | null;

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt: Date;
}
