import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { CACHE_MANAGER } from "@nestjs/cache-manager";
import { NotFoundException } from "@nestjs/common";
import { RbacAssignmentService } from "../../../src/rbac/services/rbac-assignment.service";
import { Role } from "../../../src/rbac/entities/role.entity";
import { UserRole } from "../../../src/rbac/entities/user-role.entity";
import {
  ERROR_MESSAGES,
  formatError,
} from "../../../src/common/constants/error-messages.constants";
import { Repository } from "typeorm";
import { Cache } from "cache-manager";

describe("RbacAssignmentService", () => {
  let service: RbacAssignmentService;
  let roleRepository: Repository<Role>;
  let userRoleRepository: Repository<UserRole>;
  let cacheManager: Cache;

  const mockRoleRepository = {
    findOne: jest.fn(),
  };

  const mockUserRoleRepository = {
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    remove: jest.fn(),
    find: jest.fn(),
  };

  const mockCacheManager = {
    del: jest.fn(),
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

  const mockUserRole: UserRole = {
    id: "user-role-1",
    userId: "user-1",
    roleId: "role-1",
    createdAt: new Date(),
    updatedAt: new Date(),
    role: mockRole,
  } as UserRole;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RbacAssignmentService,
        {
          provide: getRepositoryToken(Role),
          useValue: mockRoleRepository,
        },
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

    service = module.get<RbacAssignmentService>(RbacAssignmentService);
    roleRepository = module.get<Repository<Role>>(getRepositoryToken(Role));
    userRoleRepository = module.get<Repository<UserRole>>(
      getRepositoryToken(UserRole),
    );
    cacheManager = module.get<Cache>(CACHE_MANAGER);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("assignRole", () => {
    it("should assign role when not already assigned", async () => {
      mockUserRoleRepository.findOne.mockResolvedValue(null);
      mockRoleRepository.findOne.mockResolvedValue(mockRole);
      mockUserRoleRepository.create.mockReturnValue(mockUserRole);
      mockUserRoleRepository.save.mockResolvedValue(mockUserRole);
      mockCacheManager.del.mockResolvedValue(undefined);

      await service.assignRole("user-1", "role-1");

      expect(mockRoleRepository.findOne).toHaveBeenCalledWith({
        where: { id: "role-1" },
      });

      expect(mockUserRoleRepository.create).toHaveBeenCalledWith({
        userId: "user-1",
        roleId: "role-1",
      });

      expect(mockUserRoleRepository.save).toHaveBeenCalledWith(mockUserRole);

      expect(mockCacheManager.del).toHaveBeenCalledWith(
        "user:role:instance:user-1",
      );
    });

    it("should not assign role when already assigned", async () => {
      mockUserRoleRepository.findOne.mockResolvedValue(mockUserRole);

      await service.assignRole("user-1", "role-1");

      expect(mockRoleRepository.findOne).not.toHaveBeenCalled();
      expect(mockUserRoleRepository.create).not.toHaveBeenCalled();
      expect(mockUserRoleRepository.save).not.toHaveBeenCalled();
    });

    it("should throw NotFoundException when role does not exist", async () => {
      mockUserRoleRepository.findOne.mockResolvedValue(null);
      mockRoleRepository.findOne.mockResolvedValue(null);

      await expect(service.assignRole("user-1", "role-1")).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.assignRole("user-1", "role-1")).rejects.toThrow(
        formatError(ERROR_MESSAGES.ROLE_NOT_FOUND, "role-1"),
      );

      expect(mockUserRoleRepository.create).not.toHaveBeenCalled();
    });
  });

  describe("removeRole", () => {
    it("should remove role when assigned", async () => {
      mockUserRoleRepository.findOne.mockResolvedValue(mockUserRole);
      mockUserRoleRepository.remove.mockResolvedValue(mockUserRole);
      mockCacheManager.del.mockResolvedValue(undefined);

      await service.removeRole("user-1", "role-1");

      expect(mockUserRoleRepository.findOne).toHaveBeenCalledWith({
        where: { userId: "user-1", roleId: "role-1" },
      });

      expect(mockUserRoleRepository.remove).toHaveBeenCalledWith(mockUserRole);

      expect(mockCacheManager.del).toHaveBeenCalledWith(
        "user:role:instance:user-1",
      );
    });

    it("should not throw error when role not assigned", async () => {
      mockUserRoleRepository.findOne.mockResolvedValue(null);

      await service.removeRole("user-1", "role-1");

      expect(mockUserRoleRepository.remove).not.toHaveBeenCalled();
    });
  });

  describe("getUserIdsForRole", () => {
    it("should return user IDs for a role", async () => {
      const userRoles = [
        { ...mockUserRole, userId: "user-1" },
        { ...mockUserRole, userId: "user-2", id: "user-role-2" },
      ];

      mockUserRoleRepository.find.mockResolvedValue(userRoles);

      const result = await service.getUserIdsForRole("role-1");

      expect(mockUserRoleRepository.find).toHaveBeenCalledWith({
        where: { roleId: "role-1" },
      });
      expect(result).toEqual(["user-1", "user-2"]);
    });

    it("should return empty array when no users have role", async () => {
      mockUserRoleRepository.find.mockResolvedValue([]);

      const result = await service.getUserIdsForRole("role-1");

      expect(result).toEqual([]);
    });
  });
});
