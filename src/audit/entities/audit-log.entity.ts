import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from "typeorm";

@Entity("audit_logs")
export class AuditLog {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;

  @Column()
  action: string;

  @Column({ name: "actor_id", type: "text", nullable: true })
  actorId?: string;

  @Column({ name: "actor_type", nullable: true })
  actorType?: string;

  @Column({ name: "resource_type", nullable: true })
  resourceType?: string;

  @Column({ name: "resource_id", nullable: true })
  resourceId?: string;

  @Column({ type: "jsonb", nullable: true })
  metadata?: Record<string, unknown>;

  @Column({ name: "before_state", type: "jsonb", nullable: true })
  beforeState?: Record<string, unknown>;

  @Column({ name: "after_state", type: "jsonb", nullable: true })
  afterState?: Record<string, unknown>;

  @Column({ name: "organisation_id", nullable: true })
  @Index()
  organisationId?: string;

  @Column({ name: "project_id", nullable: true })
  @Index()
  projectId?: string;
}
