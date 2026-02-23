import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import {
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from "@nestjs/common";
import { InstanceOwnerService } from "../../../src/rbac/services/instance-owner.service";
import { RbacPermissionService } from "../../../src/rbac/services/rbac-permission.service";
import { RbacAssignmentService } from "../../../src/rbac/services/rbac-assignment.service";
import { Role } from "../../../src/rbac/entities/role.entity";
import { Repository } from "typeorm";
import {
  ERROR_MESSAGES,
  formatError,
} from "../../../src/common/constants/error-messages.constants";
import { AuditService } from "../../../src/audit/audit.service";
import { BetterAuthUserService } from "../../../src/auth/services/better-auth-user.service";

describe("InstanceOwnerService", () => {
  let service: InstanceOwnerService;
  let roleRepository: Repository<Role>;
  let permissionService: RbacPermissionService;
  let assignmentService: RbacAssignmentService;

  const mockAuditService = { record: jest.fn().mockResolvedValue(undefined) };

  const mockRoleRepository = {
    findOne: jest.fn(),
  };

  const mockPermissionService = {
    hasPermissionForUser: jest.fn(),
  };

  const mockAssignmentService = {
    assignRole: jest.fn(),
    removeRole: jest.fn(),
    getUserIdsForRole: jest.fn(),
  };

  const mockBetterAuthUserService = {
    getUsersByIds: jest.fn(),
  };

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
        InstanceOwnerService,
        {
          provide: getRepositoryToken(Role),
          useValue: mockRoleRepository,
        },
        {
          provide: RbacPermissionService,
          useValue: mockPermissionService,
        },
        {
          provide: RbacAssignmentService,
          useValue: mockAssignmentService,
        },
        { provide: AuditService, useValue: mockAuditService },
        {
          provide: BetterAuthUserService,
          useValue: mockBetterAuthUserService,
        },
      ],
    }).compile();

    service = module.get<InstanceOwnerService>(InstanceOwnerService);
    roleRepository = module.get<Repository<Role>>(getRepositoryToken(Role));
    permissionService = module.get<RbacPermissionService>(
      RbacPermissionService,
    );
    assignmentService = module.get<RbacAssignmentService>(
      RbacAssignmentService,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("assignOwnerRole", () => {
    it("should assign owner role when requester is owner", async () => {
      mockPermissionService.hasPermissionForUser.mockResolvedValue(true);
      mockRoleRepository.findOne.mockResolvedValue(mockOwnerRole);
      mockAssignmentService.assignRole.mockResolvedValue(undefined);

      await service.assignOwnerRole("user-1", "owner-1");

      expect(mockPermissionService.hasPermissionForUser).toHaveBeenCalledWith(
        "owner-1",
        "*",
      );
      expect(mockRoleRepository.findOne).toHaveBeenCalledWith({
        where: {
          name: "Owner",
          isSystemRole: true,
          isInstanceLevel: true,
          organisationId: null,
          projectId: null,
        },
      });
      expect(mockAssignmentService.assignRole).toHaveBeenCalledWith(
        "user-1",
        "role-owner",
      );
      expect(mockAuditService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "instance_owner.assigned",
          actorId: "owner-1",
          resourceType: "instance_owner",
          resourceId: "user-1",
          afterState: {
            assignedToUserId: "user-1",
            roleName: "Owner",
            roleId: "role-owner",
          },
          metadata: { assignedById: "owner-1" },
        }),
      );
    });

    it("should throw ForbiddenException when requester is not owner", async () => {
      mockPermissionService.hasPermissionForUser.mockResolvedValue(false);

      await expect(service.assignOwnerRole("user-1", "user-2")).rejects.toThrow(
        ForbiddenException,
      );
      await expect(service.assignOwnerRole("user-1", "user-2")).rejects.toThrow(
        formatError(ERROR_MESSAGES.ONLY_OWNERS_CAN_ASSIGN_OWNER_ROLE),
      );
      expect(mockRoleRepository.findOne).not.toHaveBeenCalled();
      expect(mockAssignmentService.assignRole).not.toHaveBeenCalled();
    });

    it("should throw NotFoundException when owner role does not exist", async () => {
      mockPermissionService.hasPermissionForUser.mockResolvedValue(true);
      mockRoleRepository.findOne.mockResolvedValue(null);

      await expect(
        service.assignOwnerRole("user-1", "owner-1"),
      ).rejects.toThrow(NotFoundException);
      await expect(
        service.assignOwnerRole("user-1", "owner-1"),
      ).rejects.toThrow(formatError(ERROR_MESSAGES.OWNER_ROLE_NOT_FOUND));
      expect(mockAssignmentService.assignRole).not.toHaveBeenCalled();
    });
  });

  describe("removeOwnerRole", () => {
    it("should remove owner role when requester is owner", async () => {
      mockPermissionService.hasPermissionForUser.mockResolvedValue(true);

      mockRoleRepository.findOne
        .mockResolvedValueOnce(mockOwnerRole)
        .mockResolvedValueOnce(mockOwnerRole);
      mockAssignmentService.getUserIdsForRole.mockResolvedValue([
        "owner-1",
        "owner-2",
      ]);
      mockAssignmentService.removeRole.mockResolvedValue(undefined);

      await service.removeOwnerRole("owner-1", "owner-2");

      expect(mockPermissionService.hasPermissionForUser).toHaveBeenCalledWith(
        "owner-2",
        "*",
      );
      expect(mockAssignmentService.removeRole).toHaveBeenCalledWith(
        "owner-1",
        "role-owner",
      );
      expect(mockAuditService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "instance_owner.removed",
          actorId: "owner-2",
          resourceType: "instance_owner",
          resourceId: "owner-1",
          beforeState: {
            assignedToUserId: "owner-1",
            roleName: "Owner",
            roleId: "role-owner",
          },
          afterState: null,
          metadata: { removedById: "owner-2" },
        }),
      );
    });

    it("should throw ForbiddenException when requester is not owner", async () => {
      mockPermissionService.hasPermissionForUser.mockResolvedValue(false);

      await expect(
        service.removeOwnerRole("owner-1", "user-2"),
      ).rejects.toThrow(ForbiddenException);
      await expect(
        service.removeOwnerRole("owner-1", "user-2"),
      ).rejects.toThrow(
        formatError(ERROR_MESSAGES.ONLY_OWNERS_CAN_REMOVE_OWNER_ROLE),
      );
      expect(mockAssignmentService.removeRole).not.toHaveBeenCalled();
    });

    it("should throw BadRequestException when removing last owner", async () => {
      mockPermissionService.hasPermissionForUser.mockResolvedValue(true);
      mockRoleRepository.findOne.mockImplementation((options: any) => {
        if (
          options?.where?.name === "Owner" &&
          options?.where?.isSystemRole === true &&
          options?.where?.isInstanceLevel === true &&
          options?.where?.organisationId === null &&
          options?.where?.projectId === null
        ) {
          return Promise.resolve(mockOwnerRole);
        }
        return Promise.resolve(null);
      });
      mockAssignmentService.getUserIdsForRole.mockResolvedValue(["owner-1"]);

      await expect(
        service.removeOwnerRole("owner-1", "owner-2"),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.removeOwnerRole("owner-1", "owner-2"),
      ).rejects.toThrow(formatError(ERROR_MESSAGES.CANNOT_REMOVE_LAST_OWNER));
      expect(mockAssignmentService.removeRole).not.toHaveBeenCalled();
    });

    it("should throw NotFoundException when owner role does not exist", async () => {
      mockPermissionService.hasPermissionForUser.mockResolvedValue(true);
      mockRoleRepository.findOne.mockResolvedValue(null);

      await expect(
        service.removeOwnerRole("owner-1", "owner-2"),
      ).rejects.toThrow(NotFoundException);
      await expect(
        service.removeOwnerRole("owner-1", "owner-2"),
      ).rejects.toThrow(formatError(ERROR_MESSAGES.OWNER_ROLE_NOT_FOUND));

      expect(mockRoleRepository.findOne).toHaveBeenCalledTimes(4);
      expect(mockAssignmentService.removeRole).not.toHaveBeenCalled();
    });
  });

  describe("listOwners", () => {
    it("should return list of owner user IDs", async () => {
      mockRoleRepository.findOne.mockResolvedValue(mockOwnerRole);
      mockAssignmentService.getUserIdsForRole.mockResolvedValue([
        "owner-1",
        "owner-2",
      ]);

      const result = await service.listOwners();

      expect(mockRoleRepository.findOne).toHaveBeenCalledWith({
        where: {
          name: "Owner",
          isSystemRole: true,
          isInstanceLevel: true,
          organisationId: null,
          projectId: null,
        },
      });
      expect(mockAssignmentService.getUserIdsForRole).toHaveBeenCalledWith(
        "role-owner",
      );
      expect(result).toEqual(["owner-1", "owner-2"]);
    });

    it("should return empty array when owner role does not exist", async () => {
      mockRoleRepository.findOne.mockResolvedValue(null);

      const result = await service.listOwners();

      expect(result).toEqual([]);
      expect(mockAssignmentService.getUserIdsForRole).not.toHaveBeenCalled();
    });

    it("should return empty array when no owners exist", async () => {
      mockRoleRepository.findOne.mockResolvedValue(mockOwnerRole);
      mockAssignmentService.getUserIdsForRole.mockResolvedValue([]);

      const result = await service.listOwners();

      expect(result).toEqual([]);
    });
  });

  describe("isOwner", () => {
    it("should return true when user is owner", async () => {
      mockPermissionService.hasPermissionForUser.mockResolvedValue(true);

      const result = await service.isOwner("user-1");

      expect(mockPermissionService.hasPermissionForUser).toHaveBeenCalledWith(
        "user-1",
        "*",
      );
      expect(result).toBe(true);
    });

    it("should return false when user is not owner", async () => {
      mockPermissionService.hasPermissionForUser.mockResolvedValue(false);

      const result = await service.isOwner("user-1");

      expect(result).toBe(false);
    });
  });

  describe("listOwnersWithDetails", () => {
    it("should return list of owners with full user details", async () => {
      const userIds = ["owner-1", "owner-2"];
      const mockUsers = [
        { id: "owner-1", email: "owner1@example.com", name: "Owner One" },
        { id: "owner-2", email: "owner2@example.com", name: "Owner Two" },
      ];

      mockRoleRepository.findOne.mockResolvedValue(mockOwnerRole);
      mockAssignmentService.getUserIdsForRole.mockResolvedValue(userIds);
      mockBetterAuthUserService.getUsersByIds.mockResolvedValue(mockUsers);

      const result = await service.listOwnersWithDetails();

      expect(mockAssignmentService.getUserIdsForRole).toHaveBeenCalledWith(
        "role-owner",
      );
      expect(mockBetterAuthUserService.getUsersByIds).toHaveBeenCalledWith(
        userIds,
      );
      expect(result).toEqual(mockUsers);
    });

    it("should return empty array when no owners exist", async () => {
      mockRoleRepository.findOne.mockResolvedValue(mockOwnerRole);
      mockAssignmentService.getUserIdsForRole.mockResolvedValue([]);

      const result = await service.listOwnersWithDetails();

      expect(mockBetterAuthUserService.getUsersByIds).not.toHaveBeenCalled();
      expect(result).toEqual([]);
    });

    it("should return empty array when owner role does not exist", async () => {
      mockRoleRepository.findOne.mockResolvedValue(null);

      const result = await service.listOwnersWithDetails();

      expect(mockBetterAuthUserService.getUsersByIds).not.toHaveBeenCalled();
      expect(result).toEqual([]);
    });
  });
});
