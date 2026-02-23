import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { RbacMembershipService } from "../../../src/rbac/services/rbac-membership.service";
import { Organisation } from "../../../src/organisations/entities/organisation.entity";
import { Project } from "../../../src/projects/entities/project.entity";
import { UserRole } from "../../../src/rbac/entities/user-role.entity";
import { Role } from "../../../src/rbac/entities/role.entity";
import { Repository } from "typeorm";

describe("RbacMembershipService", () => {
  let service: RbacMembershipService;
  let organisationRepository: Repository<Organisation>;
  let projectRepository: Repository<Project>;
  let userRoleRepository: Repository<UserRole>;

  const mockOrganisationRepository = {
    manager: {
      query: jest.fn(),
    },
  };

  const mockProjectRepository = {
    manager: {
      query: jest.fn(),
    },
  };

  const mockUserRoleRepository = {
    find: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RbacMembershipService,
        {
          provide: getRepositoryToken(Organisation),
          useValue: mockOrganisationRepository,
        },
        {
          provide: getRepositoryToken(Project),
          useValue: mockProjectRepository,
        },
        {
          provide: getRepositoryToken(UserRole),
          useValue: mockUserRoleRepository,
        },
      ],
    }).compile();

    service = module.get<RbacMembershipService>(RbacMembershipService);
    organisationRepository = module.get<Repository<Organisation>>(
      getRepositoryToken(Organisation),
    );
    projectRepository = module.get<Repository<Project>>(
      getRepositoryToken(Project),
    );
    userRoleRepository = module.get<Repository<UserRole>>(
      getRepositoryToken(UserRole),
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("isMember", () => {
    it("should return true when user is member of organisation", async () => {
      mockOrganisationRepository.manager.query.mockResolvedValue([
        { "?column?": 1 },
      ]);

      const result = await service.isMember("org-1", "user-1");

      expect(mockOrganisationRepository.manager.query).toHaveBeenCalledWith(
        `SELECT 1 FROM organisation_users WHERE organisation_id = $1 AND user_id = $2 LIMIT 1`,
        ["org-1", "user-1"],
      );
      expect(result).toBe(true);
    });

    it("should return false when user is not member of organisation", async () => {
      mockOrganisationRepository.manager.query.mockResolvedValue([]);

      const result = await service.isMember("org-1", "user-1");

      expect(result).toBe(false);
    });
  });

  describe("isProjectMember", () => {
    it("should return true when user is member of project", async () => {
      mockProjectRepository.manager.query.mockResolvedValue([
        { "?column?": 1 },
      ]);

      const result = await service.isProjectMember("project-1", "user-1");

      expect(mockProjectRepository.manager.query).toHaveBeenCalledWith(
        `SELECT 1 FROM project_users WHERE project_id = $1 AND user_id = $2 LIMIT 1`,
        ["project-1", "user-1"],
      );
      expect(result).toBe(true);
    });

    it("should return false when user is not member of project", async () => {
      mockProjectRepository.manager.query.mockResolvedValue([]);

      const result = await service.isProjectMember("project-1", "user-1");

      expect(result).toBe(false);
    });
  });

  describe("getUserOrganisationIds", () => {
    it("should return organisation IDs for user", async () => {
      mockOrganisationRepository.manager.query.mockResolvedValue([
        { organisation_id: "org-1" },
        { organisation_id: "org-2" },
      ]);

      const result = await service.getUserOrganisationIds("user-1");

      expect(mockOrganisationRepository.manager.query).toHaveBeenCalledWith(
        `SELECT organisation_id FROM organisation_users WHERE user_id = $1`,
        ["user-1"],
      );
      expect(result).toEqual(["org-1", "org-2"]);
    });

    it("should return empty array when user has no organisations", async () => {
      mockOrganisationRepository.manager.query.mockResolvedValue([]);

      const result = await service.getUserOrganisationIds("user-1");

      expect(result).toEqual([]);
    });
  });

  describe("getUserProjectIds", () => {
    it("should return project IDs for user", async () => {
      mockProjectRepository.manager.query.mockResolvedValue([
        { project_id: "project-1" },
        { project_id: "project-2" },
      ]);

      const result = await service.getUserProjectIds("user-1");

      expect(mockProjectRepository.manager.query).toHaveBeenCalledWith(
        `SELECT project_id FROM project_users WHERE user_id = $1`,
        ["user-1"],
      );
      expect(result).toEqual(["project-1", "project-2"]);
    });

    it("should return empty array when user has no projects", async () => {
      mockProjectRepository.manager.query.mockResolvedValue([]);

      const result = await service.getUserProjectIds("user-1");

      expect(result).toEqual([]);
    });
  });

  describe("getUsersWithProjectAccess", () => {
    it("should return users with instance-scoped roles", async () => {
      const instanceRole: Role = {
        id: "role-instance",
        name: "Owner",
        permissions: [],
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

      const userRole: UserRole = {
        id: "user-role-1",
        userId: "user-1",
        roleId: "role-instance",
        role: instanceRole,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as UserRole;

      mockUserRoleRepository.find.mockResolvedValue([userRole]);

      const result = await service.getUsersWithProjectAccess("project-1");

      expect(mockUserRoleRepository.find).toHaveBeenCalledWith({
        relations: ["role"],
      });
      expect(result).toEqual(["user-1"]);
    });

    it("should return users with project-scoped roles for specific project", async () => {
      const projectRole: Role = {
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

      const userRole: UserRole = {
        id: "user-role-1",
        userId: "user-1",
        roleId: "role-project",
        role: projectRole,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as UserRole;

      mockUserRoleRepository.find.mockResolvedValue([userRole]);

      const result = await service.getUsersWithProjectAccess("project-1");

      expect(result).toEqual(["user-1"]);
    });

    it("should not return users with project-scoped roles for different project", async () => {
      const projectRole: Role = {
        id: "role-project",
        name: "Member",
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

      const userRole: UserRole = {
        id: "user-role-1",
        userId: "user-1",
        roleId: "role-project",
        role: projectRole,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as UserRole;

      mockUserRoleRepository.find.mockResolvedValue([userRole]);

      const result = await service.getUsersWithProjectAccess("project-1");

      expect(result).toEqual([]);
    });

    it("should return unique user IDs when multiple roles grant access", async () => {
      const instanceRole: Role = {
        id: "role-instance",
        name: "Owner",
        permissions: [],
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

      const projectRole: Role = {
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

      const userRole1: UserRole = {
        id: "user-role-1",
        userId: "user-1",
        roleId: "role-instance",
        role: instanceRole,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as UserRole;

      const userRole2: UserRole = {
        id: "user-role-2",
        userId: "user-1",
        roleId: "role-project",
        role: projectRole,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as UserRole;

      mockUserRoleRepository.find.mockResolvedValue([userRole1, userRole2]);

      const result = await service.getUsersWithProjectAccess("project-1");

      expect(result).toEqual(["user-1"]);
      expect(result.length).toBe(1);
    });

    it("should return empty array when no users have access", async () => {
      mockUserRoleRepository.find.mockResolvedValue([]);

      const result = await service.getUsersWithProjectAccess("project-1");

      expect(result).toEqual([]);
    });
  });
});
