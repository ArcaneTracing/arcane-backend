import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from "typeorm";
import { Project } from "../../projects/entities/project.entity";
import { DatasetRow } from "./dataset-row.entity";

@Entity("datasets")
export class Dataset {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column()
  name: string;

  @Column({ type: "text", nullable: true })
  description?: string;

  @Column({ type: "jsonb" })
  header: string[];

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt: Date;

  @Column({ name: "created_by_id" })
  createdById: string;

  @ManyToOne(() => Project, (project) => project.datasets, {
    onDelete: "CASCADE",
  })
  @JoinColumn({ name: "project_id" })
  project: Project;

  @Column({ name: "project_id" })
  projectId: string;

  @OneToMany(() => DatasetRow, (row) => row.dataset, {
    cascade: true,
    eager: false,
  })
  rows: DatasetRow[];
}
