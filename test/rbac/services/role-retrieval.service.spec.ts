import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { CACHE_MANAGER } from "@nestjs/cache-manager";
import { Repository } from "typeorm";
import { RoleRetrievalService } from "../../../src/rbac/services/role-retrieval.service";
import { UserRole } from "../../../src/rbac/entities/user-role.entity";
import { Role } from "../../../src/rbac/entities/role.entity";

describe("RoleRetrievalService", () => {
  let service: RoleRetrievalService;
  let userRoleRepository: Repository<UserRole>;
  let cacheManager: any;

  const mockUserRoleRepository = {
    find: jest.fn(),
  };

  const mockCacheManager = {
    get: jest.fn(),
    set: jest.fn(),
  };

  const mockInstanceRole = {
    id: "role-instance",
    name: "Owner",
    permissions: ["*"],
    isSystemRole: true,
    isInstanceLevel: true,
    organisationId: null,
    projectId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    get scope() {
      return "instance" as any;
    },
  } as Role;

  const mockOrgRole = {
    id: "role-org",
    name: "Organisation Admin",
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

  const mockProjectRole = {
    id: "role-project",
    name: "Member",
    permissions: [],
    isSystemRole: true,
    isInstanceLevel: false,
    organisationId: "org-1",
    projectId: "project-1",
    createdAt: new Date(),
    updatedAt: new Date(),
    get scope() {
      return "project" as any;
    },
  } as Role;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RoleRetrievalService,
        {
          provide: getRepositoryToken(UserRole),
          useValue: mockUserRoleRepository,
        },
        {
          provide: CACHE_MANAGER,
          useValue: mockCacheManager,
        },
      ],
    }).compile();

    service = module.get<RoleRetrievalService>(RoleRetrievalService);
    userRoleRepository = module.get<Repository<UserRole>>(
      getRepositoryToken(UserRole),
    );
    cacheManager = module.get(CACHE_MANAGER);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("getUserRoles", () => {
    it("should return cached roles when available", async () => {
      const cachedRoles = [mockInstanceRole];
      mockCacheManager.get.mockResolvedValue(cachedRoles);

      const result = await service.getUserRoles("user-1", "org-1", "project-1");

      expect(mockCacheManager.get).toHaveBeenCalledWith(
        "user:roles:user-1:org-1:project-1",
      );
      expect(result).toEqual(cachedRoles);
      expect(mockUserRoleRepository.find).not.toHaveBeenCalled();
    });

    it("should return instance role when present", async () => {
      mockCacheManager.get
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce(undefined);
      mockUserRoleRepository.find.mockResolvedValue([
        { userId: "user-1", role: mockInstanceRole },
      ]);
      mockCacheManager.set.mockResolvedValue(undefined);

      const result = await service.getUserRoles("user-1");

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(mockInstanceRole.id);
    });

    it("should return instance, org, and project roles in priority order", async () => {
      mockCacheManager.get
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce(undefined);

      mockUserRoleRepository.find
        .mockResolvedValueOnce([{ userId: "user-1", role: mockInstanceRole }])
        .mockResolvedValueOnce([{ userId: "user-1", role: mockOrgRole }])
        .mockResolvedValueOnce([{ userId: "user-1", role: mockProjectRole }]);
      mockCacheManager.set.mockResolvedValue(undefined);

      const result = await service.getUserRoles("user-1", "org-1", "project-1");

      expect(result).toHaveLength(3);
      expect(result[0].id).toBe(mockInstanceRole.id);
      expect(result[1].id).toBe(mockOrgRole.id);
      expect(result[2].id).toBe(mockProjectRole.id);
    });

    it("should return only org role when no instance role", async () => {
      mockCacheManager.get
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce(undefined);
      mockUserRoleRepository.find
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ userId: "user-1", role: mockOrgRole }]);
      mockCacheManager.set.mockResolvedValue(undefined);

      const result = await service.getUserRoles("user-1", "org-1");

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(mockOrgRole.id);
    });

    it("should return empty array when no roles found", async () => {
      mockCacheManager.get
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce(undefined);
      mockUserRoleRepository.find
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);
      mockCacheManager.set.mockResolvedValue(undefined);

      const result = await service.getUserRoles("user-1", "org-1", "project-1");

      expect(result).toEqual([]);
    });
  });

  describe("getUserInstanceRole", () => {
    it("should return cached instance role when available", async () => {
      mockCacheManager.get.mockResolvedValue(mockInstanceRole);

      const result = await service.getUserInstanceRole("user-1");

      expect(mockCacheManager.get).toHaveBeenCalledWith(
        "user:role:instance:user-1",
      );
      expect(result).toEqual(mockInstanceRole);
      expect(mockUserRoleRepository.find).not.toHaveBeenCalled();
    });

    it("should return instance role from database", async () => {
      mockCacheManager.get.mockResolvedValue(undefined);
      mockUserRoleRepository.find.mockResolvedValue([
        { userId: "user-1", role: mockInstanceRole },
      ]);
      mockCacheManager.set.mockResolvedValue(undefined);

      const result = await service.getUserInstanceRole("user-1");

      expect(mockCacheManager.get).toHaveBeenCalledWith(
        "user:role:instance:user-1",
      );
      expect(mockUserRoleRepository.find).toHaveBeenCalledWith({
        where: { userId: "user-1" },
        relations: ["role"],
      });
      expect(result).toEqual(mockInstanceRole);
      expect(mockCacheManager.set).toHaveBeenCalledWith(
        "user:role:instance:user-1",
        mockInstanceRole,
        3600,
      );
    });

    it("should return null when no instance role found", async () => {
      mockCacheManager.get.mockResolvedValue(undefined);
      mockUserRoleRepository.find.mockResolvedValue([
        { userId: "user-1", role: mockOrgRole },
      ]);
      mockCacheManager.set.mockResolvedValue(undefined);

      const result = await service.getUserInstanceRole("user-1");

      expect(result).toBeNull();
      expect(mockCacheManager.set).toHaveBeenCalledWith(
        "user:role:instance:user-1",
        null,
        3600,
      );
    });

    it("should cache null when no instance role", async () => {
      mockCacheManager.get.mockResolvedValue(undefined);
      mockUserRoleRepository.find.mockResolvedValue([]);
      mockCacheManager.set.mockResolvedValue(undefined);

      const result = await service.getUserInstanceRole("user-1");

      expect(result).toBeNull();
      expect(mockCacheManager.set).toHaveBeenCalledWith(
        "user:role:instance:user-1",
        null,
        3600,
      );
    });
  });

  describe("getUserOrganisationRole", () => {
    it("should return cached org role when available", async () => {
      mockCacheManager.get.mockResolvedValue(mockOrgRole);

      const result = await service.getUserOrganisationRole("org-1", "user-1");

      expect(mockCacheManager.get).toHaveBeenCalledWith(
        "user:role:org:org-1:user-1",
      );
      expect(result).toEqual(mockOrgRole);
    });

    it("should return org role from database", async () => {
      mockCacheManager.get.mockResolvedValue(undefined);
      mockUserRoleRepository.find.mockResolvedValue([
        { userId: "user-1", role: mockOrgRole },
      ]);
      mockCacheManager.set.mockResolvedValue(undefined);

      const result = await service.getUserOrganisationRole("org-1", "user-1");

      expect(mockCacheManager.get).toHaveBeenCalledWith(
        "user:role:org:org-1:user-1",
      );
      expect(mockUserRoleRepository.find).toHaveBeenCalledWith({
        where: { userId: "user-1" },
        relations: ["role"],
      });
      expect(result).toEqual(mockOrgRole);
      expect(mockCacheManager.set).toHaveBeenCalledWith(
        "user:role:org:org-1:user-1",
        mockOrgRole,
        3600,
      );
    });

    it("should return null when no org role for organisation", async () => {
      mockCacheManager.get.mockResolvedValue(undefined);
      mockUserRoleRepository.find.mockResolvedValue([
        { userId: "user-1", role: mockInstanceRole },
      ]);
      mockCacheManager.set.mockResolvedValue(undefined);

      const result = await service.getUserOrganisationRole("org-1", "user-1");

      expect(result).toBeNull();
    });

    it("should return null when org role is for different organisation", async () => {
      mockCacheManager.get.mockResolvedValue(undefined);
      const differentOrgRole = { ...mockOrgRole, organisationId: "org-2" };
      mockUserRoleRepository.find.mockResolvedValue([
        { userId: "user-1", role: differentOrgRole },
      ]);
      mockCacheManager.set.mockResolvedValue(undefined);

      const result = await service.getUserOrganisationRole("org-1", "user-1");

      expect(result).toBeNull();
    });
  });

  describe("getUserProjectRole", () => {
    it("should return cached project role when available", async () => {
      mockCacheManager.get.mockResolvedValue(mockProjectRole);

      const result = await service.getUserProjectRole("project-1", "user-1");

      expect(mockCacheManager.get).toHaveBeenCalledWith(
        "user:role:project:project-1:user-1",
      );
      expect(result).toEqual(mockProjectRole);
      expect(mockUserRoleRepository.find).not.toHaveBeenCalled();
    });

    it("should return project role from database", async () => {
      mockCacheManager.get.mockResolvedValue(undefined);
      mockUserRoleRepository.find.mockResolvedValue([
        { userId: "user-1", role: mockProjectRole },
      ]);
      mockCacheManager.set.mockResolvedValue(undefined);

      const result = await service.getUserProjectRole("project-1", "user-1");

      expect(mockCacheManager.get).toHaveBeenCalledWith(
        "user:role:project:project-1:user-1",
      );
      expect(mockUserRoleRepository.find).toHaveBeenCalledWith({
        where: { userId: "user-1" },
        relations: ["role"],
      });
      expect(result).not.toBeNull();
      expect(result?.id).toBe(mockProjectRole.id);
      expect(mockCacheManager.set).toHaveBeenCalledWith(
        "user:role:project:project-1:user-1",
        expect.objectContaining({ id: mockProjectRole.id }),
        3600,
      );
    });

    it("should return null when no project role for project", async () => {
      mockCacheManager.get.mockResolvedValue(undefined);
      mockUserRoleRepository.find.mockResolvedValue([
        { userId: "user-1", role: mockOrgRole },
      ]);
      mockCacheManager.set.mockResolvedValue(undefined);

      const result = await service.getUserProjectRole("project-1", "user-1");

      expect(result).toBeNull();
    });

    it("should return null when project role is for different project", async () => {
      mockCacheManager.get.mockResolvedValue(undefined);
      const differentProjectRole = {
        ...mockProjectRole,
        projectId: "project-2",
      };
      mockUserRoleRepository.find.mockResolvedValue([
        { userId: "user-1", role: differentProjectRole },
      ]);
      mockCacheManager.set.mockResolvedValue(undefined);

      const result = await service.getUserProjectRole("project-1", "user-1");

      expect(result).toBeNull();
    });
  });

  describe("getUserProjectRoles", () => {
    it("should return all project roles for user", async () => {
      const projectRole2 = {
        id: "role-project-2",
        name: "Viewer",
        permissions: [],
        isSystemRole: true,
        isInstanceLevel: false,
        organisationId: "org-1",
        projectId: "project-1",
        createdAt: new Date(),
        updatedAt: new Date(),
        get scope() {
          return "project" as any;
        },
      } as Role;
      mockUserRoleRepository.find.mockResolvedValue([
        { userId: "user-1", role: mockProjectRole },
        { userId: "user-1", role: projectRole2 },
        { userId: "user-1", role: mockOrgRole },
      ]);

      const result = await service.getUserProjectRoles("project-1", "user-1");

      expect(mockUserRoleRepository.find).toHaveBeenCalledWith({
        where: { userId: "user-1" },
        relations: ["role"],
      });
      expect(result).toHaveLength(2);
      expect(result[0].id).toBe(mockProjectRole.id);
      expect(result[1].id).toBe(projectRole2.id);
    });

    it("should return empty array when no project roles", async () => {
      mockUserRoleRepository.find.mockResolvedValue([
        { userId: "user-1", role: mockOrgRole },
      ]);

      const result = await service.getUserProjectRoles("project-1", "user-1");

      expect(result).toEqual([]);
    });
  });

  describe("getUserProjectRolesForOrganisation", () => {
    it("should return project roles for organisation", async () => {
      const projectRole2 = {
        id: "role-project-2",
        name: "Viewer",
        permissions: [],
        isSystemRole: true,
        isInstanceLevel: false,
        organisationId: "org-1",
        projectId: "project-2",
        createdAt: new Date(),
        updatedAt: new Date(),
        get scope() {
          return "project" as any;
        },
      } as Role;
      mockUserRoleRepository.find.mockResolvedValue([
        { userId: "user-1", role: mockProjectRole },
        { userId: "user-1", role: projectRole2 },
        { userId: "user-1", role: mockOrgRole },
      ]);

      const result = await service.getUserProjectRolesForOrganisation(
        "org-1",
        "user-1",
      );

      expect(mockUserRoleRepository.find).toHaveBeenCalledWith({
        where: { userId: "user-1" },
        relations: ["role"],
      });
      expect(result).toHaveLength(2);
      expect(result[0].id).toBe(mockProjectRole.id);
      expect(result[1].id).toBe(projectRole2.id);
    });

    it("should filter out project roles from different organisation", async () => {
      const differentOrgRole = {
        id: "role-diff-org",
        name: "Member",
        permissions: [],
        isSystemRole: true,
        isInstanceLevel: false,
        organisationId: "org-2",
        projectId: "project-1",
        createdAt: new Date(),
        updatedAt: new Date(),
        get scope() {
          return "project" as any;
        },
      } as Role;
      mockUserRoleRepository.find.mockResolvedValue([
        { userId: "user-1", role: mockProjectRole },
        { userId: "user-1", role: differentOrgRole },
      ]);

      const result = await service.getUserProjectRolesForOrganisation(
        "org-1",
        "user-1",
      );

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(mockProjectRole.id);
    });
  });
});
