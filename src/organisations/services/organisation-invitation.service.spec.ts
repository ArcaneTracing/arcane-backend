import { OrganisationInvitationService } from "./organisation-invitation.service";
import { OrganisationInvitationStatus } from "../enums/organisation-invitation-status.enum";
import { OrganisationInvitation } from "../entities/organisation-invitation.entity";

const createInvite = (
  overrides: Partial<OrganisationInvitation> = {},
): OrganisationInvitation => {
  return {
    id: "invite-id",
    organisationId: "org-id",
    organisation: undefined,
    email: "user@example.com",
    roleId: null,
    role: null,
    tokenHash: "hash",
    status: OrganisationInvitationStatus.PENDING,
    expiresAt: new Date(Date.now() + 1000 * 60 * 60),
    invitedBy: "inviter-id",
    createdAt: new Date(),
    acceptedAt: null,
    ...overrides,
  } as OrganisationInvitation;
};

describe("OrganisationInvitationService", () => {
  it("returns not_found when token is unknown", async () => {
    const repo = {
      findOne: jest.fn().mockResolvedValue(null),
    };
    const service = new OrganisationInvitationService(repo as any);

    const result = await service.checkInvite("missing");

    expect(result.valid).toBe(false);
    expect(result.reason).toBe("not_found");
  });

  it("marks expired invites and returns expired reason", async () => {
    const expiredInvite = createInvite({
      expiresAt: new Date(Date.now() - 1000),
    });
    const repo = {
      findOne: jest.fn().mockResolvedValue(expiredInvite),
      save: jest.fn().mockResolvedValue(expiredInvite),
    };
    const service = new OrganisationInvitationService(repo as any);

    const result = await service.checkInvite("token");

    expect(result.valid).toBe(false);
    expect(result.reason).toBe("expired");
    expect(expiredInvite.status).toBe(OrganisationInvitationStatus.EXPIRED);
    expect(repo.save).toHaveBeenCalled();
  });

  it("returns null for expired pending invite by email", async () => {
    const expiredInvite = createInvite({
      expiresAt: new Date(Date.now() - 1000),
    });
    const repo = {
      findOne: jest.fn().mockResolvedValue(expiredInvite),
      save: jest.fn().mockResolvedValue(expiredInvite),
    };
    const service = new OrganisationInvitationService(repo as any);

    const result = await service.findPendingByEmail("user@example.com");

    expect(result).toBeNull();
    expect(expiredInvite.status).toBe(OrganisationInvitationStatus.EXPIRED);
    expect(repo.save).toHaveBeenCalled();
  });

  it("resends when pending invite already exists", async () => {
    const pendingInvite = createInvite();
    const repo = {
      findOne: jest.fn().mockResolvedValue(pendingInvite),
      save: jest.fn().mockResolvedValue(pendingInvite),
    };
    const service = new OrganisationInvitationService(repo as any);

    const result = await service.createInvite(
      "org-id",
      "user@example.com",
      "inviter-id",
    );

    expect(result.isResend).toBe(true);
    expect(repo.save).toHaveBeenCalled();
  });
});
