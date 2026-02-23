import {
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from "typeorm";
import { Experiment } from "./experiment.entity";
import { DatasetRow } from "../../datasets/entities/dataset-row.entity";

export enum ExperimentResultStatus {
  PENDING = "PENDING",
  DONE = "DONE",
}

@Entity("experiment_results")
export class ExperimentResult {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ name: "experiment_id" })
  experimentId: string;

  @ManyToOne(() => Experiment, (experiment) => experiment.results, {
    onDelete: "CASCADE",
  })
  @JoinColumn({ name: "experiment_id" })
  experiment: Experiment;

  @Column({ name: "dataset_row_id" })
  datasetRowId: string;

  @ManyToOne(() => DatasetRow, { onDelete: "CASCADE" })
  @JoinColumn({ name: "dataset_row_id" })
  datasetRow: DatasetRow;

  @Column({ type: "text", nullable: true })
  result: string | null;

  @Column({
    type: "enum",
    enum: ExperimentResultStatus,
    default: ExperimentResultStatus.PENDING,
  })
  status: ExperimentResultStatus;

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt: Date;
}
