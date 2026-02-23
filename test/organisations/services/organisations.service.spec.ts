import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { CACHE_MANAGER } from "@nestjs/cache-manager";
import { NotFoundException, BadRequestException } from "@nestjs/common";
import { Repository } from "typeorm";
import { OrganisationsService } from "../../../src/organisations/services/organisations.service";
import { Organisation } from "../../../src/organisations/entities/organisation.entity";
import { BetterAuthUser } from "../../../src/auth/entities/user.entity";
import { OrganisationRbacService } from "../../../src/organisations/services/organisation-rbac.service";
import { CreateOrganisationRequestDto } from "../../../src/organisations/dto/request/create-organisation.dto";
import { UpdateOrganisationRequestDto } from "../../../src/organisations/dto/request/update-organisation.dto";
import { OrganisationResponseDto } from "../../../src/organisations/dto/response/organisation.dto";
import { OrganisationUserWithRoleResponseDto } from "../../../src/organisations/dto/response/organisation-user-with-role.dto";
import {
  ERROR_MESSAGES,
  formatError,
} from "../../../src/common/constants/error-messages.constants";
import { OrganisationInvitationService } from "../../../src/organisations/services/organisation-invitation.service";
import { MailerService } from "../../../src/common/mailer/mailer.service";
import { BetterAuthUserService } from "../../../src/auth/services/better-auth-user.service";
import { RolesService } from "../../../src/rbac/services/roles.service";
import { ConfigService } from "@nestjs/config";
import { AuditService } from "../../../src/audit/audit.service";
import { RoleResponseDto } from "../../../src/rbac/dto/response/role-response.dto";

