import { Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { randomBytes, createHash } from "node:crypto";
import { OrganisationInvitation } from "../entities/organisation-invitation.entity";
import { OrganisationInvitationStatus } from "../enums/organisation-invitation-status.enum";

export type InviteCheckReason =
  | "expired"
  | "revoked"
  | "not_found"
  | "accepted";

export type InviteCheckResult = {
  valid: boolean;
  reason?: InviteCheckReason;
  invite?: OrganisationInvitation;
};

@Injectable()
export class OrganisationInvitationService {
  private readonly logger = new Logger(OrganisationInvitationService.name);
  private readonly INVITE_TTL_DAYS = 7;

  constructor(
    @InjectRepository(OrganisationInvitation)
    private readonly invitationRepository: Repository<OrganisationInvitation>,
  ) {}

  private normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }

  private generateToken(): { rawToken: string; tokenHash: string } {
    const rawToken = randomBytes(32).toString("hex");
    const tokenHash = createHash("sha256").update(rawToken).digest("hex");
    return { rawToken, tokenHash };
  }

  private getExpiryDate(): Date {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + this.INVITE_TTL_DAYS);
    return expiresAt;
  }

  async createInvite(
    organisationId: string,
    email: string,
    invitedBy: string,
    roleId?: string,
  ): Promise<{
    invite: OrganisationInvitation;
    token: string;
    isResend: boolean;
  }> {
    const normalizedEmail = this.normalizeEmail(email);
    const now = new Date();

    const existingPending = await this.invitationRepository.findOne({
      where: {
        organisationId,
        email: normalizedEmail,
        status: OrganisationInvitationStatus.PENDING,
      },
    });

    if (existingPending && existingPending.expiresAt < now) {
      existingPending.status = OrganisationInvitationStatus.EXPIRED;
      await this.invitationRepository.save(existingPending);
    }

    if (existingPending && existingPending.expiresAt >= now) {
      const { rawToken, tokenHash } = this.generateToken();
      existingPending.tokenHash = tokenHash;
      existingPending.expiresAt = this.getExpiryDate();
      existingPending.invitedBy = invitedBy;
      existingPending.roleId = roleId || null;
      const updated = await this.invitationRepository.save(existingPending);
      return { invite: updated, token: rawToken, isResend: true };
    }

    const { rawToken, tokenHash } = this.generateToken();
    const invite = this.invitationRepository.create({
      organisationId,
      email: normalizedEmail,
      tokenHash,
      status: OrganisationInvitationStatus.PENDING,
      invitedBy,
      roleId: roleId || null,
      expiresAt: this.getExpiryDate(),
    });

    const saved = await this.invitationRepository.save(invite);
    return { invite: saved, token: rawToken, isResend: false };
  }

  async checkInvite(token: string, email?: string): Promise<InviteCheckResult> {
    const tokenHash = createHash("sha256").update(token).digest("hex");
    const invite = await this.invitationRepository.findOne({
      where: { tokenHash },
      relations: ["organisation"],
    });

    if (!invite) {
      return { valid: false, reason: "not_found" };
    }

    if (email && this.normalizeEmail(email) !== invite.email) {
      return { valid: false, reason: "not_found" };
    }

    if (invite.status === OrganisationInvitationStatus.ACCEPTED) {
      return { valid: false, reason: "accepted" };
    }

    if (invite.status === OrganisationInvitationStatus.REVOKED) {
      return { valid: false, reason: "revoked" };
    }

    const now = new Date();
    if (invite.expiresAt < now) {
      invite.status = OrganisationInvitationStatus.EXPIRED;
      await this.invitationRepository.save(invite);
      return { valid: false, reason: "expired" };
    }

    if (invite.status !== OrganisationInvitationStatus.PENDING) {
      return { valid: false, reason: "not_found" };
    }

    return { valid: true, invite };
  }

  async findPendingByEmail(
    email: string,
    organisationId?: string,
  ): Promise<OrganisationInvitation | null> {
    const normalizedEmail = this.normalizeEmail(email);
    const whereClause = organisationId
      ? {
          organisationId,
          email: normalizedEmail,
          status: OrganisationInvitationStatus.PENDING,
        }
      : {
          email: normalizedEmail,
          status: OrganisationInvitationStatus.PENDING,
        };
    const invite = await this.invitationRepository.findOne({
      where: whereClause,
      order: { createdAt: "DESC" },
    });

    if (!invite) {
      return null;
    }

    const now = new Date();
    if (invite.expiresAt < now) {
      invite.status = OrganisationInvitationStatus.EXPIRED;
      await this.invitationRepository.save(invite);
      return null;
    }

    return invite;
  }

  async consumeInvite(invite: OrganisationInvitation): Promise<void> {
    invite.status = OrganisationInvitationStatus.ACCEPTED;
    invite.acceptedAt = new Date();
    await this.invitationRepository.save(invite);
  }
}
