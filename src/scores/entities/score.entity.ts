import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";
import { Project } from "../../projects/entities/project.entity";
import { Organisation } from "../../organisations/entities/organisation.entity";
import { Prompt } from "../../prompts/entities/prompt.entity";

export enum ScoringType {
  NUMERIC = "NUMERIC",
  ORDINAL = "ORDINAL",
  NOMINAL = "NOMINAL",
  RAGAS = "RAGAS",
}

export interface ScaleOption {
  label: string;
  value: number;
}

export interface OrdinalConfig {
  acceptable_set?: string[];
  threshold_rank?: number;
}

@Entity("scores")
export class Score {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ name: "project_id", nullable: true })
  projectId?: string | null;

  @ManyToOne(() => Project, {
    nullable: true,
    onDelete: "CASCADE",
  })
  @JoinColumn({ name: "project_id" })
  project?: Project | null;

  @Column({ type: "text" })
  name: string;

  @Column({ type: "text", nullable: true })
  description?: string | null;

  @Column({
    type: "enum",
    enum: ScoringType,
    name: "scoring_type",
  })
  scoringType: ScoringType;

  @Column({ name: "ragas_score_key", nullable: true })
  ragasScoreKey?: string | null;

  @Column({ type: "jsonb", nullable: true })
  scale?: ScaleOption[] | null;

  @Column({ type: "jsonb", name: "ordinal_config", nullable: true })
  ordinalConfig?: OrdinalConfig | null;

  @Column({ name: "evaluator_prompt_id", nullable: true })
  evaluatorPromptId?: string | null;

  @ManyToOne(() => Prompt, {
    nullable: true,
    onDelete: "SET NULL",
  })
  @JoinColumn({ name: "evaluator_prompt_id" })
  evaluatorPrompt?: Prompt | null;

  @Column({ name: "created_by_id", nullable: true })
  createdById?: string | null;

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt: Date;
}
