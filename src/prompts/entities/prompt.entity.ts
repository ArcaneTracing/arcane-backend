import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Unique,
} from "typeorm";
import { Project } from "../../projects/entities/project.entity";
import { PromptVersion } from "./prompt-version.entity";

@Entity("prompts")
@Unique(["projectId", "name"])
export class Prompt {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column()
  name: string;

  @Column({ type: "text", nullable: true })
  description: string | null;

  @ManyToOne(() => Project, {
    onDelete: "CASCADE",
  })
  @JoinColumn({ name: "project_id" })
  project: Project;

  @Column({ name: "project_id" })
  projectId: string;

  @Column({ name: "promoted_version_id", nullable: true })
  promotedVersionId: string | null;

  @ManyToOne(() => PromptVersion, { nullable: true, onDelete: "SET NULL" })
  @JoinColumn({ name: "promoted_version_id" })
  promotedVersion?: PromptVersion | null;

  @Column({ type: "jsonb", default: () => "'{}'::jsonb" })
  metadata: Record<string, unknown>;

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt: Date;

  @OneToMany(() => PromptVersion, (version) => version.prompt, {
    cascade: true,
  })
  versions: PromptVersion[];
}
