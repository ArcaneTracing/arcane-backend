import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from "typeorm";
import { Organisation } from "./organisation.entity";
import { Role } from "../../rbac/entities/role.entity";
import { OrganisationInvitationStatus } from "../enums/organisation-invitation-status.enum";

@Entity("organisation_invitations")
export class OrganisationInvitation {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @ManyToOne(() => Organisation, { onDelete: "CASCADE" })
  @JoinColumn({ name: "organisation_id" })
  organisation: Organisation;

  @Column({ name: "organisation_id" })
  organisationId: string;

  @Column()
  email: string;

  @ManyToOne(() => Role, { onDelete: "SET NULL", nullable: true })
  @JoinColumn({ name: "role_id" })
  role: Role | null;

  @Column({ name: "role_id", nullable: true })
  roleId: string | null;

  @Column({ name: "token_hash" })
  tokenHash: string;

  @Column({
    type: "enum",
    enum: OrganisationInvitationStatus,
    default: OrganisationInvitationStatus.PENDING,
  })
  status: OrganisationInvitationStatus;

  @Column({ name: "expires_at", type: "timestamp" })
  expiresAt: Date;

  @Column({ name: "invited_by" })
  invitedBy: string;

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;

  @Column({ name: "accepted_at", type: "timestamp", nullable: true })
  acceptedAt: Date | null;
}
