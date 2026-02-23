import { Test, TestingModule } from "@nestjs/testing";
import { RbacService } from "../../../src/rbac/services/rbac.service";
import { RoleRetrievalService } from "../../../src/rbac/services/role-retrieval.service";
import { DefaultRoleService } from "../../../src/rbac/services/default-role.service";
import { UserOnboardingService } from "../../../src/rbac/services/user-onboarding.service";
import { Role } from "../../../src/rbac/entities/role.entity";

describe("RbacService", () => {
  let service: RbacService;
  let roleRetrievalService: RoleRetrievalService;
  let defaultRoleService: DefaultRoleService;
  let userOnboardingService: UserOnboardingService;

  const mockRoleRetrievalService = {
    getUserRoles: jest.fn(),
    getUserInstanceRole: jest.fn(),
    getUserOrganisationRole: jest.fn(),
    getUserProjectRole: jest.fn(),
    getUserProjectRoles: jest.fn(),
    getUserProjectRolesForOrganisation: jest.fn(),
  };

  const mockDefaultRoleService = {
    getDefaultProjectRole: jest.fn(),
    getDefaultOrganisationRole: jest.fn(),
    getOwnerRoleId: jest.fn(),
  };

  const mockUserOnboardingService = {
    isFirstUser: jest.fn(),
  };

  const mockRole: Role = {
    id: "role-1",
    name: "Member",
    permissions: [],
    isSystemRole: true,
    isInstanceLevel: false,
    organisationId: "org-1",
    projectId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    get scope() {
      return "organisation" as any;
    },
  } as Role;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RbacService,
        {
          provide: RoleRetrievalService,
          useValue: mockRoleRetrievalService,
        },
        {
          provide: DefaultRoleService,
          useValue: mockDefaultRoleService,
        },
        {
          provide: UserOnboardingService,
          useValue: mockUserOnboardingService,
        },
      ],
    }).compile();

    service = module.get<RbacService>(RbacService);
    roleRetrievalService =
      module.get<RoleRetrievalService>(RoleRetrievalService);
    defaultRoleService = module.get<DefaultRoleService>(DefaultRoleService);
    userOnboardingService = module.get<UserOnboardingService>(
      UserOnboardingService,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("getUserRoles", () => {
    it("should delegate to RoleRetrievalService", async () => {
      const roles = [mockRole];
      mockRoleRetrievalService.getUserRoles.mockResolvedValue(roles);

      const result = await service.getUserRoles("user-1", "org-1", "project-1");

      expect(mockRoleRetrievalService.getUserRoles).toHaveBeenCalledWith(
        "user-1",
        "org-1",
        "project-1",
      );
      expect(result).toEqual(roles);
    });

    it("should delegate without optional parameters", async () => {
      const roles = [mockRole];
      mockRoleRetrievalService.getUserRoles.mockResolvedValue(roles);

      const result = await service.getUserRoles("user-1");

      expect(mockRoleRetrievalService.getUserRoles).toHaveBeenCalledWith(
        "user-1",
        undefined,
        undefined,
      );
      expect(result).toEqual(roles);
    });
  });

  describe("getUserInstanceRole", () => {
    it("should delegate to RoleRetrievalService", async () => {
      mockRoleRetrievalService.getUserInstanceRole.mockResolvedValue(mockRole);

      const result = await service.getUserInstanceRole("user-1");

      expect(mockRoleRetrievalService.getUserInstanceRole).toHaveBeenCalledWith(
        "user-1",
      );
      expect(result).toEqual(mockRole);
    });

    it("should return null when no instance role", async () => {
      mockRoleRetrievalService.getUserInstanceRole.mockResolvedValue(null);

      const result = await service.getUserInstanceRole("user-1");

      expect(result).toBeNull();
    });
  });

  describe("getUserOrganisationRole", () => {
    it("should delegate to RoleRetrievalService", async () => {
      mockRoleRetrievalService.getUserOrganisationRole.mockResolvedValue(
        mockRole,
      );

      const result = await service.getUserOrganisationRole("org-1", "user-1");

      expect(
        mockRoleRetrievalService.getUserOrganisationRole,
      ).toHaveBeenCalledWith("org-1", "user-1");
      expect(result).toEqual(mockRole);
    });
  });

  describe("getUserProjectRole", () => {
    it("should delegate to RoleRetrievalService", async () => {
      mockRoleRetrievalService.getUserProjectRole.mockResolvedValue(mockRole);

      const result = await service.getUserProjectRole("project-1", "user-1");

      expect(mockRoleRetrievalService.getUserProjectRole).toHaveBeenCalledWith(
        "project-1",
        "user-1",
      );
      expect(result).toEqual(mockRole);
    });
  });

  describe("getUserProjectRoles", () => {
    it("should delegate to RoleRetrievalService", async () => {
      const roles = [mockRole];
      mockRoleRetrievalService.getUserProjectRoles.mockResolvedValue(roles);

      const result = await service.getUserProjectRoles("project-1", "user-1");

      expect(mockRoleRetrievalService.getUserProjectRoles).toHaveBeenCalledWith(
        "project-1",
        "user-1",
      );
      expect(result).toEqual(roles);
    });
  });

  describe("getUserProjectRolesForOrganisation", () => {
    it("should delegate to RoleRetrievalService", async () => {
      const roles = [mockRole];
      mockRoleRetrievalService.getUserProjectRolesForOrganisation.mockResolvedValue(
        roles,
      );

      const result = await service.getUserProjectRolesForOrganisation(
        "org-1",
        "user-1",
      );

      expect(
        mockRoleRetrievalService.getUserProjectRolesForOrganisation,
      ).toHaveBeenCalledWith("org-1", "user-1");
      expect(result).toEqual(roles);
    });
  });

  describe("getDefaultProjectRole", () => {
    it("should delegate to DefaultRoleService", async () => {
      mockDefaultRoleService.getDefaultProjectRole.mockResolvedValue(mockRole);

      const result = await service.getDefaultProjectRole("org-1", "project-1");

      expect(mockDefaultRoleService.getDefaultProjectRole).toHaveBeenCalledWith(
        "org-1",
        "project-1",
      );
      expect(result).toEqual(mockRole);
    });
  });

  describe("getDefaultOrganisationRole", () => {
    it("should delegate to DefaultRoleService", async () => {
      mockDefaultRoleService.getDefaultOrganisationRole.mockResolvedValue(
        mockRole,
      );

      const result = await service.getDefaultOrganisationRole("org-1");

      expect(
        mockDefaultRoleService.getDefaultOrganisationRole,
      ).toHaveBeenCalledWith("org-1");
      expect(result).toEqual(mockRole);
    });
  });

  describe("getOwnerRoleId", () => {
    it("should delegate to DefaultRoleService", async () => {
      mockDefaultRoleService.getOwnerRoleId.mockResolvedValue("role-owner");

      const result = await service.getOwnerRoleId();

      expect(mockDefaultRoleService.getOwnerRoleId).toHaveBeenCalled();
      expect(result).toBe("role-owner");
    });

    it("should return null when no owner role", async () => {
      mockDefaultRoleService.getOwnerRoleId.mockResolvedValue(null);

      const result = await service.getOwnerRoleId();

      expect(result).toBeNull();
    });
  });

  describe("isFirstUser", () => {
    it("should delegate to UserOnboardingService", async () => {
      mockUserOnboardingService.isFirstUser.mockResolvedValue(true);

      const result = await service.isFirstUser();

      expect(mockUserOnboardingService.isFirstUser).toHaveBeenCalled();
      expect(result).toBe(true);
    });

    it("should return false when not first user", async () => {
      mockUserOnboardingService.isFirstUser.mockResolvedValue(false);

      const result = await service.isFirstUser();

      expect(result).toBe(false);
    });
  });
});
