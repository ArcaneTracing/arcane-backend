import { Test, TestingModule } from "@nestjs/testing";
import { ProjectsService } from "../../../src/projects/services/projects.service";
import { ProjectManagementService } from "../../../src/projects/services/project-management.service";
import { ProjectMembershipService } from "../../../src/projects/services/project-membership.service";
import { CreateProjectDto } from "../../../src/projects/dto/request/create-project.dto";
import { UpdateProjectDto } from "../../../src/projects/dto/request/update-project.dto";
import { ProjectResponseDto } from "../../../src/projects/dto/response/project.dto";
import { ProjectMessageResponseDto } from "../../../src/projects/dto/response/project-message-response.dto";
import { Project } from "../../../src/projects/entities/project.entity";

describe("ProjectsService", () => {
  let service: ProjectsService;
  let projectManagementService: ProjectManagementService;
  let projectMembershipService: ProjectMembershipService;

  const mockProjectManagementService = {
    create: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
    findAll: jest.fn(),
    findById: jest.fn(),
  };

  const mockProjectMembershipService = {
    inviteUser: jest.fn(),
    removeUser: jest.fn(),
    findUsersNotInProject: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProjectsService,
        {
          provide: ProjectManagementService,
          useValue: mockProjectManagementService,
        },
        {
          provide: ProjectMembershipService,
          useValue: mockProjectMembershipService,
        },
      ],
    }).compile();

    service = module.get<ProjectsService>(ProjectsService);
    projectManagementService = module.get<ProjectManagementService>(
      ProjectManagementService,
    );
    projectMembershipService = module.get<ProjectMembershipService>(
      ProjectMembershipService,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("create", () => {
    it("should delegate to ProjectManagementService", async () => {
      const createDto: CreateProjectDto = { name: "Test", description: "Desc" };
      const expectedResult: ProjectResponseDto = {
        id: "project-1",
        name: "Test",
        description: "Desc",
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockProjectManagementService.create.mockResolvedValue(expectedResult);

      const result = await service.create("org-1", createDto, "user-1");

      expect(mockProjectManagementService.create).toHaveBeenCalledWith(
        "org-1",
        createDto,
        "user-1",
      );
      expect(result).toEqual(expectedResult);
    });
  });

  describe("update", () => {
    it("should delegate to ProjectManagementService", async () => {
      const updateDto: UpdateProjectDto = { name: "Updated" };
      const expectedResult: ProjectResponseDto = {
        id: "project-1",
        name: "Updated",
        description: "Desc",
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockProjectManagementService.update.mockResolvedValue(expectedResult);

      const result = await service.update(
        "org-1",
        "project-1",
        updateDto,
        "user-1",
      );

      expect(mockProjectManagementService.update).toHaveBeenCalledWith(
        "org-1",
        "project-1",
        updateDto,
        "user-1",
      );
      expect(result).toEqual(expectedResult);
    });
  });

  describe("remove", () => {
    it("should delegate to ProjectManagementService", async () => {
      const expectedResult: ProjectMessageResponseDto = {
        message: "Project deleted successfully",
      };
      mockProjectManagementService.remove.mockResolvedValue(expectedResult);

      const result = await service.remove("org-1", "project-1", "user-1");

      expect(mockProjectManagementService.remove).toHaveBeenCalledWith(
        "org-1",
        "project-1",
        "user-1",
      );
      expect(result).toEqual(expectedResult);
    });
  });

  describe("findAll", () => {
    it("should delegate to ProjectManagementService", async () => {
      const expectedResult: ProjectResponseDto[] = [
        {
          id: "project-1",
          name: "Test",
          description: "Desc",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];
      mockProjectManagementService.findAll.mockResolvedValue(expectedResult);

      const result = await service.findAll("org-1", "user-1");

      expect(mockProjectManagementService.findAll).toHaveBeenCalledWith(
        "org-1",
        "user-1",
      );
      expect(result).toEqual(expectedResult);
    });
  });

  describe("findById", () => {
    it("should delegate to ProjectManagementService", async () => {
      const expectedResult = {
        id: "project-1",
        name: "Test",
        description: "Desc",
        createdAt: new Date(),
        updatedAt: new Date(),
      } as Project;
      mockProjectManagementService.findById.mockResolvedValue(expectedResult);

      const result = await service.findById("project-1");

      expect(mockProjectManagementService.findById).toHaveBeenCalledWith(
        "project-1",
      );
      expect(result).toEqual(expectedResult);
    });
  });

  describe("inviteUser", () => {
    it("should delegate to ProjectMembershipService", async () => {
      const expectedResult: ProjectMessageResponseDto = {
        message: "User invited successfully",
      };
      mockProjectMembershipService.inviteUser.mockResolvedValue(expectedResult);

      const result = await service.inviteUser(
        "org-1",
        "project-1",
        "user@example.com",
        "role-1",
        "user-1",
      );

      expect(mockProjectMembershipService.inviteUser).toHaveBeenCalledWith(
        "org-1",
        "project-1",
        "user@example.com",
        "role-1",
        "user-1",
      );
      expect(result).toEqual(expectedResult);
    });

    it("should delegate without roleId", async () => {
      const expectedResult: ProjectMessageResponseDto = {
        message: "User invited successfully",
      };
      mockProjectMembershipService.inviteUser.mockResolvedValue(expectedResult);

      const result = await service.inviteUser(
        "org-1",
        "project-1",
        "user@example.com",
      );

      expect(mockProjectMembershipService.inviteUser).toHaveBeenCalledWith(
        "org-1",
        "project-1",
        "user@example.com",
        undefined,
        undefined,
      );
      expect(result).toEqual(expectedResult);
    });
  });

  describe("removeUser", () => {
    it("should delegate to ProjectMembershipService", async () => {
      const expectedResult: ProjectMessageResponseDto = {
        message: "User removed successfully",
      };
      mockProjectMembershipService.removeUser.mockResolvedValue(expectedResult);

      const result = await service.removeUser(
        "org-1",
        "project-1",
        "user@example.com",
        "user-1",
      );

      expect(mockProjectMembershipService.removeUser).toHaveBeenCalledWith(
        "org-1",
        "project-1",
        "user@example.com",
        "user-1",
      );
      expect(result).toEqual(expectedResult);
    });
  });

  describe("findUsersNotInProject", () => {
    it("should delegate to ProjectMembershipService", async () => {
      const expectedResult = [
        { id: "user-2", email: "user2@example.com", name: "User 2" },
      ];
      mockProjectMembershipService.findUsersNotInProject.mockResolvedValue(
        expectedResult,
      );

      const result = await service.findUsersNotInProject("org-1", "project-1");

      expect(
        mockProjectMembershipService.findUsersNotInProject,
      ).toHaveBeenCalledWith("org-1", "project-1");
      expect(result).toEqual(expectedResult);
    });
  });
});
