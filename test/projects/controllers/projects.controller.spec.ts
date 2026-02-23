import { Test, TestingModule } from "@nestjs/testing";
import { Reflector } from "@nestjs/core";
import { ProjectsController } from "../../../src/projects/controllers/projects.controller";
import { ProjectsService } from "../../../src/projects/services/projects.service";
import { ProjectRbacService } from "../../../src/projects/services/project-rbac.service";
import { AuditService } from "../../../src/audit/audit.service";
import { CreateProjectDto } from "../../../src/projects/dto/request/create-project.dto";
import { UpdateProjectDto } from "../../../src/projects/dto/request/update-project.dto";
import {
  InviteUserDto,
  DeleteUserDto,
} from "../../../src/projects/dto/request/project-user.dto";
import { ProjectResponseDto } from "../../../src/projects/dto/response/project.dto";
import { ProjectMessageResponseDto } from "../../../src/projects/dto/response/project-message-response.dto";
import { ProjectUserWithRolesResponseDto } from "../../../src/projects/dto/response/project-user-with-roles.dto";
import { RoleResponseDto } from "../../../src/rbac/dto/response/role-response.dto";
import { AssignRoleRequestDto } from "../../../src/rbac/dto/request/assign-role-request.dto";
import { OrgPermissionGuard } from "../../../src/rbac/guards/org-permission.guard";
import { OrgProjectPermissionGuard } from "../../../src/rbac/guards/org-project-permission.guard";
import { EnterpriseLicenseGuard } from "../../../src/license/guards/enterprise-license.guard";
import { getRepositoryToken } from "@nestjs/typeorm";
import { Project } from "../../../src/projects/entities/project.entity";

jest.mock("@thallesp/nestjs-better-auth", () => ({
  Session:
    () => (target: any, propertyKey: string, parameterIndex: number) => {},
  UserSession: class UserSession {},
}));

type UserSession = {
  session: {
    id: string;
    createdAt: Date;
    updatedAt: Date;
    userId: string;
    expiresAt: Date;
    token: string;
  };
  user: {
    id: string;
    email?: string;
    name: string;
    emailVerified: boolean;
    createdAt: Date;
    updatedAt: Date;
  };
};

