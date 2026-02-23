jest.mock("@thallesp/nestjs-better-auth", () => ({
  AllowAnonymous: () => () => {},
}));

import { BadRequestException } from "@nestjs/common";
import { InvitationsController } from "./invitations.controller";
import { OrganisationInvitationStatus } from "../enums/organisation-invitation-status.enum";
import { OrganisationInvitation } from "../entities/organisation-invitation.entity";

describe("InvitationsController", () => {
  const invite: OrganisationInvitation = {
    id: "invite-id",
    organisationId: "org-id",
    organisation: {
      id: "org-id",
      name: "Org",
      createdAt: new Date(),
      updatedAt: new Date(),
      users: [],
      projects: [],
    },
    email: "user@example.com",
    role: null,
    roleId: null,
    tokenHash: "hash",
    status: OrganisationInvitationStatus.PENDING,
    expiresAt: new Date(Date.now() + 1000 * 60 * 60),
    invitedBy: "admin-id",
    createdAt: new Date(),
    acceptedAt: null,
  } as OrganisationInvitation;

  const service = {
    checkInvite: jest.fn(),
  };
  const controller = new InvitationsController(service as any);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("throws when token is missing", async () => {
    await expect(
      controller.checkInvite("", "user@example.com"),
    ).rejects.toThrow(BadRequestException);
  });

  it("throws when email is missing", async () => {
    await expect(controller.checkInvite("token")).rejects.toThrow(
      BadRequestException,
    );
  });

  it("returns invite info when valid", async () => {
    service.checkInvite.mockResolvedValue({ valid: true, invite });

    const response = await controller.checkInvite("token", "user@example.com");

    expect(response.valid).toBe(true);
    expect(response.invite).toBeDefined();
    expect(response.invite?.email).toBe("user@example.com");
  });

  it("returns reason when invalid", async () => {
    service.checkInvite.mockResolvedValue({ valid: false, reason: "expired" });

    const response = await controller.checkInvite("token", "user@example.com");

    expect(response.valid).toBe(false);
    expect(response.reason).toBe("expired");
  });
});
