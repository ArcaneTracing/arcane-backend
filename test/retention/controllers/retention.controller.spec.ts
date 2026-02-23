import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { RetentionController } from "../../../src/retention/controllers/retention.controller";
import { RetentionService } from "../../../src/retention/services/retention.service";
import { AuditService } from "../../../src/audit/audit.service";
import { Organisation } from "../../../src/organisations/entities/organisation.entity";
import { Project } from "../../../src/projects/entities/project.entity";
import { UpdateOrganisationRetentionRequestDto } from "../../../src/retention/dto/request/update-organisation-retention-request.dto";
import { UpdateProjectRetentionRequestDto } from "../../../src/retention/dto/request/update-project-retention-request.dto";
import { NotFoundException } from "@nestjs/common";
import { DEFAULT_RETENTION } from "../../../src/retention/config/retention.config";
import { OrgPermissionGuard } from "../../../src/rbac/guards/org-permission.guard";
import { OrgProjectPermissionGuard } from "../../../src/rbac/guards/org-project-permission.guard";
describe("RetentionController", () => {
  let controller: RetentionController;
  const mockOrganisationRepository = {
    findOne: jest.fn(),
    save: jest.fn(),
  };
  const mockProjectRepository = {
    findOne: jest.fn(),
    save: jest.fn(),
  };
  const mockAuditService = {
    record: jest.fn(),
  };
  const mockRetentionService = {
    deleteOldAuditLogs: jest.fn(),
    deleteOldEvaluations: jest.fn(),
    deleteOldExperiments: jest.fn(),
    deleteOldOrganisationInvitations: jest.fn(),
    runAllRetentionPolicies: jest.fn(),
  };
  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [RetentionController],
      providers: [
        {
          provide: RetentionService,
          useValue: mockRetentionService,
        },
        {
          provide: AuditService,
          useValue: mockAuditService,
        },
        {
          provide: getRepositoryToken(Organisation),
          useValue: mockOrganisationRepository,
        },
        {
          provide: getRepositoryToken(Project),
          useValue: mockProjectRepository,
        },
      ],
    })
      .overrideGuard(OrgPermissionGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(OrgProjectPermissionGuard)
      .useValue({ canActivate: () => true })
      .compile();
    controller = module.get<RetentionController>(RetentionController);
  });
  afterEach(() => {
    jest.clearAllMocks();
  });
  describe("getOrganisationRetention", () => {
    const organisationId = "org-1";
    it("should return retention settings for organisation", async () => {
      const organisation: Organisation = {
        id: organisationId,
        auditLogRetentionDays: 365,
      } as Organisation;
      mockOrganisationRepository.findOne.mockResolvedValue(organisation);
      const result = await controller.getOrganisationRetention(organisationId);
      expect(result).toEqual({
        auditLogRetentionDays: 365,
      });
      expect(mockOrganisationRepository.findOne).toHaveBeenCalledWith({
        where: { id: organisationId },
      });
    });
    it("should return default retention when organisation retention is null", async () => {
      const organisation: Organisation = {
        id: organisationId,
        auditLogRetentionDays: null,
      } as Organisation;
      mockOrganisationRepository.findOne.mockResolvedValue(organisation);
      const result = await controller.getOrganisationRetention(organisationId);
      expect(result).toEqual({
        auditLogRetentionDays: DEFAULT_RETENTION.AUDIT_LOGS,
      });
    });
    it("should throw NotFoundException when organisation does not exist", async () => {
      mockOrganisationRepository.findOne.mockResolvedValue(null);
      await expect(
        controller.getOrganisationRetention(organisationId),
      ).rejects.toThrow(NotFoundException);
    });
  });
  describe("updateOrganisationRetention", () => {
    const organisationId = "org-1";
    const userId = "user-1";
    const userSession = {
      user: { id: userId },
    } as any;
    it("should update organisation retention settings", async () => {
      const organisation: Organisation = {
        id: organisationId,
        auditLogRetentionDays: 365,
      } as Organisation;
      const dto: UpdateOrganisationRetentionRequestDto = {
        auditLogRetentionDays: 730,
      };
      mockOrganisationRepository.findOne.mockResolvedValue(organisation);
      mockOrganisationRepository.save.mockResolvedValue({
        ...organisation,
        auditLogRetentionDays: 730,
      } as Organisation);
      const result = await controller.updateOrganisationRetention(
        organisationId,
        dto,
        userSession,
      );
      expect(result).toEqual({
        auditLogRetentionDays: 730,
      });
      expect(mockOrganisationRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          auditLogRetentionDays: 730,
        }),
      );
      expect(mockAuditService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "organisation.retention.updated",
          actorId: userId,
          actorType: "user",
          resourceType: "organisation",
          resourceId: organisationId,
          organisationId,
          beforeState: { auditLogRetentionDays: 365 },
          afterState: { auditLogRetentionDays: 730 },
          metadata: {
            changedFields: ["auditLogRetentionDays"],
          },
        }),
      );
    });
    it("should throw NotFoundException when organisation does not exist", async () => {
      const dto: UpdateOrganisationRetentionRequestDto = {
        auditLogRetentionDays: 730,
      };
      mockOrganisationRepository.findOne.mockResolvedValue(null);
      await expect(
        controller.updateOrganisationRetention(
          organisationId,
          dto,
          userSession,
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });
  describe("getProjectRetention", () => {
    const organisationId = "org-1";
    const projectId = "project-1";
    it("should return retention settings for project", async () => {
      const project: Project = {
        id: projectId,
        organisationId,
        evaluationRetentionDays: 90,
        experimentRetentionDays: 90,
      } as Project;
      mockProjectRepository.findOne.mockResolvedValue(project);
      const result = await controller.getProjectRetention(
        organisationId,
        projectId,
      );
      expect(result).toEqual({
        evaluationRetentionDays: 90,
        experimentRetentionDays: 90,
      });
      expect(mockProjectRepository.findOne).toHaveBeenCalledWith({
        where: { id: projectId, organisationId },
      });
    });
    it("should return default retention when project retention is null", async () => {
      const project: Project = {
        id: projectId,
        organisationId,
        evaluationRetentionDays: null,
        experimentRetentionDays: null,
      } as Project;
      mockProjectRepository.findOne.mockResolvedValue(project);
      const result = await controller.getProjectRetention(
        organisationId,
        projectId,
      );
      expect(result).toEqual({
        evaluationRetentionDays: DEFAULT_RETENTION.EVALUATIONS,
        experimentRetentionDays: DEFAULT_RETENTION.EXPERIMENTS,
      });
    });
    it("should throw NotFoundException when project does not exist", async () => {
      mockProjectRepository.findOne.mockResolvedValue(null);
      await expect(
        controller.getProjectRetention(organisationId, projectId),
      ).rejects.toThrow(NotFoundException);
    });
  });
  describe("updateProjectRetention", () => {
    const organisationId = "org-1";
    const projectId = "project-1";
    const userId = "user-1";
    const userSession = {
      user: { id: userId },
    } as any;
    it("should update project retention settings", async () => {
      const project: Project = {
        id: projectId,
        organisationId,
        evaluationRetentionDays: 90,
        experimentRetentionDays: 90,
      } as Project;
      const dto: UpdateProjectRetentionRequestDto = {
        evaluationRetentionDays: 180,
        experimentRetentionDays: 180,
      };
      mockProjectRepository.findOne.mockResolvedValue(project);
      mockProjectRepository.save.mockResolvedValue({
        ...project,
        evaluationRetentionDays: 180,
        experimentRetentionDays: 180,
      } as Project);
      const result = await controller.updateProjectRetention(
        organisationId,
        projectId,
        dto,
        userSession,
      );
      expect(result).toEqual({
        evaluationRetentionDays: 180,
        experimentRetentionDays: 180,
      });
      expect(mockProjectRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          evaluationRetentionDays: 180,
          experimentRetentionDays: 180,
        }),
      );
      expect(mockAuditService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "project.retention.updated",
          actorId: userId,
          actorType: "user",
          resourceType: "project",
          resourceId: projectId,
          organisationId,
          projectId,
          beforeState: {
            evaluationRetentionDays: 90,
            experimentRetentionDays: 90,
          },
          afterState: {
            evaluationRetentionDays: 180,
            experimentRetentionDays: 180,
          },
          metadata: {
            changedFields: [
              "evaluationRetentionDays",
              "experimentRetentionDays",
            ],
          },
        }),
      );
    });
    it("should update only provided fields", async () => {
      const project: Project = {
        id: projectId,
        organisationId,
        evaluationRetentionDays: 90,
        experimentRetentionDays: 90,
      } as Project;
      const dto: UpdateProjectRetentionRequestDto = {
        evaluationRetentionDays: 180,
      };
      mockProjectRepository.findOne.mockResolvedValue(project);
      mockProjectRepository.save.mockResolvedValue({
        ...project,
        evaluationRetentionDays: 180,
      } as Project);
      const result = await controller.updateProjectRetention(
        organisationId,
        projectId,
        dto,
        userSession,
      );
      expect(result.evaluationRetentionDays).toBe(180);
      expect(result.experimentRetentionDays).toBe(90);
    });
    it("should throw NotFoundException when project does not exist", async () => {
      const dto: UpdateProjectRetentionRequestDto = {
        evaluationRetentionDays: 180,
      };
      mockProjectRepository.findOne.mockResolvedValue(null);
      await expect(
        controller.updateProjectRetention(
          organisationId,
          projectId,
          dto,
          userSession,
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
