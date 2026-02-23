import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from "typeorm";
import { Project } from "./project.entity";

@Entity("project_api_keys")
export class ProjectApiKey {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ name: "project_id", unique: true })
  projectId: string;

  @ManyToOne(() => Project, { onDelete: "CASCADE" })
  @JoinColumn({ name: "project_id" })
  project: Project;

  @Column({ name: "fast_hashed_secret_key", unique: true })
  fastHashedSecretKey: string;

  @Column({ name: "created_by_id" })
  createdById: string;

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;

  @Column({ name: "last_used_at", type: "timestamp", nullable: true })
  lastUsedAt: Date | null;
}
