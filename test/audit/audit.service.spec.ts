import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { AuditService } from "../../src/audit/audit.service";
import { AuditLog } from "../../src/audit/entities/audit-log.entity";
import { DatabaseAuditSink } from "../../src/audit/sinks/database-audit-sink";
import { AuditEvent } from "../../src/audit/dto/audit-event.dto";
import { PaginatedAuditLogsResponseDto } from "../../src/audit/dto/response/paginated-audit-logs-response.dto";
import { Logger } from "@nestjs/common";

describe("AuditService", () => {
  let service: AuditService;
  let auditLogRepository: Repository<AuditLog>;
  let sink: DatabaseAuditSink;

  const mockAuditLogRepository = {
    createQueryBuilder: jest.fn(),
  };

  const mockSink = {
    write: jest.fn(),
  };

  const mockAuditLog: AuditLog = {
    id: "audit-1",
    action: "organisation.created",
    actorId: "user-1",
    actorType: "user",
    resourceType: "organisation",
    resourceId: "org-1",
    organisationId: "org-1",
    projectId: null,
    metadata: { creatorId: "user-1" },
    beforeState: null,
    afterState: { id: "org-1", name: "Test Org" },
    createdAt: new Date("2024-01-01"),
  };

  const mockAuditEvent: AuditEvent = {
    action: "organisation.created",
    actorId: "user-1",
    actorType: "user",
    resourceType: "organisation",
    resourceId: "org-1",
    organisationId: "org-1",
    metadata: { creatorId: "user-1" },
    afterState: { id: "org-1", name: "Test Org" },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuditService,
        {
          provide: getRepositoryToken(AuditLog),
          useValue: mockAuditLogRepository,
        },
        {
          provide: DatabaseAuditSink,
          useValue: mockSink,
        },
      ],
    }).compile();

    service = module.get<AuditService>(AuditService);
    auditLogRepository = module.get<Repository<AuditLog>>(
      getRepositoryToken(AuditLog),
    );
    sink = module.get<DatabaseAuditSink>(DatabaseAuditSink);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("record", () => {
    it("should write event to sink", async () => {
      mockSink.write.mockResolvedValue(undefined);

      await service.record(mockAuditEvent);

      expect(mockSink.write).toHaveBeenCalledWith([mockAuditEvent]);
    });

    it("should handle sink write errors gracefully", async () => {
      const error = new Error("Sink write failed");
      mockSink.write.mockRejectedValue(error);
      const loggerErrorSpy = jest
        .spyOn(Logger.prototype, "error")
        .mockImplementation();

      await service.record(mockAuditEvent);

      expect(mockSink.write).toHaveBeenCalledWith([mockAuditEvent]);
      expect(loggerErrorSpy).toHaveBeenCalledWith(
        "Failed to persist audit event",
        error,
      );

      loggerErrorSpy.mockRestore();
    });
  });

  describe("recordNow", () => {
    it("should write event to sink immediately", async () => {
      mockSink.write.mockResolvedValue(undefined);

      await service.recordNow(mockAuditEvent);

      expect(mockSink.write).toHaveBeenCalledWith([mockAuditEvent]);
    });

    it("should handle sink write errors gracefully", async () => {
      const error = new Error("Sink write failed");
      mockSink.write.mockRejectedValue(error);
      const loggerErrorSpy = jest
        .spyOn(Logger.prototype, "error")
        .mockImplementation();

      await service.recordNow(mockAuditEvent);

      expect(mockSink.write).toHaveBeenCalledWith([mockAuditEvent]);
      expect(loggerErrorSpy).toHaveBeenCalledWith(
        "Failed to persist audit event",
        error,
      );

      loggerErrorSpy.mockRestore();
    });
  });

  describe("findLogs", () => {
    it("should return all audit logs without filters", async () => {
      const mockQueryBuilder = {
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([mockAuditLog]),
      };
      mockAuditLogRepository.createQueryBuilder.mockReturnValue(
        mockQueryBuilder,
      );

      const result = await service.findLogs({});

      expect(mockAuditLogRepository.createQueryBuilder).toHaveBeenCalledWith(
        "audit",
      );
      expect(mockQueryBuilder.andWhere).not.toHaveBeenCalled();
      expect(mockQueryBuilder.orderBy).toHaveBeenCalledWith(
        "audit.created_at",
        "DESC",
      );
      expect(mockQueryBuilder.limit).toHaveBeenCalledWith(50);
      expect(mockQueryBuilder.getMany).toHaveBeenCalled();
      expect(result).toEqual([mockAuditLog]);
    });

    it("should filter by organisationId", async () => {
      const organisationId = "org-1";
      const mockQueryBuilder = {
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([mockAuditLog]),
      };
      mockAuditLogRepository.createQueryBuilder.mockReturnValue(
        mockQueryBuilder,
      );

      const result = await service.findLogs({ organisationId });

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        "audit.organisation_id = :orgId",
        {
          orgId: organisationId,
        },
      );
      expect(result).toEqual([mockAuditLog]);
    });

    it("should filter by projectId", async () => {
      const projectId = "project-1";
      const mockQueryBuilder = {
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      };
      mockAuditLogRepository.createQueryBuilder.mockReturnValue(
        mockQueryBuilder,
      );

      const result = await service.findLogs({ projectId });

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        "audit.project_id = :projectId",
        {
          projectId,
        },
      );
      expect(result).toEqual([]);
    });

    it("should filter by action", async () => {
      const action = "organisation.created";
      const mockQueryBuilder = {
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([mockAuditLog]),
      };
      mockAuditLogRepository.createQueryBuilder.mockReturnValue(
        mockQueryBuilder,
      );

      const result = await service.findLogs({ action });

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        "audit.action = :action",
        { action },
      );
      expect(result).toEqual([mockAuditLog]);
    });

    it("should filter by cursor", async () => {
      const cursor = "2024-01-02T00:00:00.000Z";
      const cursorDate = new Date(cursor);
      const mockQueryBuilder = {
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([mockAuditLog]),
      };
      mockAuditLogRepository.createQueryBuilder.mockReturnValue(
        mockQueryBuilder,
      );

      const result = await service.findLogs({ cursor });

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        "audit.created_at < :cursor",
        {
          cursor: cursorDate,
        },
      );
      expect(result).toEqual([mockAuditLog]);
    });

    it("should use custom limit", async () => {
      const limit = 10;
      const mockQueryBuilder = {
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([mockAuditLog]),
      };
      mockAuditLogRepository.createQueryBuilder.mockReturnValue(
        mockQueryBuilder,
      );

      const result = await service.findLogs({ limit });

      expect(mockQueryBuilder.limit).toHaveBeenCalledWith(limit);
      expect(result).toEqual([mockAuditLog]);
    });

    it("should apply all filters together", async () => {
      const organisationId = "org-1";
      const projectId = "project-1";
      const action = "organisation.created";
      const cursor = "2024-01-02T00:00:00.000Z";
      const limit = 20;
      const mockQueryBuilder = {
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([mockAuditLog]),
      };
      mockAuditLogRepository.createQueryBuilder.mockReturnValue(
        mockQueryBuilder,
      );

      const result = await service.findLogs({
        organisationId,
        projectId,
        action,
        cursor,
        limit,
      });

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledTimes(4);
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        "audit.organisation_id = :orgId",
        { orgId: organisationId },
      );
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        "audit.project_id = :projectId",
        {
          projectId,
        },
      );
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        "audit.action = :action",
        { action },
      );
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        "audit.created_at < :cursor",
        {
          cursor: new Date(cursor),
        },
      );
      expect(mockQueryBuilder.limit).toHaveBeenCalledWith(limit);
      expect(result).toEqual([mockAuditLog]);
    });
  });

  describe("findLogsPaginated", () => {
    it("should return paginated audit logs without filters", async () => {
      const mockQueryBuilder = {
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([mockAuditLog]),
      };
      mockAuditLogRepository.createQueryBuilder.mockReturnValue(
        mockQueryBuilder,
      );

      const result = await service.findLogsPaginated({});

      expect(mockAuditLogRepository.createQueryBuilder).toHaveBeenCalledWith(
        "audit",
      );
      expect(mockQueryBuilder.andWhere).not.toHaveBeenCalled();
      expect(mockQueryBuilder.orderBy).toHaveBeenCalledWith(
        "audit.created_at",
        "DESC",
      );
      expect(mockQueryBuilder.limit).toHaveBeenCalledWith(51);
      expect(result).toHaveProperty("data");
      expect(result).toHaveProperty("nextCursor");
      expect(result).toHaveProperty("hasMore");
      expect(result).toHaveProperty("limit");
      expect(result.data).toEqual([mockAuditLog]);
      expect(result.hasMore).toBe(false);
      expect(result.limit).toBe(50);
      expect(result.nextCursor).toBe(mockAuditLog.createdAt.toISOString());
    });

    it("should return paginated audit logs with hasMore when more results exist", async () => {
      const extraLog: AuditLog = {
        ...mockAuditLog,
        id: "audit-2",
        createdAt: new Date("2024-01-02"),
      };
      const mockQueryBuilder = {
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([mockAuditLog, extraLog]),
      };
      mockAuditLogRepository.createQueryBuilder.mockReturnValue(
        mockQueryBuilder,
      );

      const result = await service.findLogsPaginated({ limit: 1 });

      expect(result.data).toEqual([mockAuditLog]);
      expect(result.hasMore).toBe(true);
      expect(result.limit).toBe(1);
      expect(result.nextCursor).toBe(mockAuditLog.createdAt.toISOString());
    });

    it("should return paginated audit logs with null nextCursor when no results", async () => {
      const mockQueryBuilder = {
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      };
      mockAuditLogRepository.createQueryBuilder.mockReturnValue(
        mockQueryBuilder,
      );

      const result = await service.findLogsPaginated({});

      expect(result.data).toEqual([]);
      expect(result.hasMore).toBe(false);
      expect(result.nextCursor).toBeNull();
      expect(result.limit).toBe(50);
    });

    it("should filter by organisationId with pagination", async () => {
      const organisationId = "org-1";
      const mockQueryBuilder = {
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([mockAuditLog]),
      };
      mockAuditLogRepository.createQueryBuilder.mockReturnValue(
        mockQueryBuilder,
      );

      const result = await service.findLogsPaginated({ organisationId });

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        "audit.organisation_id = :orgId",
        {
          orgId: organisationId,
        },
      );
      expect(result.data).toEqual([mockAuditLog]);
      expect(result.hasMore).toBe(false);
    });

    it("should filter by action pattern with pagination", async () => {
      const action = "organisation.*";
      const mockQueryBuilder = {
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([mockAuditLog]),
      };
      mockAuditLogRepository.createQueryBuilder.mockReturnValue(
        mockQueryBuilder,
      );

      const result = await service.findLogsPaginated({ action });

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        "audit.action LIKE :action",
        {
          action: "organisation.%",
        },
      );
      expect(result.data).toEqual([mockAuditLog]);
    });

    it("should use custom limit with pagination", async () => {
      const limit = 10;
      const mockQueryBuilder = {
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([mockAuditLog]),
      };
      mockAuditLogRepository.createQueryBuilder.mockReturnValue(
        mockQueryBuilder,
      );

      const result = await service.findLogsPaginated({ limit });

      expect(mockQueryBuilder.limit).toHaveBeenCalledWith(11);
      expect(result.limit).toBe(limit);
    });

    it("should filter by cursor with pagination", async () => {
      const cursor = "2024-01-02T00:00:00.000Z";
      const cursorDate = new Date(cursor);
      const mockQueryBuilder = {
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([mockAuditLog]),
      };
      mockAuditLogRepository.createQueryBuilder.mockReturnValue(
        mockQueryBuilder,
      );

      const result = await service.findLogsPaginated({ cursor });

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        "audit.created_at < :cursor",
        {
          cursor: cursorDate,
        },
      );
      expect(result.data).toEqual([mockAuditLog]);
    });
  });
});
