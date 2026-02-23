import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  ManyToMany,
  JoinColumn,
  JoinTable,
} from "typeorm";
import { Dataset } from "../../datasets/entities/dataset.entity";
import { Organisation } from "../../organisations/entities/organisation.entity";
import { BetterAuthUser } from "../../auth/entities/user.entity";

@Entity("projects")
export class Project {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column()
  name: string;

  @Column({ type: "text", nullable: true })
  description: string;

  @ManyToOne(() => Organisation, (organisation) => organisation.projects, {
    onDelete: "CASCADE",
  })
  @JoinColumn({ name: "organisation_id" })
  organisation: Organisation;

  @Column({ name: "organisation_id" })
  organisationId: string;

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt: Date;

  @Column({ name: "created_by_id" })
  createdById: string;

  @ManyToMany(() => BetterAuthUser, (user) => user.projects)
  @JoinTable({
    name: "project_users",
    joinColumn: { name: "project_id", referencedColumnName: "id" },
    inverseJoinColumn: { name: "user_id", referencedColumnName: "id" },
  })
  users: BetterAuthUser[];

  @OneToMany(() => Dataset, (dataset) => dataset.project)
  datasets: Dataset[];

  @Column({
    type: "varchar",
    length: 255,
    nullable: true,
    name: "trace_filter_attribute_name",
  })
  traceFilterAttributeName?: string;

  @Column({
    type: "varchar",
    length: 255,
    nullable: true,
    name: "trace_filter_attribute_value",
  })
  traceFilterAttributeValue?: string;

  @Column({ name: "evaluation_retention_days", nullable: true })
  evaluationRetentionDays?: number | null;

  @Column({ name: "experiment_retention_days", nullable: true })
  experimentRetentionDays?: number | null;
}
