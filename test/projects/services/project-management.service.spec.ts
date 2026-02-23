import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { CACHE_MANAGER } from "@nestjs/cache-manager";
import { Repository } from "typeorm";
import { NotFoundException } from "@nestjs/common";
import { ProjectManagementService } from "../../../src/projects/services/project-management.service";
import { Project } from "../../../src/projects/entities/project.entity";
import { CreateProjectDto } from "../../../src/projects/dto/request/create-project.dto";
import { UpdateProjectDto } from "../../../src/projects/dto/request/update-project.dto";
import { RbacAssignmentService } from "../../../src/rbac/services/rbac-assignment.service";
import { RbacSeedService } from "../../../src/rbac/services/rbac-seed.service";
import {
  ERROR_MESSAGES,
  formatError,
} from "../../../src/common/constants/error-messages.constants";
import { Role } from "../../../src/rbac/entities/role.entity";
import { Organisation } from "../../../src/organisations/entities/organisation.entity";
import { AuditService } from "../../../src/audit/audit.service";

describe("ProjectManagementService", () => {
  let service: ProjectManagementService;
  let repository: Repository<Project>;
  let assignmentService: RbacAssignmentService;
  let seedService: RbacSeedService;
  let cacheManager: any;
  let mockAuditService: { record: jest.Mock };

  const mockRepository = {
    findOne: jest.fn(),
    save: jest.fn(),
    remove: jest.fn(),
    createQueryBuilder: jest.fn(),
    manager: {
      transaction: jest.fn(),
    },
  };

  const mockAssignmentService = {
    assignRole: jest.fn(),
  };

  const mockSeedService = {
    seedProjectRoles: jest.fn(),
  };

  const mockCacheManager = {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
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

  const mockProjectAdminRole: Role = {
    id: "role-1",
    name: "Project Admin",
    permissions: [],
    isSystemRole: true,
    isInstanceLevel: false,
    organisationId: "org-1",
    projectId: "project-1",
    createdAt: new Date(),
    updatedAt: new Date(),
  } as Role;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProjectManagementService,
        {
          provide: getRepositoryToken(Project),
          useValue: mockRepository,
        },
        {
          provide: RbacAssignmentService,
          useValue: mockAssignmentService,
        },
        {
          provide: RbacSeedService,
          useValue: mockSeedService,
        },
        {
          provide: CACHE_MANAGER,
          useValue: mockCacheManager,
        },
        { provide: AuditService, useValue: mockAuditService },
      ],
    }).compile();

    service = module.get<ProjectManagementService>(ProjectManagementService);
    repository = module.get<Repository<Project>>(getRepositoryToken(Project));
    assignmentService = module.get<RbacAssignmentService>(
      RbacAssignmentService,
    );
    seedService = module.get<RbacSeedService>(RbacSeedService);
    cacheManager = module.get(CACHE_MANAGER);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("getByIdAndOrganisationOrThrow", () => {
    it("should return project when found", async () => {
      mockRepository.findOne.mockResolvedValue(mockProject);

      const result = await service.getByIdAndOrganisationOrThrow(
        "org-1",
        "project-1",
      );

      expect(result).toEqual(mockProject);
      expect(mockRepository.findOne).toHaveBeenCalledWith({
        where: { id: "project-1", organisationId: "org-1" },
      });
    });

    it("should throw NotFoundException when project not found", async () => {
      mockRepository.findOne.mockResolvedValue(null);

      await expect(
        service.getByIdAndOrganisationOrThrow("org-1", "project-1"),
      ).rejects.toThrow(NotFoundException);
      await expect(
        service.getByIdAndOrganisationOrThrow("org-1", "project-1"),
      ).rejects.toThrow(
        formatError(ERROR_MESSAGES.PROJECT_NOT_FOUND, "project-1"),
      );
    });

    it("should throw NotFoundException when project belongs to different organisation", async () => {
      mockRepository.findOne.mockResolvedValue(null);

      await expect(
        service.getByIdAndOrganisationOrThrow("org-2", "project-1"),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe("create", () => {
    const createDto: CreateProjectDto = {
      name: "New Project",
      description: "New Description",
    };

    it("should create project successfully with transaction", async () => {
      const savedProject = { ...mockProject, name: "New Project" };
      const mockProjectRepo = {
        save: jest.fn().mockResolvedValue(savedProject),
        createQueryBuilder: jest.fn().mockReturnValue({
          relation: jest.fn().mockReturnValue({
            of: jest.fn().mockReturnValue({
              add: jest.fn().mockResolvedValue(undefined),
            }),
          }),
        }),
      };
      const transactionCallback = jest
        .fn()
        .mockImplementation(async (callback) => {
          const mockManager = {
            getRepository: jest.fn().mockReturnValue(mockProjectRepo),
          };
          return callback(mockManager);
        });
      mockRepository.manager.transaction = transactionCallback;
      mockSeedService.seedProjectRoles.mockResolvedValue(mockProjectAdminRole);
      mockAssignmentService.assignRole.mockResolvedValue(undefined);

      const result = await service.create("org-1", createDto, "user-1");

      expect(mockRepository.manager.transaction).toHaveBeenCalled();
      expect(mockSeedService.seedProjectRoles).toHaveBeenCalledWith(
        "org-1",
        savedProject.id,
        expect.anything(),
      );
      expect(mockAssignmentService.assignRole).toHaveBeenCalledWith(
        "user-1",
        "role-1",
        expect.anything(),
      );
      expect(result).toMatchObject({
        id: savedProject.id,
        name: savedProject.name,
      });

      expect(mockAuditService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "project.created",
          actorId: "user-1",
          actorType: "user",
          resourceType: "project",
          resourceId: savedProject.id,
          organisationId: "org-1",
          projectId: savedProject.id,
          afterState: expect.objectContaining({
            id: savedProject.id,
            name: "New Project",
            organisationId: "org-1",
            createdById: "user-1",
          }),
          metadata: expect.objectContaining({
            creatorId: "user-1",
            organisationId: "org-1",
            projectId: savedProject.id,
          }),
        }),
      );
    });

    it("should create project even if role seeding returns null", async () => {
      const savedProject = { ...mockProject, name: "New Project" };
      const mockProjectRepo = {
        save: jest.fn().mockResolvedValue(savedProject),
        createQueryBuilder: jest.fn().mockReturnValue({
          relation: jest.fn().mockReturnValue({
            of: jest.fn().mockReturnValue({
              add: jest.fn().mockResolvedValue(undefined),
            }),
          }),
        }),
      };
      const transactionCallback = jest
        .fn()
        .mockImplementation(async (callback) => {
          const mockManager = {
            getRepository: jest.fn().mockReturnValue(mockProjectRepo),
          };
          return callback(mockManager);
        });
      mockRepository.manager.transaction = transactionCallback;
      mockSeedService.seedProjectRoles.mockResolvedValue(null);

      const result = await service.create("org-1", createDto, "user-1");

      expect(mockRepository.manager.transaction).toHaveBeenCalled();
      expect(mockSeedService.seedProjectRoles).toHaveBeenCalled();
      expect(mockAssignmentService.assignRole).not.toHaveBeenCalled();
      expect(result).toMatchObject({
        id: savedProject.id,
        name: savedProject.name,
      });
    });

    it("should rollback transaction on error", async () => {
      const transactionCallback = jest
        .fn()
        .mockImplementation(async (callback) => {
          const mockManager = {
            getRepository: jest.fn().mockReturnValue({
              save: jest.fn().mockRejectedValue(new Error("Database error")),
            }),
          };
          return callback(mockManager);
        });
      mockRepository.manager.transaction = transactionCallback;

      await expect(
        service.create("org-1", createDto, "user-1"),
      ).rejects.toThrow("Database error");
      expect(mockSeedService.seedProjectRoles).not.toHaveBeenCalled();
      expect(mockAssignmentService.assignRole).not.toHaveBeenCalled();
    });

    it("should create project with trace filter attributes", async () => {
      const createDtoWithFilter: CreateProjectDto = {
        name: "New Project",
        description: "New Description",
        traceFilterAttributeName: "project.id",
        traceFilterAttributeValue: "project-123",
      };
      const savedProject = {
        ...mockProject,
        name: "New Project",
        traceFilterAttributeName: "project.id",
        traceFilterAttributeValue: "project-123",
      };
      const mockProjectRepo = {
        save: jest.fn().mockResolvedValue(savedProject),
        createQueryBuilder: jest.fn().mockReturnValue({
          relation: jest.fn().mockReturnValue({
            of: jest.fn().mockReturnValue({
              add: jest.fn().mockResolvedValue(undefined),
            }),
          }),
        }),
      };
      const transactionCallback = jest
        .fn()
        .mockImplementation(async (callback) => {
          const mockManager = {
            getRepository: jest.fn().mockReturnValue(mockProjectRepo),
          };
          return callback(mockManager);
        });
      mockRepository.manager.transaction = transactionCallback;
      mockSeedService.seedProjectRoles.mockResolvedValue(mockProjectAdminRole);
      mockAssignmentService.assignRole.mockResolvedValue(undefined);

      const result = await service.create(
        "org-1",
        createDtoWithFilter,
        "user-1",
      );

      expect(mockProjectRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          traceFilterAttributeName: "project.id",
          traceFilterAttributeValue: "project-123",
        }),
      );
      expect(result).toMatchObject({
        traceFilterAttributeName: "project.id",
        traceFilterAttributeValue: "project-123",
      });
    });
  });

  describe("update", () => {
    const updateDto: UpdateProjectDto = {
      name: "Updated Project",
    };

    it("should update project name successfully", async () => {
      const originalProject = {
        ...mockProject,
        name: "Original Name",
        description: "Original Desc",
      };
      const updatedProject = { ...originalProject, name: "Updated Project" };
      mockRepository.findOne.mockResolvedValue(originalProject);
      mockRepository.save.mockImplementation((project) =>
        Promise.resolve({ ...project }),
      );
      mockCacheManager.del.mockResolvedValue(undefined);

      const result = await service.update(
        "org-1",
        "project-1",
        updateDto,
        "user-1",
      );

      expect(mockRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "Updated Project",
          description: "Original Desc",
        }),
      );
      expect(mockCacheManager.del).toHaveBeenCalledWith("project:project-1");

      expect(result).toMatchObject({
        id: updatedProject.id,
        name: "Updated Project",
        description: "Original Desc",
      });

      expect(mockAuditService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "project.updated",
          actorId: "user-1",
          resourceType: "project",
          resourceId: "project-1",
          organisationId: "org-1",
          projectId: "project-1",
          beforeState: expect.objectContaining({
            id: "project-1",
            name: "Original Name",
          }),
          afterState: expect.objectContaining({
            id: "project-1",
            name: "Updated Project",
          }),
          metadata: expect.objectContaining({
            changedFields: ["name"],
            projectId: "project-1",
          }),
        }),
      );
    });

    it("should update project description successfully", async () => {
      const updateDescDto: UpdateProjectDto = {
        description: "Updated Description",
      };
      const originalProject = {
        ...mockProject,
        name: "Original Name",
        description: "Original Desc",
      };
      mockRepository.findOne.mockResolvedValue(originalProject);
      mockRepository.save.mockImplementation((project) =>
        Promise.resolve({ ...project }),
      );
      mockCacheManager.del.mockResolvedValue(undefined);

      const result = await service.update(
        "org-1",
        "project-1",
        updateDescDto,
        "user-1",
      );

      expect(mockRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "Original Name",
          description: "Updated Description",
        }),
      );
      expect(mockCacheManager.del).toHaveBeenCalledWith("project:project-1");

      expect(result).toMatchObject({
        name: "Original Name",
        description: "Updated Description",
      });
    });

    it("should update both name and description", async () => {
      const updateBothDto: UpdateProjectDto = {
        name: "Updated Name",
        description: "Updated Description",
      };
      const originalProject = {
        ...mockProject,
        name: "Original Name",
        description: "Original Desc",
      };
      mockRepository.findOne.mockResolvedValue(originalProject);
      mockRepository.save.mockImplementation((project) =>
        Promise.resolve({ ...project }),
      );
      mockCacheManager.del.mockResolvedValue(undefined);

      const result = await service.update(
        "org-1",
        "project-1",
        updateBothDto,
        "user-1",
      );

      expect(mockRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "Updated Name",
          description: "Updated Description",
        }),
      );

      expect(result).toMatchObject({
        name: "Updated Name",
        description: "Updated Description",
      });
    });

    it("should throw NotFoundException when project not found", async () => {
      mockRepository.findOne.mockResolvedValue(null);

      await expect(
        service.update("org-1", "project-1", updateDto, "user-1"),
      ).rejects.toThrow(NotFoundException);
      expect(mockRepository.save).not.toHaveBeenCalled();
      expect(mockCacheManager.del).not.toHaveBeenCalled();
    });

    it("should invalidate cache on update", async () => {
      mockRepository.findOne.mockResolvedValue(mockProject);
      mockRepository.save.mockResolvedValue(mockProject);
      mockCacheManager.del.mockResolvedValue(undefined);

      await service.update("org-1", "project-1", updateDto, "user-1");

      expect(mockCacheManager.del).toHaveBeenCalledWith("project:project-1");
    });

    it("should update project trace filter attributes", async () => {
      const updateFilterDto: UpdateProjectDto = {
        traceFilterAttributeName: "environment",
        traceFilterAttributeValue: "production",
      };
      const originalProject = {
        ...mockProject,
        traceFilterAttributeName: undefined,
        traceFilterAttributeValue: undefined,
      };
      const updatedProject = {
        ...originalProject,
        traceFilterAttributeName: "environment",
        traceFilterAttributeValue: "production",
      };
      mockRepository.findOne.mockResolvedValue(originalProject);
      mockRepository.save.mockImplementation((project) =>
        Promise.resolve({ ...project }),
      );
      mockCacheManager.del.mockResolvedValue(undefined);

      const result = await service.update(
        "org-1",
        "project-1",
        updateFilterDto,
        "user-1",
      );

      expect(mockRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          traceFilterAttributeName: "environment",
          traceFilterAttributeValue: "production",
        }),
      );
      expect(result).toMatchObject({
        traceFilterAttributeName: "environment",
        traceFilterAttributeValue: "production",
      });
    });

    it("should update project to remove trace filter attributes", async () => {
      const updateFilterDto: UpdateProjectDto = {
        traceFilterAttributeName: null,
        traceFilterAttributeValue: null,
      };
      const originalProject = {
        ...mockProject,
        traceFilterAttributeName: "project.id",
        traceFilterAttributeValue: "project-123",
      };
      const updatedProject = {
        ...originalProject,
        traceFilterAttributeName: undefined,
        traceFilterAttributeValue: undefined,
      };
      mockRepository.findOne.mockResolvedValue(originalProject);
      mockRepository.save.mockImplementation((project) =>
        Promise.resolve({ ...project }),
      );
      mockCacheManager.del.mockResolvedValue(undefined);

      const result = await service.update(
        "org-1",
        "project-1",
        updateFilterDto,
        "user-1",
      );

      expect(mockRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          traceFilterAttributeName: null,
          traceFilterAttributeValue: null,
        }),
      );
      expect(result).toMatchObject({
        traceFilterAttributeName: null,
        traceFilterAttributeValue: null,
      });
    });
  });

  describe("remove", () => {
    it("should remove project successfully", async () => {
      const projectToRemove = {
        ...mockProject,
        name: "Test Project",
        description: "Test Description",
      } as Project;
      mockRepository.findOne.mockResolvedValue(projectToRemove);
      mockRepository.remove.mockResolvedValue(projectToRemove);
      mockCacheManager.del.mockResolvedValue(undefined);

      const result = await service.remove("org-1", "project-1", "user-1");

      expect(mockRepository.findOne).toHaveBeenCalledWith({
        where: { id: "project-1", organisationId: "org-1" },
      });
      expect(mockRepository.remove).toHaveBeenCalledWith(projectToRemove);
      expect(mockCacheManager.del).toHaveBeenCalledWith("project:project-1");
      expect(result).toEqual({ message: "Project deleted successfully" });

      expect(mockAuditService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "project.deleted",
          actorId: "user-1",
          resourceType: "project",
          resourceId: "project-1",
          organisationId: "org-1",
          projectId: "project-1",
          beforeState: expect.objectContaining({
            id: "project-1",
            name: "Test Project",
          }),
          afterState: null,
          metadata: expect.objectContaining({
            organisationId: "org-1",
            projectId: "project-1",
          }),
        }),
      );
    });

    it("should throw NotFoundException when project not found", async () => {
      mockRepository.findOne.mockResolvedValue(null);

      await expect(service.remove("org-1", "project-1")).rejects.toThrow(
        NotFoundException,
      );
      expect(mockRepository.remove).not.toHaveBeenCalled();
      expect(mockCacheManager.del).not.toHaveBeenCalled();
    });

    it("should invalidate cache on remove", async () => {
      mockRepository.findOne.mockResolvedValue(mockProject);
      mockRepository.remove.mockResolvedValue(mockProject);
      mockCacheManager.del.mockResolvedValue(undefined);

      await service.remove("org-1", "project-1");

      expect(mockCacheManager.del).toHaveBeenCalledWith("project:project-1");
    });
  });

  describe("findAll", () => {
    it("should return projects where user is creator", async () => {
      const mockQueryBuilder = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        leftJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([mockProject]),
      };
      mockRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      const result = await service.findAll("org-1", "user-1");

      expect(mockRepository.createQueryBuilder).toHaveBeenCalledWith("project");
      expect(mockQueryBuilder.leftJoinAndSelect).toHaveBeenCalledWith(
        "project.organisation",
        "organisation",
      );
      expect(mockQueryBuilder.leftJoin).toHaveBeenCalledWith(
        "project.users",
        "user",
        "user.id = :userId",
        { userId: "user-1" },
      );
      expect(mockQueryBuilder.where).toHaveBeenCalledWith(
        "project.organisation_id = :organisationId",
        { organisationId: "org-1" },
      );
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        "(project.created_by_id = :userId OR user.id IS NOT NULL)",
        { userId: "user-1" },
      );
      expect(mockQueryBuilder.orderBy).toHaveBeenCalledWith(
        "project.name",
        "ASC",
      );
      expect(result).toHaveLength(1);
    });

    it("should return empty array when no projects found", async () => {
      const mockQueryBuilder = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        leftJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      };
      mockRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      const result = await service.findAll("org-1", "user-1");

      expect(result).toEqual([]);
    });
  });

  describe("findById", () => {
    it("should return cached project when available", async () => {
      const cachedProject = { ...mockProject };
      mockCacheManager.get.mockResolvedValue(cachedProject);

      const result = await service.findById("project-1");

      expect(mockCacheManager.get).toHaveBeenCalledWith("project:project-1");
      expect(mockRepository.findOne).not.toHaveBeenCalled();
      expect(result).toEqual(cachedProject);
    });

    it("should fetch from database and cache when not cached", async () => {
      mockCacheManager.get.mockResolvedValue(null);
      mockRepository.findOne.mockResolvedValue(mockProject);
      mockCacheManager.set.mockResolvedValue(undefined);

      const result = await service.findById("project-1");

      expect(mockCacheManager.get).toHaveBeenCalledWith("project:project-1");
      expect(mockRepository.findOne).toHaveBeenCalledWith({
        where: { id: "project-1" },
        relations: ["users", "organisation"],
      });
      expect(mockCacheManager.set).toHaveBeenCalledWith(
        "project:project-1",
        mockProject,
        1800,
      );
      expect(result).toEqual(mockProject);
    });

    it("should throw NotFoundException when project not found", async () => {
      mockCacheManager.get.mockResolvedValue(null);
      mockRepository.findOne.mockResolvedValue(null);

      await expect(service.findById("project-1")).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.findById("project-1")).rejects.toThrow(
        formatError(ERROR_MESSAGES.PROJECT_NOT_FOUND, "project-1"),
      );
      expect(mockCacheManager.set).not.toHaveBeenCalled();
    });
  });
});