describe("OrganisationsService", () => {
  let service: OrganisationsService;
  let organisationRepository: Repository<Organisation>;
  let userRepository: Repository<BetterAuthUser>;
  let organisationRbacService: OrganisationRbacService;
  let cacheManager: any;

  const mockOrganisationRepository = {
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    remove: jest.fn(),
    createQueryBuilder: jest.fn(),
    manager: {
      transaction: jest.fn(),
      getRepository: jest.fn(),
      query: jest.fn(),
    },
  };

  const mockUserRepository = {
    findOne: jest.fn(),
  };

  const mockOrganisationRbacService = {
    seedOrganisationRoles: jest.fn(),
    assignRole: jest.fn(),
    getDefaultOrganisationRole: jest.fn(),
    getUserRole: jest.fn(),
  };

  const mockOrganisationInvitationService = {
    createInvite: jest.fn(),
  };

  const mockMailerService = {
    sendOrganisationInvite: jest.fn(),
  };

  const mockBetterAuthUserService = {
    getUserIdByEmail: jest.fn(),
    getUserById: jest.fn(),
    getUsersByIds: jest.fn(),
  };

  const mockRolesService = {
    findOne: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn(),
  };

  const mockCacheManager = {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
  };

  const mockAuditService = {
    record: jest.fn().mockResolvedValue(undefined),
  };

  const mockOrganisation: Organisation = {
    id: "org-1",
    name: "Test Organisation",
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-01"),
    users: [],
    projects: [],
  };

  const mockOrganisationResponseDto: OrganisationResponseDto = {
    id: "org-1",
    name: "Test Organisation",
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-01"),
  };

  const mockOrgAdminRole = {
    id: "role-admin",
    name: "Organisation Admin",
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrganisationsService,
        {
          provide: getRepositoryToken(Organisation),
          useValue: mockOrganisationRepository,
        },
        {
          provide: getRepositoryToken(BetterAuthUser),
          useValue: mockUserRepository,
        },
        {
          provide: OrganisationRbacService,
          useValue: mockOrganisationRbacService,
        },
        {
          provide: OrganisationInvitationService,
          useValue: mockOrganisationInvitationService,
        },
        {
          provide: MailerService,
          useValue: mockMailerService,
        },
        {
          provide: BetterAuthUserService,
          useValue: mockBetterAuthUserService,
        },
        {
          provide: RolesService,
          useValue: mockRolesService,
        },
        {
          provide: CACHE_MANAGER,
          useValue: mockCacheManager,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
        {
          provide: AuditService,
          useValue: mockAuditService,
        },
      ],
    }).compile();

    service = module.get<OrganisationsService>(OrganisationsService);
    organisationRepository = module.get<Repository<Organisation>>(
      getRepositoryToken(Organisation),
    );
    userRepository = module.get<Repository<BetterAuthUser>>(
      getRepositoryToken(BetterAuthUser),
    );
    organisationRbacService = module.get<OrganisationRbacService>(
      OrganisationRbacService,
    );
    cacheManager = module.get(CACHE_MANAGER);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("create", () => {
    it("should create an organisation with transaction", async () => {
      const createDto: CreateOrganisationRequestDto = {
        name: "New Organisation",
      };
      const userId = "user-1";

      const createdOrganisation = {
        ...mockOrganisation,
        name: "New Organisation",
      };
      const mockOrgRepo = {
        create: jest.fn().mockReturnValue(createdOrganisation),
        save: jest.fn().mockResolvedValue(createdOrganisation),
        createQueryBuilder: jest.fn().mockReturnValue({
          relation: jest.fn().mockReturnValue({
            of: jest.fn().mockReturnValue({
              add: jest.fn().mockResolvedValue(undefined),
            }),
          }),
        }),
      };

      mockOrganisationRepository.manager.transaction.mockImplementation(
        async (callback) => {
          mockOrganisationRepository.manager.getRepository.mockReturnValue(
            mockOrgRepo,
          );
          return callback(mockOrganisationRepository.manager);
        },
      );
      mockOrganisationRbacService.seedOrganisationRoles.mockResolvedValue(
        mockOrgAdminRole,
      );
      mockOrganisationRbacService.assignRole.mockResolvedValue(undefined);

      const result = await service.create(createDto, userId);

      expect(mockOrganisationRepository.manager.transaction).toHaveBeenCalled();
      expect(mockOrgRepo.create).toHaveBeenCalledWith({
        name: "New Organisation",
      });
      expect(mockOrgRepo.save).toHaveBeenCalled();
      expect(
        mockOrganisationRbacService.seedOrganisationRoles,
      ).toHaveBeenCalledWith("org-1", mockOrganisationRepository.manager);
      expect(mockOrganisationRbacService.assignRole).toHaveBeenCalledWith(
        "org-1",
        userId,
        "role-admin",
        mockOrganisationRepository.manager,
      );
      expect(mockAuditService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "organisation.created",
          actorId: userId,
          actorType: "user",
          resourceType: "organisation",
          resourceId: "org-1",
          organisationId: "org-1",
          afterState: expect.objectContaining({
            id: "org-1",
            name: "New Organisation",
          }),
          metadata: expect.objectContaining({
            creatorId: userId,
          }),
        }),
      );
      expect(result).toEqual({
        ...mockOrganisationResponseDto,
        name: "New Organisation",
      });
    });

    it("should create organisation even if no admin role is returned", async () => {
      const createDto: CreateOrganisationRequestDto = {
        name: "New Organisation",
      };
      const userId = "user-1";

      const mockOrgRepo = {
        create: jest.fn().mockReturnValue(mockOrganisation),
        save: jest.fn().mockResolvedValue(mockOrganisation),
        createQueryBuilder: jest.fn().mockReturnValue({
          relation: jest.fn().mockReturnValue({
            of: jest.fn().mockReturnValue({
              add: jest.fn().mockResolvedValue(undefined),
            }),
          }),
        }),
      };

      mockOrganisationRepository.manager.transaction.mockImplementation(
        async (callback) => {
          mockOrganisationRepository.manager.getRepository.mockReturnValue(
            mockOrgRepo,
          );
          return callback(mockOrganisationRepository.manager);
        },
      );
      mockOrganisationRbacService.seedOrganisationRoles.mockResolvedValue(null);

      const result = await service.create(createDto, userId);

      expect(mockOrganisationRbacService.assignRole).not.toHaveBeenCalled();
      expect(result).toEqual(mockOrganisationResponseDto);
    });
  });

  describe("findAllForAdmin", () => {
    it("should return all organisations in the system", async () => {
      const mockOrganisations = [
        { ...mockOrganisation, id: "org-1" },
        { ...mockOrganisation, id: "org-2", name: "Another Org" },
      ];

      mockOrganisationRepository.find.mockResolvedValue(mockOrganisations);

      const result = await service.findAllForAdmin();

      expect(mockOrganisationRepository.find).toHaveBeenCalledWith({
        order: { createdAt: "DESC" },
      });
      expect(result).toHaveLength(2);
      expect(result[0].id).toBe("org-1");
      expect(result[1].id).toBe("org-2");
    });

    it("should return empty array when no organisations exist", async () => {
      mockOrganisationRepository.find.mockResolvedValue([]);

      const result = await service.findAllForAdmin();

      expect(result).toEqual([]);
      expect(mockOrganisationRepository.find).toHaveBeenCalledWith({
        order: { createdAt: "DESC" },
      });
    });
  });

  describe("findAll", () => {
    it("should return all organisations for a user", async () => {
      const userId = "user-1";
      const mockQueryBuilder = {
        innerJoin: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([mockOrganisation]),
      };
      mockOrganisationRepository.createQueryBuilder.mockReturnValue(
        mockQueryBuilder,
      );

      const result = await service.findAll(userId);

      expect(mockQueryBuilder.innerJoin).toHaveBeenCalledWith(
        "o.users",
        "u",
        "u.id = :userId",
        { userId },
      );
      expect(result).toEqual([mockOrganisationResponseDto]);
    });

    it("should return empty array when user has no organisations", async () => {
      const userId = "user-1";
      const mockQueryBuilder = {
        innerJoin: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      };
      mockOrganisationRepository.createQueryBuilder.mockReturnValue(
        mockQueryBuilder,
      );

      const result = await service.findAll(userId);

      expect(result).toEqual([]);
    });
  });

  describe("findById", () => {
    it("should return organisation from cache when available", async () => {
      const cacheKey = "organisation:org-1";
      mockCacheManager.get.mockResolvedValue(mockOrganisation);

      const result = await service.findById("org-1");

      expect(mockCacheManager.get).toHaveBeenCalledWith(cacheKey);
      expect(mockOrganisationRepository.findOne).not.toHaveBeenCalled();
      expect(result).toEqual(mockOrganisation);
    });

    it("should fetch from database and cache when not in cache", async () => {
      const cacheKey = "organisation:org-1";
      mockCacheManager.get.mockResolvedValue(undefined);
      mockOrganisationRepository.findOne.mockResolvedValue(mockOrganisation);
      mockCacheManager.set.mockResolvedValue(undefined);

      const result = await service.findById("org-1");

      expect(mockCacheManager.get).toHaveBeenCalledWith(cacheKey);
      expect(mockOrganisationRepository.findOne).toHaveBeenCalledWith({
        where: { id: "org-1" },
      });
      expect(mockCacheManager.set).toHaveBeenCalledWith(
        cacheKey,
        mockOrganisation,
        1800,
      );
      expect(result).toEqual(mockOrganisation);
    });

    it("should throw NotFoundException when organisation not found", async () => {
      mockCacheManager.get.mockResolvedValue(undefined);
      mockOrganisationRepository.findOne.mockResolvedValue(null);

      await expect(service.findById("non-existent")).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.findById("non-existent")).rejects.toThrow(
        formatError(ERROR_MESSAGES.ORGANISATION_NOT_FOUND, "non-existent"),
      );
    });
  });

  describe("isUserInOrganisation", () => {
    it("should return true when user is in organisation", async () => {
      const userId = "user-1";
      const organisationId = "org-1";
      const mockQueryBuilder = {
        innerJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getExists: jest.fn().mockResolvedValue(true),
      };
      mockOrganisationRepository.createQueryBuilder.mockReturnValue(
        mockQueryBuilder,
      );

      const result = await service.isUserInOrganisation(userId, organisationId);

      expect(mockQueryBuilder.innerJoin).toHaveBeenCalledWith("o.users", "u");
      expect(mockQueryBuilder.where).toHaveBeenCalledWith(
        "o.id = :organisationId",
        {
          organisationId,
        },
      );
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith("u.id = :userId", {
        userId,
      });
      expect(result).toBe(true);
    });

    it("should return false when user is not in organisation", async () => {
      const userId = "user-1";
      const organisationId = "org-1";
      const mockQueryBuilder = {
        innerJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getExists: jest.fn().mockResolvedValue(false),
      };
      mockOrganisationRepository.createQueryBuilder.mockReturnValue(
        mockQueryBuilder,
      );

      const result = await service.isUserInOrganisation(userId, organisationId);

      expect(result).toBe(false);
    });
  });

  describe("update", () => {
    it("should update organisation name", async () => {
      const updateDto: UpdateOrganisationRequestDto = {
        name: "Updated Organisation",
      };
      const updatedOrganisation = {
        ...mockOrganisation,
        name: "Updated Organisation",
      };
      mockCacheManager.get.mockResolvedValue(undefined);
      mockOrganisationRepository.findOne.mockResolvedValue(mockOrganisation);
      mockOrganisationRepository.save.mockResolvedValue(updatedOrganisation);
      mockCacheManager.del.mockResolvedValue(undefined);

      const result = await service.update("org-1", updateDto);

      expect(mockOrganisationRepository.save).toHaveBeenCalledWith({
        ...mockOrganisation,
        name: "Updated Organisation",
      });
      expect(mockCacheManager.del).toHaveBeenCalledWith("organisation:org-1");
      expect(mockAuditService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "organisation.updated",
          actorType: "user",
          resourceType: "organisation",
          resourceId: "org-1",
          organisationId: "org-1",
          beforeState: expect.objectContaining({
            id: "org-1",
            name: "Test Organisation",
          }),
          afterState: expect.objectContaining({
            id: "org-1",
            name: "Updated Organisation",
          }),
          metadata: expect.objectContaining({
            changedFields: ["name"],
          }),
        }),
      );
      expect(result.name).toBe("Updated Organisation");
    });

    it("should not update if name is undefined", async () => {
      const updateDto: UpdateOrganisationRequestDto = {};

      const freshOrganisation = {
        ...mockOrganisation,
        name: "Test Organisation",
      };
      mockCacheManager.get.mockResolvedValue(undefined);
      mockOrganisationRepository.findOne.mockResolvedValue(freshOrganisation);

      mockOrganisationRepository.save.mockImplementation((org) =>
        Promise.resolve(org as Organisation),
      );
      mockCacheManager.del.mockResolvedValue(undefined);

      const result = await service.update("org-1", updateDto);

      expect(mockOrganisationRepository.save).toHaveBeenCalledWith(
        freshOrganisation,
      );
      expect(result.name).toBe("Test Organisation");
    });
  });

  describe("remove", () => {
    it("should remove organisation and invalidate cache", async () => {
      const freshOrganisation = {
        ...mockOrganisation,
        name: "Test Organisation",
      };
      mockCacheManager.get.mockResolvedValue(undefined);
      mockOrganisationRepository.findOne.mockResolvedValue(freshOrganisation);
      mockOrganisationRepository.remove.mockResolvedValue(freshOrganisation);
      mockCacheManager.del.mockResolvedValue(undefined);

      const result = await service.remove("org-1");

      expect(mockOrganisationRepository.remove).toHaveBeenCalledWith(
        freshOrganisation,
      );
      expect(mockCacheManager.del).toHaveBeenCalledWith("organisation:org-1");
      expect(mockAuditService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "organisation.deleted",
          actorType: "user",
          resourceType: "organisation",
          resourceId: "org-1",
          organisationId: "org-1",
          beforeState: expect.objectContaining({
            id: "org-1",
            name: "Test Organisation",
          }),
          afterState: null,
        }),
      );
      expect(result).toEqual({ message: "Organisation removed successfully" });
    });
  });

  describe("addUser", () => {
    it("should add user to organisation", async () => {
      const email = "user@example.com";
      const userIdToAdd = "user-2";
      const invitedById = "user-1";
      const defaultRole = { id: "role-member", name: "Member" };

      mockCacheManager.get.mockResolvedValue(undefined);
      mockOrganisationRepository.findOne.mockResolvedValue(mockOrganisation);
      mockUserRepository.findOne.mockResolvedValue({ id: userIdToAdd });

      const mockRelationQueryBuilder = {
        relation: jest.fn().mockReturnValue({
          of: jest.fn().mockReturnValue({
            add: jest.fn().mockResolvedValue(undefined),
          }),
        }),
      };

      const mockIsUserInOrgQueryBuilder = {
        innerJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getExists: jest.fn().mockResolvedValue(false),
      };

      const mockAddUserMembershipQueryBuilder = {
        innerJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getExists: jest.fn().mockResolvedValue(false),
      };

      mockOrganisationRbacService.getDefaultOrganisationRole.mockResolvedValue(
        defaultRole,
      );
      mockOrganisationRbacService.assignRole.mockResolvedValue(undefined);

      mockOrganisationRepository.createQueryBuilder
        .mockReturnValueOnce(mockIsUserInOrgQueryBuilder)
        .mockReturnValueOnce(mockAddUserMembershipQueryBuilder)
        .mockReturnValueOnce(mockRelationQueryBuilder);
      mockOrganisationRbacService.getUserRole.mockResolvedValue(defaultRole);

      const result = await service.addUser("org-1", email, invitedById);

      expect(mockUserRepository.findOne).toHaveBeenCalledWith({
        where: { email: email.trim().toLowerCase() },
        select: ["id"],
      });
      expect(mockIsUserInOrgQueryBuilder.getExists).toHaveBeenCalled();
      expect(mockAddUserMembershipQueryBuilder.getExists).toHaveBeenCalled();
      expect(
        mockOrganisationRbacService.getDefaultOrganisationRole,
      ).toHaveBeenCalledWith("org-1");
      expect(mockOrganisationRbacService.assignRole).toHaveBeenCalledWith(
        "org-1",
        userIdToAdd,
        "role-member",
      );
      expect(mockOrganisationRbacService.getUserRole).toHaveBeenCalledWith(
        "org-1",
        userIdToAdd,
      );
      expect(mockAuditService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "organisation.user.added",
          actorId: invitedById,
          actorType: "user",
          resourceType: "organisation_membership",
          resourceId: userIdToAdd,
          organisationId: "org-1",
          beforeState: expect.objectContaining({
            isMember: false,
            email: email.trim().toLowerCase(),
            userId: userIdToAdd,
          }),
          afterState: expect.objectContaining({
            isMember: true,
            email: email.trim().toLowerCase(),
            userId: userIdToAdd,
            roleId: defaultRole.id,
            roleName: defaultRole.name,
          }),
        }),
      );
      expect(result).toEqual({
        message: "User added to organisation successfully",
      });
    });

    it("should create invitation when user not found by email", async () => {
      const email = "nonexistent@example.com";
      const invitedById = "user-1";
      const token = "invite-token";
      const inviter = {
        id: invitedById,
        email: "inviter@example.com",
        name: "Inviter",
      };

      mockCacheManager.get.mockResolvedValue(undefined);
      mockOrganisationRepository.findOne.mockResolvedValue(mockOrganisation);
      mockUserRepository.findOne.mockResolvedValue(null);
      mockOrganisationInvitationService.createInvite.mockResolvedValue({
        token,
        isResend: false,
      });
      mockBetterAuthUserService.getUserById.mockResolvedValue(inviter);
      mockConfigService.get.mockReturnValue("http://localhost:3000");
      mockMailerService.sendOrganisationInvite.mockResolvedValue(undefined);

      const result = await service.addUser("org-1", email, invitedById);

      expect(mockUserRepository.findOne).toHaveBeenCalledWith({
        where: { email: email.trim().toLowerCase() },
        select: ["id"],
      });
      expect(
        mockOrganisationInvitationService.createInvite,
      ).toHaveBeenCalledWith(
        "org-1",
        email.trim().toLowerCase(),
        invitedById,
        undefined,
      );
      expect(mockBetterAuthUserService.getUserById).toHaveBeenCalledWith(
        invitedById,
      );
      expect(mockMailerService.sendOrganisationInvite).toHaveBeenCalled();
      expect(mockAuditService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "organisation.user.invited",
          actorId: invitedById,
          actorType: "user",
          resourceType: "organisation_invitation",
          organisationId: "org-1",
          beforeState: expect.objectContaining({
            isMember: false,
            email: email.trim().toLowerCase(),
            userId: null,
          }),
          afterState: expect.objectContaining({
            isMember: false,
            email: email.trim().toLowerCase(),
            userId: null,
            invitationSent: true,
            isResend: false,
          }),
          metadata: expect.objectContaining({
            organisationId: "org-1",
            email: email.trim().toLowerCase(),
            actionType: "invitation_sent",
            isResend: false,
          }),
        }),
      );
      expect(result).toEqual({
        message: "Invitation sent successfully",
        invited: true,
      });
    });

    it("should throw BadRequestException when user is already a member", async () => {
      const email = "user@example.com";
      const userIdToAdd = "user-2";
      const invitedById = "user-1";
      mockCacheManager.get.mockResolvedValue(undefined);
      mockOrganisationRepository.findOne.mockResolvedValue(mockOrganisation);
      mockUserRepository.findOne.mockResolvedValue({ id: userIdToAdd });

      const mockIsUserInOrgQueryBuilder = {
        innerJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getExists: jest.fn().mockResolvedValue(true),
      };

      const mockAddUserMembershipQueryBuilder = {
        innerJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getExists: jest.fn().mockResolvedValue(true),
      };

      mockOrganisationRepository.createQueryBuilder
        .mockReturnValueOnce(mockIsUserInOrgQueryBuilder)
        .mockReturnValueOnce(mockAddUserMembershipQueryBuilder);

      await expect(
        service.addUser("org-1", email, invitedById),
      ).rejects.toThrow(
        formatError(ERROR_MESSAGES.USER_ALREADY_MEMBER, "organisation"),
      );
    });
  });

  describe("removeUser", () => {
    it("should remove user from organisation", async () => {
      const email = "user@example.com";
      const userIdToRemove = "user-2";
      const userRole = { id: "role-member", name: "Member" };
      mockCacheManager.get.mockResolvedValue(undefined);
      mockOrganisationRepository.findOne.mockResolvedValue(mockOrganisation);
      mockUserRepository.findOne.mockResolvedValue({ id: userIdToRemove });
      mockOrganisationRbacService.getUserRole.mockResolvedValue(userRole);
      const mockQueryBuilder = {
        relation: jest.fn().mockReturnValue({
          of: jest.fn().mockReturnValue({
            remove: jest.fn().mockResolvedValue(undefined),
          }),
        }),
      };
      mockOrganisationRepository.createQueryBuilder.mockReturnValue(
        mockQueryBuilder,
      );

      const result = await service.removeUser("org-1", email);

      expect(mockUserRepository.findOne).toHaveBeenCalledWith({
        where: { email: email.trim().toLowerCase() },
        select: ["id"],
      });
      expect(mockOrganisationRbacService.getUserRole).toHaveBeenCalledWith(
        "org-1",
        userIdToRemove,
      );
      expect(mockAuditService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "organisation.user.removed",
          actorType: "user",
          resourceType: "organisation_membership",
          resourceId: userIdToRemove,
          organisationId: "org-1",
          beforeState: expect.objectContaining({
            isMember: true,
            email: email.trim().toLowerCase(),
            userId: userIdToRemove,
            roleId: userRole.id,
            roleName: userRole.name,
          }),
          afterState: null,
          metadata: expect.objectContaining({
            organisationId: "org-1",
            userId: userIdToRemove,
            email: email.trim().toLowerCase(),
            removedRoleId: userRole.id,
          }),
        }),
      );
      expect(result).toEqual({
        message: "User removed from organisation successfully",
      });
    });

    it("should throw NotFoundException when user not found by email", async () => {
      const email = "nonexistent@example.com";
      mockCacheManager.get.mockResolvedValue(undefined);
      mockOrganisationRepository.findOne.mockResolvedValue(mockOrganisation);
      mockUserRepository.findOne.mockResolvedValue(null);

      await expect(service.removeUser("org-1", email)).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.removeUser("org-1", email)).rejects.toThrow(
        formatError(ERROR_MESSAGES.USER_NOT_FOUND_BY_EMAIL, email),
      );
    });
  });

  describe("findUserIdByEmail", () => {
    it("should return user ID when user exists", async () => {
      const email = "user@example.com";
      mockUserRepository.findOne.mockResolvedValue({ id: "user-1" });

      const result = await (service as any).findUserIdByEmail(email);

      expect(result).toBe("user-1");
    });

    it("should return null when user does not exist", async () => {
      const email = "nonexistent@example.com";
      mockUserRepository.findOne.mockResolvedValue(null);

      const result = await (service as any).findUserIdByEmail(email);

      expect(result).toBeNull();
    });

    it("should return null and log warning on error", async () => {
      const email = "user@example.com";
      mockUserRepository.findOne.mockRejectedValue(new Error("Database error"));

      const result = await (service as any).findUserIdByEmail(email);

      expect(result).toBeNull();
    });
  });

  describe("getUsersWithRoles", () => {
    const mockRoleResponseDto: RoleResponseDto = {
      id: "role-1",
      name: "Organisation Admin",
      description: "Admin role",
      permissions: ["*"],
      isSystemRole: true,
      isInstanceLevel: false,
      organisationId: "org-1",
      projectId: null,
      canDelete: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    it("should return users with their roles", async () => {
      const organisationId = "org-1";
      const mockUsers = [
        { id: "user-1", email: "user1@example.com", name: "User One" },
        { id: "user-2", email: "user2@example.com", name: "User Two" },
      ];

      mockOrganisationRepository.findOne.mockResolvedValue(mockOrganisation);
      mockOrganisationRepository.manager.query.mockResolvedValue([
        { user_id: "user-1" },
        { user_id: "user-2" },
      ]);
      mockBetterAuthUserService.getUsersByIds.mockResolvedValue(mockUsers);
      mockOrganisationRbacService.getUserRole
        .mockResolvedValueOnce(mockRoleResponseDto)
        .mockResolvedValueOnce(null);

      const result = await service.getUsersWithRoles(organisationId);

      expect(mockOrganisationRepository.findOne).toHaveBeenCalled();
      expect(mockOrganisationRepository.manager.query).toHaveBeenCalledWith(
        expect.stringContaining("SELECT user_id FROM organisation_users"),
        [organisationId],
      );
      expect(mockBetterAuthUserService.getUsersByIds).toHaveBeenCalledWith([
        "user-1",
        "user-2",
      ]);
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        id: "user-1",
        email: "user1@example.com",
        name: "User One",
        role: mockRoleResponseDto,
      });
      expect(result[1]).toEqual({
        id: "user-2",
        email: "user2@example.com",
        name: "User Two",
        role: null,
      });
    });

    it("should return empty array when no users in organization", async () => {
      const organisationId = "org-1";

      mockOrganisationRepository.findOne.mockResolvedValue(mockOrganisation);
      mockOrganisationRepository.manager.query.mockResolvedValue([]);

      const result = await service.getUsersWithRoles(organisationId);

      expect(result).toEqual([]);
      expect(mockBetterAuthUserService.getUsersByIds).not.toHaveBeenCalled();
    });
  });
});
