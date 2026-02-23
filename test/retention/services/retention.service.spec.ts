import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { RetentionService } from "../../../src/retention/services/retention.service";
import { AuditLog } from "../../../src/audit/entities/audit-log.entity";
import {
  Evaluation,
  EvaluationScope,
} from "../../../src/evaluations/entities/evaluation.entity";
import { Experiment } from "../../../src/experiments/entities/experiment.entity";
import { OrganisationInvitation } from "../../../src/organisations/entities/organisation-invitation.entity";
import { Organisation } from "../../../src/organisations/entities/organisation.entity";
import { Project } from "../../../src/projects/entities/project.entity";
import { AuditService } from "../../../src/audit/audit.service";

describe("RetentionService", () => {
  let service: RetentionService;

  const mockAuditLogRepository = {
    createQueryBuilder: jest.fn(),
    delete: jest.fn(),
    find: jest.fn(),
  };

  const mockEvaluationRepository = {
    createQueryBuilder: jest.fn(),
    delete: jest.fn(),
    find: jest.fn(),
  };

  const mockExperimentRepository = {
    createQueryBuilder: jest.fn(),
    delete: jest.fn(),
    find: jest.fn(),
  };

  const mockOrganisationInvitationRepository = {
    createQueryBuilder: jest.fn(),
    delete: jest.fn(),
    find: jest.fn(),
  };

  const mockOrganisationRepository = {
    find: jest.fn(),
  };

  const mockProjectRepository = {
    find: jest.fn(),
  };

  const mockAuditService = {
    record: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RetentionService,
        {
          provide: getRepositoryToken(AuditLog),
          useValue: mockAuditLogRepository,
        },
        {
          provide: getRepositoryToken(Evaluation),
          useValue: mockEvaluationRepository,
        },
        {
          provide: getRepositoryToken(Experiment),
          useValue: mockExperimentRepository,
        },
        {
          provide: getRepositoryToken(OrganisationInvitation),
          useValue: mockOrganisationInvitationRepository,
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
          provide: AuditService,
          useValue: mockAuditService,
        },
      ],
    }).compile();

    service = module.get<RetentionService>(RetentionService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("deleteOldAuditLogs", () => {
    it("should delete audit logs older than retention period", async () => {
      const org1: Organisation = {
        id: "org-1",
        auditLogRetentionDays: 365,
      } as Organisation;
      const org2: Organisation = {
        id: "org-2",
        auditLogRetentionDays: null,
      } as Organisation;

      mockOrganisationRepository.find.mockResolvedValue([org1, org2]);

      const auditLogs1 = Array.from({ length: 5 }, (_, i) => ({
        id: `log-${i + 1}`,
        organisationId: "org-1",
      }));

      const auditLogs2 = Array.from({ length: 5 }, (_, i) => ({
        id: `log-${i + 6}`,
        organisationId: "org-2",
      }));

      mockAuditLogRepository.find
        .mockResolvedValueOnce(auditLogs1)
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce(auditLogs2)
        .mockResolvedValueOnce([]);

      mockAuditLogRepository.delete.mockResolvedValue({ affected: 1 } as any);

      const result = await service.deleteOldAuditLogs();

      expect(result).toBe(10);
      expect(mockAuditLogRepository.find).toHaveBeenCalled();
      expect(mockAuditLogRepository.delete).toHaveBeenCalledTimes(2);
      expect(mockAuditService.record).toHaveBeenCalledTimes(2);
      expect(mockAuditService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "retention.deleted",
          actorType: "system",
          resourceType: "audit_log",
          organisationId: "org-1",
          metadata: expect.objectContaining({
            retentionPolicy: "audit_logs",
            recordsDeleted: 5,
          }),
        }),
      );
    });

    it("should handle no organisations", async () => {
      mockOrganisationRepository.find.mockResolvedValue([]);

      const result = await service.deleteOldAuditLogs();

      expect(result).toBe(0);
      expect(mockAuditLogRepository.createQueryBuilder).not.toHaveBeenCalled();
    });
  });

  describe("deleteOldEvaluations", () => {
    it("should delete evaluations older than retention period", async () => {
      const project: Project = {
        id: "project-1",
        evaluationRetentionDays: 90,
      } as Project;

      mockProjectRepository.find.mockResolvedValue([project]);

      const oldEvaluation: Evaluation = {
        id: "eval-1",
        projectId: "project-1",
        createdAt: new Date(Date.now() - 100 * 24 * 60 * 60 * 1000),
      } as Evaluation;

      mockEvaluationRepository.find
        .mockResolvedValueOnce([oldEvaluation])
        .mockResolvedValueOnce([]);
      mockEvaluationRepository.delete.mockResolvedValue({ affected: 1 } as any);

      const result = await service.deleteOldEvaluations();

      expect(result).toBe(1);
      expect(mockEvaluationRepository.find).toHaveBeenCalled();
      expect(mockEvaluationRepository.delete).toHaveBeenCalledWith(["eval-1"]);
      expect(mockAuditService.record).toHaveBeenCalled();
    });

    it("should use default retention when project retention is null", async () => {
      const project: Project = {
        id: "project-1",
        evaluationRetentionDays: null,
      } as Project;

      mockProjectRepository.find.mockResolvedValue([project]);

      mockEvaluationRepository.find.mockResolvedValue([]);

      await service.deleteOldEvaluations();

      expect(mockEvaluationRepository.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            createdAt: expect.any(Object),
          }),
          take: 1000,
        }),
      );
    });
  });

  describe("deleteOldExperiments", () => {
    it("should delete experiments and associated evaluations", async () => {
      const project: Project = {
        id: "project-1",
        experimentRetentionDays: 90,
      } as Project;

      mockProjectRepository.find.mockResolvedValue([project]);

      const oldExperiment: Experiment = {
        id: "exp-1",
        projectId: "project-1",
        createdAt: new Date(Date.now() - 100 * 24 * 60 * 60 * 1000),
      } as Experiment;
      mockExperimentRepository.find
        .mockResolvedValueOnce([oldExperiment])
        .mockResolvedValueOnce([oldExperiment])
        .mockResolvedValueOnce([]);

      const evaluationToDelete: Evaluation = {
        id: "eval-1",
        projectId: "project-1",
        evaluationScope: EvaluationScope.EXPERIMENT,
      } as Evaluation;

      const mockEvalQueryBuilder = {
        innerJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([evaluationToDelete]),
      };

      mockEvaluationRepository.createQueryBuilder.mockReturnValue(
        mockEvalQueryBuilder as any,
      );
      mockEvaluationRepository.delete.mockResolvedValue({ affected: 1 } as any);
      mockExperimentRepository.delete.mockResolvedValue({ affected: 1 } as any);

      const result = await service.deleteOldExperiments();

      expect(result).toBe(1);
      expect(mockEvaluationRepository.delete).toHaveBeenCalledWith(["eval-1"]);
      expect(mockExperimentRepository.delete).toHaveBeenCalledWith(["exp-1"]);
      expect(mockAuditService.record).toHaveBeenCalled();
    });

    it("should handle experiments with no associated evaluations", async () => {
      const project: Project = {
        id: "project-1",
        experimentRetentionDays: 90,
      } as Project;

      mockProjectRepository.find.mockResolvedValue([project]);

      const oldExperiment: Experiment = {
        id: "exp-1",
        projectId: "project-1",
        createdAt: new Date(Date.now() - 100 * 24 * 60 * 60 * 1000),
      } as Experiment;
      mockExperimentRepository.find
        .mockResolvedValueOnce([oldExperiment])
        .mockResolvedValueOnce([oldExperiment])
        .mockResolvedValueOnce([]);

      const mockEvalQueryBuilder = {
        innerJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      };

      mockEvaluationRepository.createQueryBuilder.mockReturnValue(
        mockEvalQueryBuilder as any,
      );
      mockExperimentRepository.delete.mockResolvedValue({ affected: 1 } as any);

      const result = await service.deleteOldExperiments();

      expect(result).toBe(1);
      expect(mockEvaluationRepository.delete).not.toHaveBeenCalled();
      expect(mockExperimentRepository.delete).toHaveBeenCalledWith(["exp-1"]);
    });
  });

  describe("deleteOldOrganisationInvitations", () => {
    it("should delete expired and revoked invitations", async () => {
      const mockQueryBuilder1 = {
        delete: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue({ affected: 5 }),
      };

      const mockQueryBuilder2 = {
        delete: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue({ affected: 3 }),
      };

      mockOrganisationInvitationRepository.createQueryBuilder
        .mockReturnValueOnce(mockQueryBuilder1 as any)
        .mockReturnValueOnce(mockQueryBuilder2 as any);

      const result = await service.deleteOldOrganisationInvitations();

      expect(result).toBe(8);
      expect(
        mockOrganisationInvitationRepository.createQueryBuilder,
      ).toHaveBeenCalledTimes(2);
      expect(mockAuditService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "retention.deleted",
          metadata: expect.objectContaining({
            retentionPolicy: "organisation_invitations",
            recordsDeleted: 8,
          }),
        }),
      );
    });

    it("should handle no invitations to delete", async () => {
      const mockQueryBuilder1 = {
        delete: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue({ affected: 0 }),
      };

      const mockQueryBuilder2 = {
        delete: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue({ affected: 0 }),
      };

      mockOrganisationInvitationRepository.createQueryBuilder
        .mockReturnValueOnce(mockQueryBuilder1 as any)
        .mockReturnValueOnce(mockQueryBuilder2 as any);

      const result = await service.deleteOldOrganisationInvitations();

      expect(result).toBe(0);
      expect(mockAuditService.record).not.toHaveBeenCalled();
    });
  });

  describe("runAllRetentionPolicies", () => {
    it("should run all retention policies and return report", async () => {
      mockOrganisationRepository.find.mockResolvedValue([]);
      mockProjectRepository.find.mockResolvedValue([]);
      mockOrganisationInvitationRepository.createQueryBuilder.mockReturnValue({
        delete: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue({ affected: 0 }),
      } as any);

      const report = await service.runAllRetentionPolicies();

      expect(report).toHaveProperty("timestamp");
      expect(report.policies).toHaveLength(4);
      expect(report.policies[0]).toHaveProperty("name");
      expect(report.policies[0]).toHaveProperty("recordsDeleted");
      expect(report.policies[0]).toHaveProperty("executionTimeMs");
    });

    it("should handle errors in individual policies", async () => {
      mockOrganisationRepository.find.mockRejectedValue(new Error("DB Error"));
      mockProjectRepository.find.mockResolvedValue([]);
      mockOrganisationInvitationRepository.createQueryBuilder.mockReturnValue({
        delete: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue({ affected: 0 }),
      } as any);

      const report = await service.runAllRetentionPolicies();

      expect(report.policies[0]).toHaveProperty("error");
      expect(report.policies[0].error).toContain("DB Error");
    });
  });
});
