import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from "typeorm";
import { Project } from "./project.entity";

@Entity("attribute_visibility_rules")
@Index(["projectId"])
export class AttributeVisibilityRule {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @ManyToOne(() => Project, {
    onDelete: "CASCADE",
  })
  @JoinColumn({ name: "project_id" })
  project: Project;

  @Column({ name: "project_id" })
  projectId: string;

  @Column({ type: "varchar", length: 255, name: "attribute_name" })
  attributeName: string;

  @Column({
    type: "uuid",
    array: true,
    default: () => "ARRAY[]::uuid[]",
    name: "hidden_role_ids",
  })
  hiddenRoleIds: string[];

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt: Date;

  @Column({ name: "created_by_id" })
  createdById: string;

  @Column({ name: "updated_by_id", nullable: true })
  updatedById?: string | null;
}
