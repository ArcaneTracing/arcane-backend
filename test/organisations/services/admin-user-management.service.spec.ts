import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { BadRequestException, NotFoundException } from "@nestjs/common";
import { AdminUserManagementService } from "../../../src/organisations/services/admin-user-management.service";
import { BetterAuthUser } from "../../../src/auth/entities/user.entity";
import { Organisation } from "../../../src/organisations/entities/organisation.entity";
import { Project } from "../../../src/projects/entities/project.entity";
import { BetterAuthUserService } from "../../../src/auth/services/better-auth-user.service";
import { RbacMembershipService } from "../../../src/rbac/services/rbac-membership.service";
import { InstanceOwnerService } from "../../../src/rbac/services/instance-owner.service";
import { AuditService } from "../../../src/audit/audit.service";
import { Repository } from "typeorm";
import {
  ERROR_MESSAGES,
  formatError,
} from "../../../src/common/constants/error-messages.constants";

describe("AdminUserManagementService", () => {
  let service: AdminUserManagementService;
  let userRepository: Repository<BetterAuthUser>;
  let organisationRepository: Repository<Organisation>;
  let projectRepository: Repository<Project>;
  let betterAuthUserService: BetterAuthUserService;
  let membershipService: RbacMembershipService;
  let instanceOwnerService: InstanceOwnerService;
  let auditService: AuditService;

  const mockUserRepository = {
    manager: {
      transaction: jest.fn(),
      query: jest.fn(),
    },
  };

  const mockOrganisationRepository = {
    manager: {
      query: jest.fn(),
      transaction: jest.fn(),
    },
  };

  const mockProjectRepository = {
    manager: {
      query: jest.fn(),
      transaction: jest.fn(),
    },
  };

  const mockBetterAuthUserService = {
    getUserById: jest.fn(),
  };

  const mockMembershipService = {
    getUserOrganisationIds: jest.fn(),
    getUserProjectIds: jest.fn(),
  };

  const mockInstanceOwnerService = {
    isOwner: jest.fn(),
  };

  const mockAuditService = {
    record: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminUserManagementService,
        {
          provide: getRepositoryToken(BetterAuthUser),
          useValue: mockUserRepository,
        },
        {
          provide: getRepositoryToken(Organisation),
          useValue: mockOrganisationRepository,
        },
        {
          provide: getRepositoryToken(Project),
          useValue: mockProjectRepository,
        },
        {
          provide: BetterAuthUserService,
          useValue: mockBetterAuthUserService,
        },
        {
          provide: RbacMembershipService,
          useValue: mockMembershipService,
        },
        {
          provide: InstanceOwnerService,
          useValue: mockInstanceOwnerService,
        },
        {
          provide: AuditService,
          useValue: mockAuditService,
        },
      ],
    }).compile();

    service = module.get<AdminUserManagementService>(
      AdminUserManagementService,
    );
    userRepository = module.get<Repository<BetterAuthUser>>(
      getRepositoryToken(BetterAuthUser),
    );
    organisationRepository = module.get<Repository<Organisation>>(
      getRepositoryToken(Organisation),
    );
    projectRepository = module.get<Repository<Project>>(
      getRepositoryToken(Project),
    );
    betterAuthUserService = module.get<BetterAuthUserService>(
      BetterAuthUserService,
    );
    membershipService = module.get<RbacMembershipService>(
      RbacMembershipService,
    );
    instanceOwnerService =
      module.get<InstanceOwnerService>(InstanceOwnerService);
    auditService = module.get<AuditService>(AuditService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("removeUserFromSystem", () => {
    const userId = "user-1";
    const actorId = "admin-1";
    const mockUser = {
      id: userId,
      email: "user@example.com",
      name: "Test User",
    };

    it("should remove user from all organizations, projects, and roles", async () => {
      const organisationIds = ["org-1", "org-2"];
      const projectIds = ["project-1"];

      mockBetterAuthUserService.getUserById.mockResolvedValue(mockUser);
      mockInstanceOwnerService.isOwner.mockResolvedValue(false);
      mockMembershipService.getUserOrganisationIds.mockResolvedValue(
        organisationIds,
      );
      mockMembershipService.getUserProjectIds.mockResolvedValue(projectIds);

      const mockTransaction = jest.fn(async (callback) => {
        const mockManager = {
          query: jest.fn().mockResolvedValue(undefined),
        };
        return await callback(mockManager);
      });
      mockUserRepository.manager.transaction = mockTransaction;

      await service.removeUserFromSystem(userId, actorId);

      expect(mockBetterAuthUserService.getUserById).toHaveBeenCalledWith(
        userId,
      );
      expect(mockInstanceOwnerService.isOwner).toHaveBeenCalledWith(userId);
      expect(mockMembershipService.getUserOrganisationIds).toHaveBeenCalledWith(
        userId,
      );
      expect(mockMembershipService.getUserProjectIds).toHaveBeenCalledWith(
        userId,
      );
      expect(mockUserRepository.manager.transaction).toHaveBeenCalled();
      expect(mockAuditService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "user.removed_from_system",
          actorId,
          actorType: "user",
          resourceType: "user",
          resourceId: userId,
          beforeState: {
            userId,
            email: mockUser.email,
            organisationIds,
            projectIds,
          },
          afterState: null,
          metadata: {
            userId,
            email: mockUser.email,
            removedOrganisationIds: organisationIds,
            removedProjectIds: projectIds,
            removedById: actorId,
          },
        }),
      );
    });

    it("should throw NotFoundException when user does not exist", async () => {
      mockBetterAuthUserService.getUserById.mockResolvedValue(null);

      await expect(
        service.removeUserFromSystem(userId, actorId),
      ).rejects.toThrow(NotFoundException);
      await expect(
        service.removeUserFromSystem(userId, actorId),
      ).rejects.toThrow(formatError(ERROR_MESSAGES.USER_NOT_FOUND, userId));
      expect(mockInstanceOwnerService.isOwner).not.toHaveBeenCalled();
    });

    it("should throw BadRequestException when trying to remove yourself", async () => {
      mockBetterAuthUserService.getUserById.mockResolvedValue(mockUser);

      await expect(
        service.removeUserFromSystem(userId, userId),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.removeUserFromSystem(userId, userId),
      ).rejects.toThrow(formatError(ERROR_MESSAGES.CANNOT_REMOVE_YOURSELF));
      expect(mockInstanceOwnerService.isOwner).not.toHaveBeenCalled();
      expect(mockUserRepository.manager.transaction).not.toHaveBeenCalled();
    });

    it("should throw BadRequestException when user is instance admin", async () => {
      mockBetterAuthUserService.getUserById.mockResolvedValue(mockUser);
      mockInstanceOwnerService.isOwner.mockResolvedValue(true);

      await expect(
        service.removeUserFromSystem(userId, actorId),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.removeUserFromSystem(userId, actorId),
      ).rejects.toThrow(
        formatError(ERROR_MESSAGES.CANNOT_REMOVE_INSTANCE_ADMIN),
      );
      expect(mockUserRepository.manager.transaction).not.toHaveBeenCalled();
    });

    it("should handle user with no organizations or projects", async () => {
      mockBetterAuthUserService.getUserById.mockResolvedValue(mockUser);
      mockInstanceOwnerService.isOwner.mockResolvedValue(false);
      mockMembershipService.getUserOrganisationIds.mockResolvedValue([]);
      mockMembershipService.getUserProjectIds.mockResolvedValue([]);

      const mockTransaction = jest.fn(async (callback) => {
        const mockManager = {
          query: jest.fn().mockResolvedValue(undefined),
        };
        return await callback(mockManager);
      });
      mockUserRepository.manager.transaction = mockTransaction;

      await service.removeUserFromSystem(userId, actorId);

      expect(mockUserRepository.manager.transaction).toHaveBeenCalled();
      expect(mockAuditService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "user.removed_from_system",
          beforeState: {
            userId,
            email: mockUser.email,
            organisationIds: [],
            projectIds: [],
          },
        }),
      );
    });
  });
});
