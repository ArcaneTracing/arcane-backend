import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from "typeorm";
import { Dataset } from "./dataset.entity";

@Entity("dataset_rows")
export class DatasetRow {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ type: "jsonb" })
  values: string[];

  @ManyToOne(() => Dataset, (dataset) => dataset.rows, {
    onDelete: "CASCADE",
  })
  @JoinColumn({ name: "dataset_id" })
  dataset: Dataset;

  @Column({ name: "dataset_id" })
  datasetId: string;

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt: Date;
}
