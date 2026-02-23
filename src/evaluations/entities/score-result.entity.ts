import {
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from "typeorm";
import { Score } from "../../scores/entities/score.entity";
import { Evaluation } from "./evaluation.entity";
import { DatasetRow } from "../../datasets/entities/dataset-row.entity";
import { ExperimentResult } from "../../experiments/entities/experiment-result.entity";

export enum ScoreResultStatus {
  PENDING = "PENDING",
  DONE = "DONE",
}

@Entity("score_results")
export class ScoreResult {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ name: "evaluation_id" })
  evaluationId: string;

  @ManyToOne(() => Evaluation, (evaluation) => evaluation.scoreResults, {
    onDelete: "CASCADE",
  })
  @JoinColumn({ name: "evaluation_id" })
  evaluation: Evaluation;

  @Column({ name: "score_id" })
  scoreId: string;

  @ManyToOne(() => Score, { onDelete: "CASCADE" })
  @JoinColumn({ name: "score_id" })
  score: Score;

  @Column({ name: "dataset_row_id", nullable: true })
  datasetRowId?: string | null;

  @ManyToOne(() => DatasetRow, { nullable: true, onDelete: "SET NULL" })
  @JoinColumn({ name: "dataset_row_id" })
  datasetRow?: DatasetRow | null;

  @Column({ name: "experiment_result_id", nullable: true })
  experimentResultId?: string | null;

  @ManyToOne(() => ExperimentResult, { nullable: true, onDelete: "SET NULL" })
  @JoinColumn({ name: "experiment_result_id" })
  experimentResult?: ExperimentResult | null;

  @Column({ type: "float", nullable: true })
  value: number | null;

  @Column({ type: "text", nullable: true })
  reasoning?: string | null;

  @Column({
    type: "enum",
    enum: ScoreResultStatus,
    default: ScoreResultStatus.PENDING,
  })
  status: ScoreResultStatus;

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt: Date;
}
