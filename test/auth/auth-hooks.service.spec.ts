jest.mock("@thallesp/nestjs-better-auth", () => ({
  Hook: () => (target: any) => target,
  AfterHook: () => (target: any, propertyKey?: string, descriptor?: any) => {},
  AuthHookContext: class AuthHookContext {},
}));

import { BadRequestException } from "@nestjs/common";
import { RbacService } from "../../src/rbac/services/rbac.service";
import { RbacAssignmentService } from "../../src/rbac/services/rbac-assignment.service";
import { OrganisationInvitationService } from "src/organisations/services/organisation-invitation.service";
import { OrganisationsService } from "src/organisations/services/organisations.service";
import { UserCreatedHook } from "src/auth/services/auth-hooks.service";
import { BetterAuthUserService } from "src/auth/services/better-auth-user.service";

describe("UserCreatedHook", () => {
  let hook: UserCreatedHook;
  let rbacService: RbacService;
  let assignmentService: RbacAssignmentService;
  let betterAuthUserService: BetterAuthUserService;
  let invitationService: OrganisationInvitationService;
  let organisationsService: OrganisationsService;

  const mockRbacService = {
    isFirstUser: jest.fn(),
    getOwnerRoleId: jest.fn(),
  };

  const mockAssignmentService = {
    assignRole: jest.fn(),
  };

  const mockBetterAuthUserService = {
    getUserIdByEmail: jest.fn(),
  };

  const mockInvitationService = {
    findPendingByEmail: jest.fn(),
    consumeInvite: jest.fn(),
  };

  const mockOrganisationsService = {
    addUserById: jest.fn(),
  };

  beforeEach(() => {
    hook = new UserCreatedHook(
      mockRbacService as any,
      mockAssignmentService as any,
      mockBetterAuthUserService as any,
      mockInvitationService as any,
      mockOrganisationsService as any,
    );
    rbacService = mockRbacService as any;
    assignmentService = mockAssignmentService as any;
    betterAuthUserService = mockBetterAuthUserService as any;
    invitationService = mockInvitationService as any;
    organisationsService = mockOrganisationsService as any;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("should assign owner role to first user when user exists in context", async () => {
    mockRbacService.isFirstUser.mockResolvedValue(true);
    mockRbacService.getOwnerRoleId.mockResolvedValue("role-1");

    const ctx = {
      returned: { user: { id: "user-1", email: "user@test.com" } },
    };

    await hook.onUserCreated(ctx as any);

    expect(rbacService.isFirstUser).toHaveBeenCalled();
    expect(rbacService.getOwnerRoleId).toHaveBeenCalled();
    expect(assignmentService.assignRole).toHaveBeenCalledWith(
      "user-1",
      "role-1",
    );
    expect(betterAuthUserService.getUserIdByEmail).not.toHaveBeenCalled();
  });

  it("should query by email when user missing and assign owner role", async () => {
    mockRbacService.isFirstUser.mockResolvedValue(true);
    mockRbacService.getOwnerRoleId.mockResolvedValue("role-1");
    mockBetterAuthUserService.getUserIdByEmail.mockResolvedValue("user-2");

    const ctx = { input: { email: "user2@test.com" } };

    await hook.onUserCreated(ctx as any);

    expect(betterAuthUserService.getUserIdByEmail).toHaveBeenCalledWith(
      "user2@test.com",
    );
    expect(assignmentService.assignRole).toHaveBeenCalledWith(
      "user-2",
      "role-1",
    );
  });

  it("should add invited user when not first user", async () => {
    mockRbacService.isFirstUser.mockResolvedValue(false);
    const invite = { organisationId: "org-1", roleId: "role-1" };
    mockInvitationService.findPendingByEmail.mockResolvedValue(invite);

    const ctx = {
      returned: { user: { id: "user-1", email: "user@test.com" } },
    };

    await hook.onUserCreated(ctx as any);

    expect(mockInvitationService.findPendingByEmail).toHaveBeenCalledWith(
      "user@test.com",
    );
    expect(organisationsService.addUserById).toHaveBeenCalledWith(
      "org-1",
      "user-1",
      "role-1",
    );
    expect(invitationService.consumeInvite).toHaveBeenCalledWith(invite);
    expect(rbacService.getOwnerRoleId).not.toHaveBeenCalled();
    expect(assignmentService.assignRole).not.toHaveBeenCalled();
  });

  it("should reject when invitation missing for non-first user", async () => {
    mockRbacService.isFirstUser.mockResolvedValue(false);
    mockInvitationService.findPendingByEmail.mockResolvedValue(null);

    const ctx = {
      returned: { user: { id: "user-1", email: "missing@test.com" } },
    };

    await expect(hook.onUserCreated(ctx as any)).rejects.toThrow(
      BadRequestException,
    );

    expect(mockInvitationService.findPendingByEmail).toHaveBeenCalledWith(
      "missing@test.com",
    );
    expect(invitationService.consumeInvite).not.toHaveBeenCalled();
    expect(organisationsService.addUserById).not.toHaveBeenCalled();
  });

  it("should skip when no user and no email", async () => {
    mockRbacService.isFirstUser.mockResolvedValue(true);

    const ctx = { returned: {} };

    await hook.onUserCreated(ctx as any);

    expect(betterAuthUserService.getUserIdByEmail).not.toHaveBeenCalled();
    expect(assignmentService.assignRole).not.toHaveBeenCalled();
  });
});
