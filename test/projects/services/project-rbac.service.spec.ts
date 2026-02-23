import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { NotFoundException } from "@nestjs/common";
import { ProjectRbacService } from "../../../src/projects/services/project-rbac.service";
import { Project } from "../../../src/projects/entities/project.entity";
import { RbacService } from "../../../src/rbac/services/rbac.service";
import { BetterAuthUserService } from "../../../src/auth/services/better-auth-user.service";
import { RbacAssignmentService } from "../../../src/rbac/services/rbac-assignment.service";
import { RbacMembershipService } from "../../../src/rbac/services/rbac-membership.service";
import {
  ERROR_MESSAGES,
  formatError,
} from "../../../src/common/constants/error-messages.constants";
import { Role } from "../../../src/rbac/entities/role.entity";
import { Organisation } from "../../../src/organisations/entities/organisation.entity";
import { AuditService } from "../../../src/audit/audit.service";

describe("ProjectRbacService", () => {
  let service: ProjectRbacService;
  let repository: Repository<Project>;
  let rbacService: RbacService;
  let betterAuthUserService: BetterAuthUserService;
  let assignmentService: RbacAssignmentService;
  let membershipService: RbacMembershipService;
  let mockAuditService: { record: jest.Mock };

  const mockRepository = {
    findOne: jest.fn(),
    createQueryBuilder: jest.fn(),
  };

  const mockRbacService = {
    getUserProjectRole: jest.fn(),
    getUserProjectRoles: jest.fn(),
    getUserInstanceRole: jest.fn(),
    getDefaultProjectRole: jest.fn(),
  };

  const mockBetterAuthUserService = {
    getUserIdByEmail: jest.fn(),
    getUsersByIds: jest.fn(),
  };

  const mockAssignmentService = {
    assignRole: jest.fn(),
    removeRole: jest.fn(),
  };

  const mockMembershipService = {
    getUsersWithProjectAccess: jest.fn(),
  };

  mockAuditService = { record: jest.fn().mockResolvedValue(undefined) };

  const mockProject: Project = {
    id: "project-1",
    name: "Test Project",
    description: "Test Description",
    createdAt: new Date(),
    updatedAt: new Date(),
    createdById: "user-1",
    organisationId: "org-1",
    organisation: {} as Organisation,
    users: [],
    datasets: [],
  } as Project;

  const mockRole: Role = {
    id: "role-1",
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
        ProjectRbacService,
        {
          provide: getRepositoryToken(Project),
          useValue: mockRepository,
        },
        {
          provide: RbacService,
          useValue: mockRbacService,
        },
        {
          provide: BetterAuthUserService,
          useValue: mockBetterAuthUserService,
        },
        {
          provide: RbacAssignmentService,
          useValue: mockAssignmentService,
        },
        {
          provide: RbacMembershipService,
          useValue: mockMembershipService,
        },
        { provide: AuditService, useValue: mockAuditService },
      ],
    }).compile();

    service = module.get<ProjectRbacService>(ProjectRbacService);
    repository = module.get<Repository<Project>>(getRepositoryToken(Project));
    rbacService = module.get<RbacService>(RbacService);
    betterAuthUserService = module.get<BetterAuthUserService>(
      BetterAuthUserService,
    );
    assignmentService = module.get<RbacAssignmentService>(
      RbacAssignmentService,
    );
    membershipService = module.get<RbacMembershipService>(
      RbacMembershipService,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("assignProjectRole", () => {
    it("should assign role when user has no existing role", async () => {
      mockRbacService.getUserProjectRole.mockResolvedValue(null);
      mockAssignmentService.assignRole.mockResolvedValue(undefined);

      await service.assignProjectRole("project-1", "user-1", "role-1");

      expect(mockRbacService.getUserProjectRole).toHaveBeenCalledWith(
        "project-1",
        "user-1",
      );

      expect(mockAssignmentService.removeRole).not.toHaveBeenCalled();

      expect(mockAssignmentService.assignRole).toHaveBeenCalledWith(
        "user-1",
        "role-1",
      );

      expect(mockAuditService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "project_role.assigned",
          resourceType: "project_role",
          resourceId: "project-1",
          projectId: "project-1",
          beforeState: {
            userId: "user-1",
            previousRoleId: null,
            previousRoleName: null,
          },
          afterState: { userId: "user-1", roleId: "role-1" },
          metadata: expect.objectContaining({ projectId: "project-1" }),
        }),
      );
    });

    it("should replace existing role when user has different role", async () => {
      const existingRole = { ...mockRole, id: "role-old" };
      mockRbacService.getUserProjectRole.mockResolvedValue(existingRole);
      mockAssignmentService.removeRole.mockResolvedValue(undefined);
      mockAssignmentService.assignRole.mockResolvedValue(undefined);

      await service.assignProjectRole("project-1", "user-1", "role-1");

      expect(mockAssignmentService.removeRole).toHaveBeenCalledWith(
        "user-1",
        "role-old",
      );

      expect(mockAssignmentService.assignRole).toHaveBeenCalledWith(
        "user-1",
        "role-1",
      );

      expect(mockAuditService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "project_role.assigned",
          beforeState: {
            userId: "user-1",
            previousRoleId: "role-old",
            previousRoleName: "Member",
          },
          afterState: { userId: "user-1", roleId: "role-1" },
        }),
      );
    });

    it("should not remove role when assigning same role", async () => {
      mockRbacService.getUserProjectRole.mockResolvedValue(mockRole);
      mockAssignmentService.assignRole.mockResolvedValue(undefined);

      await service.assignProjectRole("project-1", "user-1", "role-1");

      expect(mockAssignmentService.removeRole).not.toHaveBeenCalled();

      expect(mockAssignmentService.assignRole).toHaveBeenCalledWith(
        "user-1",
        "role-1",
      );

      expect(mockAuditService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "project_role.assigned",
          beforeState: {
            userId: "user-1",
            previousRoleId: "role-1",
            previousRoleName: "Member",
          },
          afterState: { userId: "user-1", roleId: "role-1" },
        }),
      );
    });
  });

  describe("assignProjectRoleByEmail", () => {
    it("should assign role by email successfully", async () => {
      mockBetterAuthUserService.getUserIdByEmail.mockResolvedValue("user-1");
      mockRbacService.getUserProjectRole.mockResolvedValue(null);
      mockAssignmentService.assignRole.mockResolvedValue(undefined);

      await service.assignProjectRoleByEmail(
        "project-1",
        "user@example.com",
        "role-1",
      );

      expect(mockBetterAuthUserService.getUserIdByEmail).toHaveBeenCalledWith(
        "user@example.com",
      );
      expect(mockRbacService.getUserProjectRole).toHaveBeenCalledWith(
        "project-1",
        "user-1",
      );
      expect(mockAssignmentService.assignRole).toHaveBeenCalledWith(
        "user-1",
        "role-1",
      );
    });

    it("should throw NotFoundException when email not found", async () => {
      mockBetterAuthUserService.getUserIdByEmail.mockResolvedValue(null);

      await expect(
        service.assignProjectRoleByEmail(
          "project-1",
          "nonexistent@example.com",
          "role-1",
        ),
      ).rejects.toThrow(NotFoundException);
      await expect(
        service.assignProjectRoleByEmail(
          "project-1",
          "nonexistent@example.com",
          "role-1",
        ),
      ).rejects.toThrow(
        formatError(
          ERROR_MESSAGES.USER_NOT_FOUND_BY_EMAIL,
          "nonexistent@example.com",
        ),
      );
      expect(mockRbacService.getUserProjectRole).not.toHaveBeenCalled();
    });
  });

  describe("removeProjectRole", () => {
    it("should remove role when user has role", async () => {
      mockRbacService.getUserProjectRole.mockResolvedValue(mockRole);
      mockAssignmentService.removeRole.mockResolvedValue(undefined);

      await service.removeProjectRole("project-1", "user-1");

      expect(mockRbacService.getUserProjectRole).toHaveBeenCalledWith(
        "project-1",
        "user-1",
      );
      expect(mockAssignmentService.removeRole).toHaveBeenCalledWith(
        "user-1",
        "role-1",
      );

      expect(mockAuditService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "project_role.removed",
          resourceType: "project_role",
          resourceId: "project-1",
          projectId: "project-1",
          beforeState: {
            userId: "user-1",
            roleId: "role-1",
            roleName: "Member",
          },
          afterState: null,
          metadata: expect.objectContaining({ projectId: "project-1" }),
        }),
      );
    });

    it("should not remove role when user has no role", async () => {
      mockRbacService.getUserProjectRole.mockResolvedValue(null);

      await service.removeProjectRole("project-1", "user-1");

      expect(mockAssignmentService.removeRole).not.toHaveBeenCalled();

      expect(mockAuditService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "project_role.removed",
          beforeState: { userId: "user-1", roleId: null, roleName: null },
          afterState: null,
        }),
      );
    });
  });

  describe("getUserProjectRole", () => {
    it("should return role DTO when user has role", async () => {
      mockRepository.findOne.mockResolvedValue(mockProject);
      mockRbacService.getUserProjectRole.mockResolvedValue(mockRole);

      const result = await service.getUserProjectRole(
        "org-1",
        "project-1",
        "user-1",
      );

      expect(mockRepository.findOne).toHaveBeenCalledWith({
        where: { id: "project-1", organisationId: "org-1" },
      });
      expect(mockRbacService.getUserProjectRole).toHaveBeenCalledWith(
        "project-1",
        "user-1",
      );
      expect(result).toMatchObject({
        id: mockRole.id,
        name: mockRole.name,
      });
    });

    it("should return null when user has no role", async () => {
      mockRepository.findOne.mockResolvedValue(mockProject);
      mockRbacService.getUserProjectRole.mockResolvedValue(null);

      const result = await service.getUserProjectRole(
        "org-1",
        "project-1",
        "user-1",
      );

      expect(result).toBeNull();
    });

    it("should throw NotFoundException when project not found", async () => {
      mockRepository.findOne.mockResolvedValue(null);

      await expect(
        service.getUserProjectRole("org-1", "project-1", "user-1"),
      ).rejects.toThrow(NotFoundException);
      expect(mockRbacService.getUserProjectRole).not.toHaveBeenCalled();
    });
  });

  describe("getDefaultProjectRole", () => {
    it("should return default project role", async () => {
      mockRbacService.getDefaultProjectRole.mockResolvedValue(mockRole);

      const result = await service.getDefaultProjectRole("org-1", "project-1");

      expect(mockRbacService.getDefaultProjectRole).toHaveBeenCalledWith(
        "org-1",
        "project-1",
      );
      expect(result).toEqual(mockRole);
    });
  });

  describe("getUsersWithRoles", () => {
    it("should return users with their roles", async () => {
      const mockQueryBuilder = {
        innerJoin: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue([{ id: "user-2" }]),
      };
      mockRepository.findOne.mockResolvedValue(mockProject);
      mockRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);
      mockMembershipService.getUsersWithProjectAccess.mockResolvedValue([
        "user-3",
      ]);
      mockBetterAuthUserService.getUsersByIds.mockResolvedValue([
        { id: "user-1", email: "user1@example.com", name: "User 1" },
        { id: "user-2", email: "user2@example.com", name: "User 2" },
        { id: "user-3", email: "user3@example.com", name: "User 3" },
      ]);
      mockRbacService.getUserInstanceRole.mockResolvedValue(null);
      mockRbacService.getUserProjectRoles.mockResolvedValue([mockRole]);

      const result = await service.getUsersWithRoles("org-1", "project-1");

      expect(mockRepository.findOne).toHaveBeenCalledWith({
        where: { id: "project-1", organisationId: "org-1" },
      });
      expect(mockBetterAuthUserService.getUsersByIds).toHaveBeenCalledWith([
        "user-1",
        "user-2",
        "user-3",
      ]);
      expect(result).toHaveLength(3);
      expect(result[0]).toMatchObject({
        id: "user-1",
        email: "user1@example.com",
        name: "User 1",
      });
      expect(result[0].roles).toHaveLength(1);
    });

    it("should include instance roles when present", async () => {
      const instanceRole = {
        ...mockRole,
        id: "role-instance",
        name: "Owner",
        isInstanceLevel: true,
        organisationId: null,
        projectId: null,
        get scope() {
          return "instance" as any;
        },
      } as Role;
      const mockQueryBuilder = {
        innerJoin: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue([]),
      };
      mockRepository.findOne.mockResolvedValue(mockProject);
      mockRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);
      mockMembershipService.getUsersWithProjectAccess.mockResolvedValue([]);
      mockBetterAuthUserService.getUsersByIds.mockResolvedValue([
        { id: "user-1", email: "user1@example.com", name: "User 1" },
      ]);
      mockRbacService.getUserInstanceRole.mockResolvedValue(instanceRole);
      mockRbacService.getUserProjectRoles.mockResolvedValue([]);

      const result = await service.getUsersWithRoles("org-1", "project-1");

      expect(result[0].roles).toHaveLength(1);
      expect(result[0].roles[0].name).toBe("Owner");
    });

    it("should throw NotFoundException when project not found", async () => {
      mockRepository.findOne.mockResolvedValue(null);

      await expect(
        service.getUsersWithRoles("org-1", "project-1"),
      ).rejects.toThrow(NotFoundException);
      expect(mockRepository.createQueryBuilder).not.toHaveBeenCalled();
    });
  });
});
