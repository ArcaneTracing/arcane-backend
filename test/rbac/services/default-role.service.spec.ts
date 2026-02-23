import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { CACHE_MANAGER } from "@nestjs/cache-manager";
import { Repository } from "typeorm";
import { NotFoundException } from "@nestjs/common";
import { DefaultRoleService } from "../../../src/rbac/services/default-role.service";
import { Role } from "../../../src/rbac/entities/role.entity";
import {
  ERROR_MESSAGES,
  formatError,
} from "../../../src/common/constants/error-messages.constants";

describe("DefaultRoleService", () => {
  let service: DefaultRoleService;
  let roleRepository: Repository<Role>;
  let cacheManager: any;

  const mockRoleRepository = {
    findOne: jest.fn(),
  };

  const mockCacheManager = {
    get: jest.fn(),
    set: jest.fn(),
  };

  const mockProjectRole: Role = {
    id: "role-member",
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

  const mockOrgRole: Role = {
    id: "role-org-member",
    name: "Organisation Member",
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

  const mockOwnerRole: Role = {
    id: "role-owner",
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

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DefaultRoleService,
        {
          provide: getRepositoryToken(Role),
          useValue: mockRoleRepository,
        },
        {
          provide: CACHE_MANAGER,
          useValue: mockCacheManager,
        },
      ],
    }).compile();

    service = module.get<DefaultRoleService>(DefaultRoleService);
    roleRepository = module.get<Repository<Role>>(getRepositoryToken(Role));
    cacheManager = module.get(CACHE_MANAGER);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("getDefaultProjectRole", () => {
    it("should return cached role when available", async () => {
      mockCacheManager.get.mockResolvedValue(mockProjectRole);

      const result = await service.getDefaultProjectRole("org-1", "project-1");

      expect(mockCacheManager.get).toHaveBeenCalledWith(
        "role:default:project:org-1:project-1",
      );
      expect(result).toEqual(mockProjectRole);
      expect(mockRoleRepository.findOne).not.toHaveBeenCalled();
    });

    it("should fetch from database and cache when not cached", async () => {
      mockCacheManager.get.mockResolvedValue(null);
      mockRoleRepository.findOne.mockResolvedValue(mockProjectRole);
      mockCacheManager.set.mockResolvedValue(undefined);

      const result = await service.getDefaultProjectRole("org-1", "project-1");

      expect(mockCacheManager.get).toHaveBeenCalledWith(
        "role:default:project:org-1:project-1",
      );

      expect(mockRoleRepository.findOne).toHaveBeenCalledWith({
        where: {
          name: "Member",
          isSystemRole: true,
          organisationId: "org-1",
          projectId: "project-1",
        },
      });

      expect(mockCacheManager.set).toHaveBeenCalledWith(
        "role:default:project:org-1:project-1",
        mockProjectRole,
        1800,
      );

      expect(result).toEqual(mockProjectRole);
      expect(result.name).toBe("Member");
      expect(result.isSystemRole).toBe(true);
    });

    it("should throw NotFoundException when role not found", async () => {
      mockCacheManager.get.mockResolvedValue(null);
      mockRoleRepository.findOne.mockResolvedValue(null);

      await expect(
        service.getDefaultProjectRole("org-1", "project-1"),
      ).rejects.toThrow(NotFoundException);
      await expect(
        service.getDefaultProjectRole("org-1", "project-1"),
      ).rejects.toThrow(
        formatError(ERROR_MESSAGES.DEFAULT_MEMBER_ROLE_NOT_FOUND, "project-1"),
      );

      expect(mockCacheManager.set).not.toHaveBeenCalled();
    });
  });

  describe("getDefaultOrganisationRole", () => {
    it("should return cached role when available", async () => {
      mockCacheManager.get.mockResolvedValue(mockOrgRole);

      const result = await service.getDefaultOrganisationRole("org-1");

      expect(mockCacheManager.get).toHaveBeenCalledWith(
        "role:default:org:org-1",
      );
      expect(result).toEqual(mockOrgRole);
      expect(mockRoleRepository.findOne).not.toHaveBeenCalled();
    });

    it("should fetch from database and cache when not cached", async () => {
      mockCacheManager.get.mockResolvedValue(null);
      mockRoleRepository.findOne.mockResolvedValue(mockOrgRole);
      mockCacheManager.set.mockResolvedValue(undefined);

      const result = await service.getDefaultOrganisationRole("org-1");

      expect(mockCacheManager.get).toHaveBeenCalledWith(
        "role:default:org:org-1",
      );
      expect(mockRoleRepository.findOne).toHaveBeenCalledWith({
        where: {
          name: "Organisation Member",
          isSystemRole: true,
          organisationId: "org-1",
          projectId: null,
        },
      });
      expect(mockCacheManager.set).toHaveBeenCalledWith(
        "role:default:org:org-1",
        mockOrgRole,
        1800,
      );
      expect(result).toEqual(mockOrgRole);
    });

    it("should throw NotFoundException when role not found", async () => {
      mockCacheManager.get.mockResolvedValue(null);
      mockRoleRepository.findOne.mockResolvedValue(null);

      await expect(service.getDefaultOrganisationRole("org-1")).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.getDefaultOrganisationRole("org-1")).rejects.toThrow(
        formatError(
          ERROR_MESSAGES.DEFAULT_ORGANISATION_MEMBER_ROLE_NOT_FOUND,
          "org-1",
        ),
      );
      expect(mockCacheManager.set).not.toHaveBeenCalled();
    });
  });

  describe("getOwnerRoleId", () => {
    it("should return cached role ID when available", async () => {
      mockCacheManager.get.mockResolvedValue("role-owner-id");

      const result = await service.getOwnerRoleId();

      expect(mockCacheManager.get).toHaveBeenCalledWith("role:owner");
      expect(result).toBe("role-owner-id");
      expect(mockRoleRepository.findOne).not.toHaveBeenCalled();
    });

    it("should fetch from database and cache when not cached", async () => {
      mockCacheManager.get.mockResolvedValue(undefined);
      mockRoleRepository.findOne.mockResolvedValue(mockOwnerRole);
      mockCacheManager.set.mockResolvedValue(undefined);

      const result = await service.getOwnerRoleId();

      expect(mockCacheManager.get).toHaveBeenCalledWith("role:owner");

      expect(mockRoleRepository.findOne).toHaveBeenCalledWith({
        where: {
          name: "Owner",
          isSystemRole: true,
          isInstanceLevel: true,
          organisationId: null,
          projectId: null,
        },
      });

      expect(mockCacheManager.set).toHaveBeenCalledWith(
        "role:owner",
        mockOwnerRole.id,
        1800,
      );

      expect(result).toBe(mockOwnerRole.id);
      expect(result).toBe("role-owner");
    });

    it("should return null and cache it when owner role not found", async () => {
      mockCacheManager.get.mockResolvedValue(undefined);
      mockRoleRepository.findOne.mockResolvedValue(null);
      mockCacheManager.set.mockResolvedValue(undefined);

      const result = await service.getOwnerRoleId();

      expect(mockCacheManager.get).toHaveBeenCalledWith("role:owner");
      expect(mockRoleRepository.findOne).toHaveBeenCalledWith({
        where: {
          name: "Owner",
          isSystemRole: true,
          isInstanceLevel: true,
          organisationId: null,
          projectId: null,
        },
      });
      expect(result).toBeNull();
      expect(mockCacheManager.set).toHaveBeenCalledWith(
        "role:owner",
        null,
        1800,
      );
    });
  });
});
