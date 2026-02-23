import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";
import { Project } from "../../projects/entities/project.entity";
import { PromptVersion } from "../../prompts/entities/prompt-version.entity";
import { Dataset } from "../../datasets/entities/dataset.entity";
import { ExperimentResult } from "./experiment-result.entity";

export interface PromptInputMappings {
  [key: string]: string;
}

@Entity("experiments")
export class Experiment {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ name: "project_id" })
  projectId: string;

  @Column()
  name: string;

  @Column({ nullable: true })
  description?: string | null;

  @ManyToOne(() => Project, { onDelete: "CASCADE" })
  @JoinColumn({ name: "project_id" })
  project: Project;

  @Column({ name: "prompt_version_id" })
  promptVersionId: string;

  @ManyToOne(() => PromptVersion, { onDelete: "CASCADE" })
  @JoinColumn({ name: "prompt_version_id" })
  promptVersion: PromptVersion;

  @Column({ name: "dataset_id" })
  datasetId: string;

  @ManyToOne(() => Dataset, { onDelete: "CASCADE" })
  @JoinColumn({ name: "dataset_id" })
  dataset: Dataset;

  @Column({
    name: "prompt_input_mappings",
    type: "jsonb",
    default: () => "'{}'::jsonb",
  })
  promptInputMappings: PromptInputMappings;

  @Column({ name: "created_by_id", nullable: true })
  createdById?: string | null;

  @OneToMany(() => ExperimentResult, (result) => result.experiment)
  results: ExperimentResult[];

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt: Date;
}
