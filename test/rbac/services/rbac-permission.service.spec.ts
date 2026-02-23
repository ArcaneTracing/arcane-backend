import { Test, TestingModule } from "@nestjs/testing";
import { ForbiddenException } from "@nestjs/common";
import { RbacPermissionService } from "../../../src/rbac/services/rbac-permission.service";
import { RbacService } from "../../../src/rbac/services/rbac.service";
import { RbacMembershipService } from "../../../src/rbac/services/rbac-membership.service";
import { LicenseService } from "../../../src/license/license.service";
import { Role } from "../../../src/rbac/entities/role.entity";
import { INSTANCE_PERMISSIONS } from "../../../src/rbac/permissions/permissions";
import {
  ERROR_MESSAGES,
  formatError,
} from "../../../src/common/constants/error-messages.constants";

describe("RbacPermissionService", () => {
  let service: RbacPermissionService;
  let rbacService: RbacService;
  let membershipService: RbacMembershipService;
  let licenseService: LicenseService;

  const mockLicenseService = {
    isEnterpriseLicensed: jest.fn(),
  };

  const mockRbacService = {
    getUserRoles: jest.fn(),
    getUserInstanceRole: jest.fn(),
    getUserOrganisationRole: jest.fn(),
    getUserProjectRole: jest.fn(),
    getUserProjectRolesForOrganisation: jest.fn(),
  };

  const mockMembershipService = {
    getUserOrganisationIds: jest.fn(),
    getUserProjectIds: jest.fn(),
  };

  const createMockRole = (overrides: Partial<Role> = {}): Role =>
    ({
      id: "role-1",
      name: "Member",
      permissions: ["projects:read"],
      isSystemRole: true,
      isInstanceLevel: false,
      organisationId: "org-1",
      projectId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      get scope() {
        return "organisation" as any;
      },
      ...overrides,
    }) as Role;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RbacPermissionService,
        {
          provide: RbacService,
          useValue: mockRbacService,
        },
        {
          provide: RbacMembershipService,
          useValue: mockMembershipService,
        },
        {
          provide: LicenseService,
          useValue: mockLicenseService,
        },
      ],
    }).compile();

    service = module.get<RbacPermissionService>(RbacPermissionService);
    licenseService = module.get<LicenseService>(LicenseService);
    rbacService = module.get<RbacService>(RbacService);
    membershipService = module.get<RbacMembershipService>(
      RbacMembershipService,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("aggregatePermissions", () => {
    it("should return wildcard permission when role has ALL permission", () => {
      const role = createMockRole({
        permissions: [INSTANCE_PERMISSIONS.ALL],
        name: "Owner",
      });

      const result = service.aggregatePermissions([role]);

      expect(result).toEqual([INSTANCE_PERMISSIONS.ALL]);
    });

    it("should aggregate permissions from multiple roles", () => {
      const role1 = createMockRole({ permissions: ["projects:read"] });
      const role2 = createMockRole({
        permissions: ["projects:write"],
        id: "role-2",
      });

      const result = service.aggregatePermissions([role1, role2]);

      expect(result).toContain("projects:read");
      expect(result).toContain("projects:write");
      expect(result.length).toBe(2);
    });

    it("should deduplicate permissions", () => {
      const role1 = createMockRole({ permissions: ["projects:read"] });
      const role2 = createMockRole({
        permissions: ["projects:read"],
        id: "role-2",
      });

      const result = service.aggregatePermissions([role1, role2]);

      expect(result).toEqual(["projects:read"]);
    });

    it("should return empty array when no roles", () => {
      const result = service.aggregatePermissions([]);

      expect(result).toEqual([]);
    });

    it("should prioritize wildcard over other permissions", () => {
      const role1 = createMockRole({ permissions: ["projects:read"] });
      const role2 = createMockRole({
        permissions: [INSTANCE_PERMISSIONS.ALL],
        id: "role-2",
        name: "Owner",
      });

      const result = service.aggregatePermissions([role1, role2]);

      expect(result).toEqual([INSTANCE_PERMISSIONS.ALL]);
    });
  });

  describe("hasPermission", () => {
    it("should return true when wildcard permission exists", () => {
      const role = createMockRole({
        permissions: [INSTANCE_PERMISSIONS.ALL],
        name: "Owner",
      });

      const result = service.hasPermission([role], "projects:read");

      expect(result).toBe(true);
    });

    it("should return true when specific permission exists", () => {
      const role = createMockRole({ permissions: ["projects:read"] });

      const result = service.hasPermission([role], "projects:read");

      expect(result).toBe(true);
    });

    it("should return false when permission does not exist", () => {
      const role = createMockRole({ permissions: ["projects:read"] });

      const result = service.hasPermission([role], "projects:write");

      expect(result).toBe(false);
    });

    it("should return false when no roles", () => {
      const result = service.hasPermission([], "projects:read");

      expect(result).toBe(false);
    });
  });

  describe("hasPermissionForUser", () => {
    it("should check permission for user with roles", async () => {
      const role = createMockRole({ permissions: ["projects:read"] });
      mockRbacService.getUserRoles.mockResolvedValue([role]);

      mockRbacService.getUserProjectRolesForOrganisation.mockResolvedValue([]);

      const result = await service.hasPermissionForUser(
        "user-1",
        "projects:read",
        "org-1",
      );

      expect(mockRbacService.getUserRoles).toHaveBeenCalledWith(
        "user-1",
        "org-1",
        undefined,
      );
      expect(result).toBe(true);
    });

    it("should include project roles for org-level project permission check", async () => {
      const orgRole = createMockRole({ permissions: ["projects:read"] });
      const projectRole = createMockRole({
        permissions: ["projects:write"],
        id: "role-2",
        projectId: "project-1",
      });

      mockRbacService.getUserRoles.mockResolvedValue([orgRole]);
      mockRbacService.getUserProjectRolesForOrganisation.mockResolvedValue([
        projectRole,
      ]);

      const result = await service.hasPermissionForUser(
        "user-1",
        "projects:write",
        "org-1",
      );

      expect(mockRbacService.getUserRoles).toHaveBeenCalledWith(
        "user-1",
        "org-1",
        undefined,
      );
      expect(
        mockRbacService.getUserProjectRolesForOrganisation,
      ).toHaveBeenCalledWith("org-1", "user-1");

      expect(result).toBe(true);
    });

    it("should not include project roles when projectId is provided", async () => {
      const role = createMockRole({ permissions: ["projects:read"] });
      mockRbacService.getUserRoles.mockResolvedValue([role]);

      await service.hasPermissionForUser(
        "user-1",
        "projects:read",
        "org-1",
        "project-1",
      );

      expect(
        mockRbacService.getUserProjectRolesForOrganisation,
      ).not.toHaveBeenCalled();
    });

    it("should include project roles for org-level traces:read check (project-scoped permission)", async () => {
      const orgRole = createMockRole({ permissions: ["organisations:read"] });
      const projectRole = createMockRole({
        permissions: ["traces:read", "datasources:read"],
        id: "role-2",
        projectId: "project-1",
      });
      mockRbacService.getUserRoles.mockResolvedValue([orgRole]);
      mockRbacService.getUserProjectRolesForOrganisation.mockResolvedValue([
        projectRole,
      ]);

      const result = await service.hasPermissionForUser(
        "user-1",
        "traces:read",
        "org-1",
      );

      expect(
        mockRbacService.getUserProjectRolesForOrganisation,
      ).toHaveBeenCalledWith("org-1", "user-1");
      expect(result).toBe(true);
    });
  });

  describe("checkPermission", () => {
    it("should return void when user has permission", async () => {
      const role = createMockRole({ permissions: ["projects:read"] });
      mockRbacService.getUserRoles.mockResolvedValue([role]);

      await expect(
        service.checkPermission("user-1", "projects:read", "org-1"),
      ).resolves.toBeUndefined();
    });

    it("should throw ForbiddenException when user does not have permission", async () => {
      mockRbacService.getUserRoles.mockResolvedValue([]);

      await expect(
        service.checkPermission("user-1", "projects:read", "org-1"),
      ).rejects.toThrow(ForbiddenException);
      await expect(
        service.checkPermission("user-1", "projects:read", "org-1"),
      ).rejects.toThrow(
        formatError(
          ERROR_MESSAGES.USER_DOES_NOT_HAVE_PERMISSION,
          "projects:read",
        ),
      );
    });
  });

  describe("getUserPermissions", () => {
    it("should return aggregated permissions for user", async () => {
      const role = createMockRole({
        permissions: ["projects:read", "projects:write"],
      });
      mockRbacService.getUserRoles.mockResolvedValue([role]);

      const result = await service.getUserPermissions("user-1", "org-1");

      expect(mockRbacService.getUserRoles).toHaveBeenCalledWith(
        "user-1",
        "org-1",
        undefined,
      );
      expect(result).toContain("projects:read");
      expect(result).toContain("projects:write");
    });
  });

  describe("getPermissionsWithContext", () => {
    it("should separate permissions by scope", () => {
      const instanceRole = createMockRole({
        permissions: ["*"],
        isInstanceLevel: true,
        organisationId: null,
        projectId: null,
      });
      const orgRole = createMockRole({
        permissions: ["organisations:read"],
        organisationId: "org-1",
        projectId: null,
        id: "role-2",
      });
      const projectRole = createMockRole({
        permissions: ["projects:read"],
        projectId: "project-1",
        id: "role-3",
      });

      const result = service.getPermissionsWithContext(
        [instanceRole, orgRole, projectRole],
        "org-1",
        "project-1",
      );

      expect(result.instance).toEqual(["*"]);
      expect(result.organisation).toEqual(["organisations:read"]);
      expect(result.project).toEqual(["projects:read"]);
      expect(result.all).toContain("*");
    });

    it("should return empty arrays when no roles match scope", () => {
      const result = service.getPermissionsWithContext(
        [],
        "org-1",
        "project-1",
      );

      expect(result.instance).toEqual([]);
      expect(result.organisation).toEqual([]);
      expect(result.project).toEqual([]);
      expect(result.all).toEqual([]);
    });
  });

  describe("getUserPermissionsWithContext", () => {
    beforeEach(() => {
      mockLicenseService.isEnterpriseLicensed.mockReturnValue(true);
    });

    it("should return permissions grouped by context", async () => {
      const instanceRole = createMockRole({
        permissions: ["*"],
        isInstanceLevel: true,
        organisationId: null,
        projectId: null,
      });
      mockRbacService.getUserRoles.mockResolvedValue([instanceRole]);

      const result = await service.getUserPermissionsWithContext(
        "user-1",
        "org-1",
        "project-1",
      );

      expect(result.instance).toEqual(["*"]);
      expect(result.all).toContain("*");
      expect(result.features).toEqual({ enterprise: true });
    });

    it("should include features.enterprise from LicenseService", async () => {
      mockRbacService.getUserRoles.mockResolvedValue([]);
      mockLicenseService.isEnterpriseLicensed.mockReturnValue(true);

      const result = await service.getUserPermissionsWithContext(
        "user-1",
        "org-1",
      );

      expect(result.features).toEqual({ enterprise: true });
    });

    it("should include features.enterprise false when license is invalid", async () => {
      mockRbacService.getUserRoles.mockResolvedValue([]);
      mockLicenseService.isEnterpriseLicensed.mockReturnValue(false);

      const result = await service.getUserPermissionsWithContext(
        "user-1",
        "org-1",
      );

      expect(result.features).toEqual({ enterprise: false });
    });

    it("should include project roles for org-level call so all includes projects:read", async () => {
      const orgRole = createMockRole({
        permissions: ["organisations:read"],
        organisationId: "org-1",
        projectId: null,
      });
      const projectRole = createMockRole({
        permissions: ["projects:read", "traces:read"],
        organisationId: "org-1",
        projectId: "project-1",
      });

      mockRbacService.getUserRoles.mockResolvedValue([orgRole]);
      mockRbacService.getUserProjectRolesForOrganisation.mockResolvedValue([
        projectRole,
      ]);

      const result = await service.getUserPermissionsWithContext(
        "user-1",
        "org-1",
        undefined,
      );

      expect(result.all).toContain("projects:read");
      expect(result.all).toContain("traces:read");
      expect(result.all).toContain("organisations:read");
      expect(
        mockRbacService.getUserProjectRolesForOrganisation,
      ).toHaveBeenCalledWith("org-1", "user-1");
    });
  });

  describe("getAllUserPermissions", () => {
    it("should return all permissions grouped by scope", async () => {
      const instanceRole = createMockRole({
        permissions: ["*"],
        isInstanceLevel: true,
        organisationId: null,
        projectId: null,
      });
      const orgRole = createMockRole({
        permissions: ["organisations:read"],
        organisationId: "org-1",
        projectId: null,
        id: "role-2",
      });
      const projectRole = createMockRole({
        permissions: ["projects:read"],
        projectId: "project-1",
        id: "role-3",
      });

      mockRbacService.getUserInstanceRole.mockResolvedValue(instanceRole);
      mockMembershipService.getUserOrganisationIds.mockResolvedValue(["org-1"]);
      mockRbacService.getUserOrganisationRole.mockResolvedValue(orgRole);
      mockMembershipService.getUserProjectIds.mockResolvedValue(["project-1"]);
      mockRbacService.getUserProjectRole.mockResolvedValue(projectRole);

      const result = await service.getAllUserPermissions("user-1");

      expect(result.instance).toEqual(["*"]);
      expect(result.organisations["org-1"]).toEqual(["organisations:read"]);
      expect(result.projects["project-1"]).toEqual(["projects:read"]);
    });

    it("should handle user with no roles", async () => {
      mockRbacService.getUserInstanceRole.mockResolvedValue(null);
      mockMembershipService.getUserOrganisationIds.mockResolvedValue([]);
      mockMembershipService.getUserProjectIds.mockResolvedValue([]);

      const result = await service.getAllUserPermissions("user-1");

      expect(result.instance).toEqual([]);
      expect(result.organisations).toEqual({});
      expect(result.projects).toEqual({});
    });
  });
});