describe("ProjectsController", () => {
  let controller: ProjectsController;
  let projectsService: ProjectsService;
  let projectRbacService: ProjectRbacService;

  const mockProjectsService = {
    create: jest.fn(),
    findAll: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
    inviteUser: jest.fn(),
    removeUser: jest.fn(),
    findUsersNotInProject: jest.fn(),
  };

  const mockProjectRbacService = {
    assignProjectRole: jest.fn(),
    getUserProjectRole: jest.fn(),
    removeProjectRole: jest.fn(),
    getUsersWithRoles: jest.fn(),
  };

  const mockUserSession: UserSession = {
    session: {
      id: "session-1",
      createdAt: new Date(),
      updatedAt: new Date(),
      userId: "user-1",
      expiresAt: new Date(),
      token: "token-1",
    },
    user: {
      id: "user-1",
      email: "test@example.com",
      name: "Test User",
      emailVerified: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  } as any;

  const mockProjectResponse: ProjectResponseDto = {
    id: "project-1",
    name: "Test Project",
    description: "Test Description",
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProjectsController],
      providers: [
        {
          provide: ProjectsService,
          useValue: mockProjectsService,
        },
        {
          provide: ProjectRbacService,
          useValue: mockProjectRbacService,
        },
        {
          provide: AuditService,
          useValue: { record: jest.fn().mockResolvedValue(undefined) },
        },
        {
          provide: getRepositoryToken(Project),
          useValue: {
            findOne: jest.fn(),
          },
        },
      ],
    })
      .overrideGuard(OrgPermissionGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(OrgProjectPermissionGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(EnterpriseLicenseGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<ProjectsController>(ProjectsController);
    projectsService = module.get<ProjectsService>(ProjectsService);
    projectRbacService = module.get<ProjectRbacService>(ProjectRbacService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("create", () => {
    it("should create a project", async () => {
      const createDto: CreateProjectDto = {
        name: "Test Project",
        description: "Test Description",
      };
      mockProjectsService.create.mockResolvedValue(mockProjectResponse);

      const result = await controller.create(
        "org-1",
        createDto,
        mockUserSession,
      );

      expect(mockProjectsService.create).toHaveBeenCalledWith(
        "org-1",
        createDto,
        "user-1",
      );
      expect(result).toEqual(mockProjectResponse);
    });
  });

  describe("remove", () => {
    it("should remove a project", async () => {
      const deleteResponse: ProjectMessageResponseDto = {
        message: "Project deleted successfully",
      };
      mockProjectsService.remove.mockResolvedValue(deleteResponse);

      const result = await controller.remove(
        "org-1",
        "project-1",
        mockUserSession,
      );

      expect(mockProjectsService.remove).toHaveBeenCalledWith(
        "org-1",
        "project-1",
        mockUserSession?.user?.id,
      );
      expect(result).toEqual(deleteResponse);
    });
  });

  describe("update", () => {
    it("should update a project", async () => {
      const updateDto: UpdateProjectDto = {
        name: "Updated Project",
      };
      const updatedProject: ProjectResponseDto = {
        ...mockProjectResponse,
        name: "Updated Project",
      };
      mockProjectsService.update.mockResolvedValue(updatedProject);

      const result = await controller.update(
        "org-1",
        "project-1",
        updateDto,
        mockUserSession,
      );

      expect(mockProjectsService.update).toHaveBeenCalledWith(
        "org-1",
        "project-1",
        updateDto,
        "user-1",
      );
      expect(result).toEqual(updatedProject);
    });
  });

  describe("inviteUser", () => {
    it("should invite a user to a project", async () => {
      const inviteUserDto: InviteUserDto = {
        email: "user2@example.com",
        roleId: "role-1",
      };
      const inviteResponse: ProjectMessageResponseDto = {
        message: "User invited successfully",
      };
      mockProjectsService.inviteUser.mockResolvedValue(inviteResponse);

      const result = await controller.inviteUser(
        "org-1",
        "project-1",
        inviteUserDto,
        mockUserSession,
      );

      expect(mockProjectsService.inviteUser).toHaveBeenCalledWith(
        "org-1",
        "project-1",
        "user2@example.com",
        "role-1",
        mockUserSession?.user?.id,
      );
      expect(result).toEqual(inviteResponse);
    });

    it("should invite user without roleId", async () => {
      const inviteUserDto: InviteUserDto = {
        email: "user2@example.com",
      };
      const inviteResponse: ProjectMessageResponseDto = {
        message: "User invited successfully",
      };
      mockProjectsService.inviteUser.mockResolvedValue(inviteResponse);

      const result = await controller.inviteUser(
        "org-1",
        "project-1",
        inviteUserDto,
        mockUserSession,
      );

      expect(mockProjectsService.inviteUser).toHaveBeenCalledWith(
        "org-1",
        "project-1",
        "user2@example.com",
        undefined,
        mockUserSession?.user?.id,
      );
      expect(result).toEqual(inviteResponse);
    });
  });

  describe("removeUser", () => {
    it("should remove a user from a project", async () => {
      const deleteUserDto: DeleteUserDto = {
        email: "user2@example.com",
      };
      const removeResponse: ProjectMessageResponseDto = {
        message: "User removed successfully",
      };
      mockProjectsService.removeUser.mockResolvedValue(removeResponse);

      const result = await controller.removeUser(
        "org-1",
        "project-1",
        deleteUserDto,
        mockUserSession,
      );

      expect(mockProjectsService.removeUser).toHaveBeenCalledWith(
        "org-1",
        "project-1",
        "user2@example.com",
        mockUserSession?.user?.id,
      );
      expect(result).toEqual(removeResponse);
    });
  });

  describe("findAll", () => {
    it("should return all projects for organisation", async () => {
      const projects: ProjectResponseDto[] = [mockProjectResponse];
      mockProjectsService.findAll.mockResolvedValue(projects);

      const result = await controller.findAll("org-1", mockUserSession);

      expect(mockProjectsService.findAll).toHaveBeenCalledWith(
        "org-1",
        "user-1",
      );
      expect(result).toEqual(projects);
    });
  });

  describe("assignProjectRole", () => {
    it("should assign role to user", async () => {
      const assignRoleDto: AssignRoleRequestDto = {
        roleId: "role-1",
      };
      const response: ProjectMessageResponseDto = {
        message: "Project role assigned successfully",
      };
      mockProjectRbacService.assignProjectRole.mockResolvedValue(undefined);

      const result = await controller.assignProjectRole(
        "org-1",
        "project-1",
        "user-2",
        assignRoleDto,
        mockUserSession,
      );

      expect(mockProjectRbacService.assignProjectRole).toHaveBeenCalledWith(
        "project-1",
        "user-2",
        "role-1",
        "org-1",
        mockUserSession?.user?.id,
      );
      expect(result).toEqual(response);
    });
  });

  describe("getUserProjectRole", () => {
    it("should return user project role", async () => {
      const roleResponse: RoleResponseDto = {
        id: "role-1",
        name: "Member",
        permissions: [],
        isSystemRole: true,
        isInstanceLevel: false,
        organisationId: "org-1",
        projectId: "project-1",
        canDelete: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockProjectRbacService.getUserProjectRole.mockResolvedValue(roleResponse);

      const result = await controller.getUserProjectRole(
        "org-1",
        "project-1",
        "user-2",
      );

      expect(mockProjectRbacService.getUserProjectRole).toHaveBeenCalledWith(
        "org-1",
        "project-1",
        "user-2",
      );
      expect(result).toEqual(roleResponse);
    });

    it("should return null when user has no role", async () => {
      mockProjectRbacService.getUserProjectRole.mockResolvedValue(null);

      const result = await controller.getUserProjectRole(
        "org-1",
        "project-1",
        "user-2",
      );

      expect(result).toBeNull();
    });
  });

  describe("removeProjectRole", () => {
    it("should remove project role from user", async () => {
      const response: ProjectMessageResponseDto = {
        message: "Project role removed successfully",
      };
      mockProjectRbacService.removeProjectRole.mockResolvedValue(undefined);

      const result = await controller.removeProjectRole(
        "org-1",
        "project-1",
        "user-2",
        mockUserSession,
      );

      expect(mockProjectRbacService.removeProjectRole).toHaveBeenCalledWith(
        "project-1",
        "user-2",
        "org-1",
        mockUserSession?.user?.id,
      );
      expect(result).toEqual(response);
    });
  });

  describe("getUsersWithRoles", () => {
    it("should return users with their roles", async () => {
      const usersWithRoles: ProjectUserWithRolesResponseDto[] = [
        {
          id: "user-1",
          email: "user1@example.com",
          name: "User 1",
          roles: [
            {
              id: "role-1",
              name: "Member",
              permissions: [],
              isSystemRole: true,
              isInstanceLevel: false,
              organisationId: "org-1",
              projectId: "project-1",
              canDelete: false,
              createdAt: new Date(),
              updatedAt: new Date(),
            },
          ],
        },
      ];

      mockProjectRbacService.getUsersWithRoles.mockResolvedValue(
        usersWithRoles,
      );

      const result = await controller.getUsersWithRoles("org-1", "project-1");

      expect(mockProjectRbacService.getUsersWithRoles).toHaveBeenCalledWith(
        "org-1",
        "project-1",
      );
      expect(result).toEqual(usersWithRoles);
      expect(result[0].roles).toHaveLength(1);
    });
  });

  describe("listAvailableUsers", () => {
    it("should return users not in project", async () => {
      const availableUsers = [
        { id: "user-2", email: "user2@example.com", name: "User 2" },
      ];

      mockProjectsService.findUsersNotInProject.mockResolvedValue(
        availableUsers,
      );

      const result = await controller.listAvailableUsers("org-1", "project-1");

      expect(mockProjectsService.findUsersNotInProject).toHaveBeenCalledWith(
        "org-1",
        "project-1",
      );
      expect(result).toEqual(availableUsers);
    });
  });
});
