import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import {
  NotFoundException,
  ForbiddenException,
  UnauthorizedException,
} from "@nestjs/common";
import { ProjectMembershipService } from "../../../src/projects/services/project-membership.service";
import { Project } from "../../../src/projects/entities/project.entity";
import { ProjectManagementService } from "../../../src/projects/services/project-management.service";
import { BetterAuthUserService } from "../../../src/auth/services/better-auth-user.service";
import { OrganisationsService } from "../../../src/organisations/services/organisations.service";
import { RbacMembershipService } from "../../../src/rbac/services/rbac-membership.service";
import { RbacAssignmentService } from "../../../src/rbac/services/rbac-assignment.service";
import { RolesService } from "../../../src/rbac/services/roles.service";
import { ProjectRbacService } from "../../../src/projects/services/project-rbac.service";
import {
  ERROR_MESSAGES,
  formatError,
} from "../../../src/common/constants/error-messages.constants";
import { Role } from "../../../src/rbac/entities/role.entity";
import { Organisation } from "../../../src/organisations/entities/organisation.entity";
import { AuditService } from "../../../src/audit/audit.service";

describe("ProjectMembershipService", () => {
  let service: ProjectMembershipService;
  let repository: Repository<Project>;
  let projectManagementService: ProjectManagementService;
  let betterAuthUserService: BetterAuthUserService;
  let organisationsService: OrganisationsService;
  let membershipService: RbacMembershipService;
  let assignmentService: RbacAssignmentService;
  let rolesService: RolesService;
  let projectRbacService: ProjectRbacService;
  let mockAuditService: { record: jest.Mock };

  const mockRepository = {
    createQueryBuilder: jest.fn(),
  };

  const mockProjectManagementService = {
    getByIdAndOrganisationOrThrow: jest.fn(),
  };

  const mockBetterAuthUserService = {
    getUserIdByEmail: jest.fn(),
    getUsersNotInList: jest.fn(),
  };

  const mockOrganisationsService = {
    isUserInOrganisation: jest.fn(),
  };

  const mockMembershipService = {
    isProjectMember: jest.fn(),
  };

  const mockAssignmentService = {
    assignRole: jest.fn(),
  };

  const mockRolesService = {
    findOne: jest.fn(),
  };

  const mockProjectRbacService = {
    getDefaultProjectRole: jest.fn(),
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

  const mockDefaultRole = {
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

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProjectMembershipService,
        {
          provide: getRepositoryToken(Project),
          useValue: mockRepository,
        },
        {
          provide: ProjectManagementService,
          useValue: mockProjectManagementService,
        },
        {
          provide: BetterAuthUserService,
          useValue: mockBetterAuthUserService,
        },
        {
          provide: OrganisationsService,
          useValue: mockOrganisationsService,
        },
        {
          provide: RbacMembershipService,
          useValue: mockMembershipService,
        },
        {
          provide: RbacAssignmentService,
          useValue: mockAssignmentService,
        },
        {
          provide: RolesService,
          useValue: mockRolesService,
        },
        {
          provide: ProjectRbacService,
          useValue: mockProjectRbacService,
        },
        { provide: AuditService, useValue: mockAuditService },
      ],
    }).compile();

    service = module.get<ProjectMembershipService>(ProjectMembershipService);
    repository = module.get<Repository<Project>>(getRepositoryToken(Project));
    projectManagementService = module.get<ProjectManagementService>(
      ProjectManagementService,
    );
    betterAuthUserService = module.get<BetterAuthUserService>(
      BetterAuthUserService,
    );
    organisationsService =
      module.get<OrganisationsService>(OrganisationsService);
    membershipService = module.get<RbacMembershipService>(
      RbacMembershipService,
    );
    assignmentService = module.get<RbacAssignmentService>(
      RbacAssignmentService,
    );
    rolesService = module.get<RolesService>(RolesService);
    projectRbacService = module.get<ProjectRbacService>(ProjectRbacService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("findUsersNotInProject", () => {
    it("should return users not in project", async () => {
      const mockQueryBuilder = {
        innerJoin: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue([]),
      };
      mockRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);
      mockProjectManagementService.getByIdAndOrganisationOrThrow.mockResolvedValue(
        mockProject,
      );
      mockBetterAuthUserService.getUsersNotInList.mockResolvedValue([
        { id: "user-2", email: "user2@example.com", name: "User 2" },
        { id: "user-3", email: "user3@example.com", name: "User 3" },
      ]);

      const result = await service.findUsersNotInProject("org-1", "project-1");

      expect(
        mockProjectManagementService.getByIdAndOrganisationOrThrow,
      ).toHaveBeenCalledWith("org-1", "project-1");
      expect(mockRepository.createQueryBuilder).toHaveBeenCalledWith("project");
      expect(mockBetterAuthUserService.getUsersNotInList).toHaveBeenCalledWith([
        "user-1",
      ]);
      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({
        id: "user-2",
        email: "user2@example.com",
        name: "User 2",
      });
    });

    it("should include creator in exclusion list", async () => {
      const mockQueryBuilder = {
        innerJoin: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue([{ id: "user-2" }]),
      };
      mockRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);
      mockProjectManagementService.getByIdAndOrganisationOrThrow.mockResolvedValue(
        mockProject,
      );
      mockBetterAuthUserService.getUsersNotInList.mockResolvedValue([]);

      await service.findUsersNotInProject("org-1", "project-1");

      expect(mockBetterAuthUserService.getUsersNotInList).toHaveBeenCalledWith([
        "user-1",
        "user-2",
      ]);
    });

    it("should handle project with no members", async () => {
      const mockQueryBuilder = {
        innerJoin: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue([]),
      };
      mockRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);
      mockProjectManagementService.getByIdAndOrganisationOrThrow.mockResolvedValue(
        mockProject,
      );
      mockBetterAuthUserService.getUsersNotInList.mockResolvedValue([
        { id: "user-2", email: "user2@example.com", name: "User 2" },
      ]);

      const result = await service.findUsersNotInProject("org-1", "project-1");

      expect(result).toHaveLength(1);
    });
  });

  describe("inviteUser", () => {
    it("should invite user successfully with default role", async () => {
      const mockRelationQueryBuilder = {
        of: jest.fn().mockReturnThis(),
        add: jest.fn().mockResolvedValue(undefined),
      };
      mockRepository.createQueryBuilder.mockReturnValue({
        relation: jest.fn().mockReturnValue(mockRelationQueryBuilder),
      });
      mockProjectManagementService.getByIdAndOrganisationOrThrow.mockResolvedValue(
        mockProject,
      );
      mockBetterAuthUserService.getUserIdByEmail.mockResolvedValue("user-2");
      mockOrganisationsService.isUserInOrganisation.mockResolvedValue(true);
      mockMembershipService.isProjectMember.mockResolvedValue(false);
      mockProjectRbacService.getDefaultProjectRole.mockResolvedValue(
        mockDefaultRole,
      );
      mockAssignmentService.assignRole.mockResolvedValue(undefined);

      const result = await service.inviteUser(
        "org-1",
        "project-1",
        "user2@example.com",
        undefined,
        "user-1",
      );

      expect(mockBetterAuthUserService.getUserIdByEmail).toHaveBeenCalledWith(
        "user2@example.com",
      );
      expect(
        mockOrganisationsService.isUserInOrganisation,
      ).toHaveBeenCalledWith("user-2", "org-1");
      expect(mockMembershipService.isProjectMember).toHaveBeenCalledWith(
        "project-1",
        "user-2",
      );

      expect(mockProjectRbacService.getDefaultProjectRole).toHaveBeenCalledWith(
        "org-1",
        "project-1",
      );
      expect(mockRolesService.findOne).not.toHaveBeenCalled();

      expect(mockAssignmentService.assignRole).toHaveBeenCalledWith(
        "user-2",
        "role-member",
      );

      expect(mockRelationQueryBuilder.add).toHaveBeenCalledWith("user-2");

      expect(result).toEqual({ message: "User invited successfully" });

      expect(mockAuditService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "project_member.added",
          actorId: "user-1",
          resourceType: "project_member",
          resourceId: "project-1",
          organisationId: "org-1",
          projectId: "project-1",
          beforeState: { wasMember: false },
          afterState: expect.objectContaining({
            userId: "user-2",
            email: "user2@example.com",
            roleId: "role-member",
            roleName: "Member",
          }),
          metadata: expect.objectContaining({
            projectId: "project-1",
            organisationId: "org-1",
            invitedById: "user-1",
            inviteType: "member_added",
          }),
        }),
      );
    });

    it("should invite user successfully with specified role", async () => {
      const customRole = {
        ...mockDefaultRole,
        id: "role-custom",
        name: "Custom Role",
      } as Role;
      const mockRelationQueryBuilder = {
        of: jest.fn().mockReturnThis(),
        add: jest.fn().mockResolvedValue(undefined),
      };
      mockRepository.createQueryBuilder.mockReturnValue({
        relation: jest.fn().mockReturnValue(mockRelationQueryBuilder),
      });
      mockProjectManagementService.getByIdAndOrganisationOrThrow.mockResolvedValue(
        mockProject,
      );
      mockBetterAuthUserService.getUserIdByEmail.mockResolvedValue("user-2");
      mockOrganisationsService.isUserInOrganisation.mockResolvedValue(true);
      mockMembershipService.isProjectMember.mockResolvedValue(false);
      mockRolesService.findOne.mockResolvedValue(customRole);
      mockAssignmentService.assignRole.mockResolvedValue(undefined);

      const result = await service.inviteUser(
        "org-1",
        "project-1",
        "user2@example.com",
        "role-custom",
        "user-1",
      );

      expect(mockRolesService.findOne).toHaveBeenCalledWith("role-custom");
      expect(
        mockProjectRbacService.getDefaultProjectRole,
      ).not.toHaveBeenCalled();

      expect(mockAssignmentService.assignRole).toHaveBeenCalledWith(
        "user-2",
        "role-custom",
      );

      expect(mockRelationQueryBuilder.add).toHaveBeenCalledWith("user-2");

      expect(result).toEqual({ message: "User invited successfully" });

      expect(mockAuditService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "project_member.added",
          afterState: expect.objectContaining({
            userId: "user-2",
            email: "user2@example.com",
            roleId: "role-custom",
            roleName: "Custom Role",
          }),
        }),
      );
    });

    it("should throw NotFoundException when user email not found", async () => {
      mockProjectManagementService.getByIdAndOrganisationOrThrow.mockResolvedValue(
        mockProject,
      );
      mockBetterAuthUserService.getUserIdByEmail.mockResolvedValue(null);

      await expect(
        service.inviteUser("org-1", "project-1", "nonexistent@example.com"),
      ).rejects.toThrow(NotFoundException);
      await expect(
        service.inviteUser("org-1", "project-1", "nonexistent@example.com"),
      ).rejects.toThrow(
        formatError(
          ERROR_MESSAGES.USER_NOT_FOUND_BY_EMAIL,
          "nonexistent@example.com",
        ),
      );
      expect(
        mockOrganisationsService.isUserInOrganisation,
      ).not.toHaveBeenCalled();
    });

    it("should throw UnauthorizedException when user not in organisation", async () => {
      mockProjectManagementService.getByIdAndOrganisationOrThrow.mockResolvedValue(
        mockProject,
      );
      mockBetterAuthUserService.getUserIdByEmail.mockResolvedValue("user-2");
      mockOrganisationsService.isUserInOrganisation.mockResolvedValue(false);

      await expect(
        service.inviteUser("org-1", "project-1", "user2@example.com"),
      ).rejects.toThrow(UnauthorizedException);
      await expect(
        service.inviteUser("org-1", "project-1", "user2@example.com"),
      ).rejects.toThrow(formatError(ERROR_MESSAGES.USER_NOT_IN_ORGANISATION));
      expect(mockMembershipService.isProjectMember).not.toHaveBeenCalled();
    });

    it("should return message when user already in project", async () => {
      mockProjectManagementService.getByIdAndOrganisationOrThrow.mockResolvedValue(
        mockProject,
      );
      mockBetterAuthUserService.getUserIdByEmail.mockResolvedValue("user-2");
      mockOrganisationsService.isUserInOrganisation.mockResolvedValue(true);
      mockMembershipService.isProjectMember.mockResolvedValue(true);

      const result = await service.inviteUser(
        "org-1",
        "project-1",
        "user2@example.com",
      );

      expect(mockRepository.createQueryBuilder).not.toHaveBeenCalled();
      expect(mockAssignmentService.assignRole).not.toHaveBeenCalled();
      expect(result).toEqual({
        message: "User is already a member of this project",
      });
    });
  });

  describe("removeUser", () => {
    it("should remove user successfully", async () => {
      const mockRelationQueryBuilder = {
        of: jest.fn().mockReturnThis(),
        remove: jest.fn().mockResolvedValue(undefined),
      };
      mockRepository.createQueryBuilder.mockReturnValue({
        relation: jest.fn().mockReturnValue(mockRelationQueryBuilder),
      });
      mockProjectManagementService.getByIdAndOrganisationOrThrow.mockResolvedValue(
        mockProject,
      );
      mockBetterAuthUserService.getUserIdByEmail.mockResolvedValue("user-2");
      mockMembershipService.isProjectMember.mockResolvedValue(true);

      const result = await service.removeUser(
        "org-1",
        "project-1",
        "user2@example.com",
        "user-1",
      );

      expect(mockBetterAuthUserService.getUserIdByEmail).toHaveBeenCalledWith(
        "user2@example.com",
      );
      expect(mockMembershipService.isProjectMember).toHaveBeenCalledWith(
        "project-1",
        "user-2",
      );
      expect(result).toEqual({ message: "User removed successfully" });

      expect(mockAuditService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "project_member.removed",
          actorId: "user-1",
          resourceType: "project_member",
          resourceId: "project-1",
          organisationId: "org-1",
          projectId: "project-1",
          beforeState: { userId: "user-2", email: "user2@example.com" },
          afterState: null,
          metadata: expect.objectContaining({
            organisationId: "org-1",
            projectId: "project-1",
            removedBy: "user-1",
          }),
        }),
      );
    });

    it("should throw ForbiddenException when trying to remove creator", async () => {
      const projectWithCreator = { ...mockProject, createdById: "user-1" };
      mockProjectManagementService.getByIdAndOrganisationOrThrow.mockResolvedValue(
        projectWithCreator,
      );
      mockBetterAuthUserService.getUserIdByEmail.mockResolvedValue("user-1");

      await expect(
        service.removeUser("org-1", "project-1", "user1@example.com"),
      ).rejects.toThrow(ForbiddenException);
      await expect(
        service.removeUser("org-1", "project-1", "user1@example.com"),
      ).rejects.toThrow(
        formatError(ERROR_MESSAGES.CANNOT_REMOVE_PROJECT_CREATOR),
      );

      expect(mockRepository.createQueryBuilder).not.toHaveBeenCalled();
      expect(mockMembershipService.isProjectMember).not.toHaveBeenCalled();
    });

    it("should return message when user not found", async () => {
      mockProjectManagementService.getByIdAndOrganisationOrThrow.mockResolvedValue(
        mockProject,
      );
      mockBetterAuthUserService.getUserIdByEmail.mockResolvedValue(null);

      const result = await service.removeUser(
        "org-1",
        "project-1",
        "nonexistent@example.com",
      );

      expect(result).toEqual({ message: "User not found" });
      expect(mockRepository.createQueryBuilder).not.toHaveBeenCalled();
    });

    it("should return message when user not a member", async () => {
      mockProjectManagementService.getByIdAndOrganisationOrThrow.mockResolvedValue(
        mockProject,
      );
      mockBetterAuthUserService.getUserIdByEmail.mockResolvedValue("user-2");
      mockMembershipService.isProjectMember.mockResolvedValue(false);

      const result = await service.removeUser(
        "org-1",
        "project-1",
        "user2@example.com",
      );

      expect(result).toEqual({
        message: "User is not a member of this project",
      });
      expect(mockRepository.createQueryBuilder).not.toHaveBeenCalled();
    });
  });
});
