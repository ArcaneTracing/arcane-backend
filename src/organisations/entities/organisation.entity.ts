import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  ManyToMany,
  JoinTable,
} from "typeorm";
import { Project } from "../../projects/entities/project.entity";
import { BetterAuthUser } from "../../auth/entities/user.entity";

@Entity("organisations")
export class Organisation {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column()
  name: string;

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt: Date;

  @ManyToMany(() => BetterAuthUser, (user) => user.organisations)
  @JoinTable({
    name: "organisation_users",
    joinColumn: { name: "organisation_id", referencedColumnName: "id" },
    inverseJoinColumn: { name: "user_id", referencedColumnName: "id" },
  })
  users: BetterAuthUser[];

  @OneToMany(() => Project, (project) => project.organisation)
  projects: Project[];

  @Column({ name: "audit_log_retention_days", nullable: true })
  auditLogRetentionDays?: number | null;
}
