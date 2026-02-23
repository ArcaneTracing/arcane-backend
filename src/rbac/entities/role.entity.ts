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
import { Organisation } from "../../organisations/entities/organisation.entity";
import { Project } from "../../projects/entities/project.entity";
import { getRoleScope, RoleScope } from "../utils/role-scope.util";

@Entity("roles")
@Index(["organisationId", "projectId"])
export class Role {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ name: "organisation_id", nullable: true })
  organisationId: string | null;

  @Column({ name: "project_id", nullable: true })
  projectId: string | null;

  @Column()
  name: string;

  @Column({ type: "text", nullable: true })
  description?: string;

  @Column({ type: "jsonb", default: () => "'[]'::jsonb" })
  permissions: string[];

  @Column({ name: "is_system_role", default: false })
  isSystemRole: boolean;

  @Column({ name: "is_instance_level", default: false })
  isInstanceLevel: boolean;

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt: Date;

  @ManyToOne(() => Organisation, { nullable: true, onDelete: "CASCADE" })
  @JoinColumn({ name: "organisation_id" })
  organisation?: Organisation;

  @ManyToOne(() => Project, { nullable: true, onDelete: "CASCADE" })
  @JoinColumn({ name: "project_id" })
  project?: Project;

  get scope(): RoleScope {
    return getRoleScope({
      organisationId: this.organisationId,
      projectId: this.projectId,
    });
  }
}
