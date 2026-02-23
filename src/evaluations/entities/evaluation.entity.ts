import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  JoinTable,
  ManyToMany,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";
import { Project } from "../../projects/entities/project.entity";
import { Dataset } from "../../datasets/entities/dataset.entity";
import { Experiment } from "../../experiments/entities/experiment.entity";
import { Score } from "../../scores/entities/score.entity";
import { ScoreResult } from "./score-result.entity";

export enum EvaluationType {
  AUTOMATIC = "AUTOMATIC",
  MANUAL = "MANUAL",
}

export enum EvaluationScope {
  DATASET = "DATASET",
  EXPERIMENT = "EXPERIMENT",
}

@Entity("evaluations")
export class Evaluation {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ name: "project_id" })
  projectId: string;

  @ManyToOne(() => Project, { onDelete: "CASCADE" })
  @JoinColumn({ name: "project_id" })
  project: Project;

  @Column({
    name: "evaluation_type",
    type: "enum",
    enum: EvaluationType,
  })
  evaluationType: EvaluationType;

  @Column({
    name: "evaluation_scope",
    type: "enum",
    enum: EvaluationScope,
  })
  evaluationScope: EvaluationScope;

  @Column()
  name: string;

  @Column({ nullable: true })
  description?: string | null;

  @Column({ name: "dataset_id", nullable: true })
  datasetId?: string | null;

  @ManyToOne(() => Dataset, { nullable: true, onDelete: "SET NULL" })
  @JoinColumn({ name: "dataset_id" })
  dataset?: Dataset | null;

  @ManyToMany(() => Experiment, { cascade: false })
  @JoinTable({
    name: "evaluation_experiments",
    joinColumn: { name: "evaluation_id", referencedColumnName: "id" },
    inverseJoinColumn: { name: "experiment_id", referencedColumnName: "id" },
  })
  experiments: Experiment[];

  @ManyToMany(() => Score, { cascade: false })
  @JoinTable({
    name: "evaluation_scores",
    joinColumn: { name: "evaluation_id", referencedColumnName: "id" },
    inverseJoinColumn: { name: "score_id", referencedColumnName: "id" },
  })
  scores: Score[];

  @Column({ name: "metadata", type: "jsonb", nullable: true })
  metadata?: Record<string, unknown> | null;

  @Column({ name: "score_mappings", type: "jsonb", nullable: true })
  scoreMappings?: Record<string, Record<string, unknown>> | null;

  @Column({ name: "ragas_model_configuration_id", nullable: true })
  ragasModelConfigurationId?: string | null;

  @Column({ name: "created_by_id", nullable: true })
  createdById?: string | null;

  @OneToMany(() => ScoreResult, (scoreResult) => scoreResult.evaluation)
  scoreResults: ScoreResult[];

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt: Date;
}
