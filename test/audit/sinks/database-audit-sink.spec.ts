import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { DatabaseAuditSink } from "../../../src/audit/sinks/database-audit-sink";
import { AuditLog } from "../../../src/audit/entities/audit-log.entity";
import { AuditEvent } from "../../../src/audit/dto/audit-event.dto";
import { Logger } from "@nestjs/common";

describe("DatabaseAuditSink", () => {
  let sink: DatabaseAuditSink;
  let auditLogRepository: Repository<AuditLog>;

  const mockAuditLogRepository = {
    save: jest.fn(),
  };

  const mockAuditEvent: AuditEvent = {
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

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DatabaseAuditSink,
        {
          provide: getRepositoryToken(AuditLog),
          useValue: mockAuditLogRepository,
        },
      ],
    }).compile();

    sink = module.get<DatabaseAuditSink>(DatabaseAuditSink);
    auditLogRepository = module.get<Repository<AuditLog>>(
      getRepositoryToken(AuditLog),
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("write", () => {
    it("should return early when events array is empty", async () => {
      await sink.write([]);

      expect(mockAuditLogRepository.save).not.toHaveBeenCalled();
    });

    it("should save a single audit event", async () => {
      const savedLog = { ...mockAuditLog };
      mockAuditLogRepository.save.mockResolvedValue([savedLog]);
      const loggerDebugSpy = jest
        .spyOn(Logger.prototype, "debug")
        .mockImplementation();

      await sink.write([mockAuditEvent]);

      expect(mockAuditLogRepository.save).toHaveBeenCalledTimes(1);
      const savedRecords = mockAuditLogRepository.save.mock.calls[0][0];
      expect(savedRecords).toHaveLength(1);
      expect(savedRecords[0]).toBeInstanceOf(AuditLog);
      expect(savedRecords[0].action).toBe(mockAuditEvent.action);
      expect(savedRecords[0].actorId).toBe(mockAuditEvent.actorId);
      expect(savedRecords[0].actorType).toBe(mockAuditEvent.actorType);
      expect(savedRecords[0].resourceType).toBe(mockAuditEvent.resourceType);
      expect(savedRecords[0].resourceId).toBe(mockAuditEvent.resourceId);
      expect(savedRecords[0].metadata).toEqual(mockAuditEvent.metadata);
      expect(savedRecords[0].beforeState).toBe(mockAuditEvent.beforeState);
      expect(savedRecords[0].afterState).toBe(mockAuditEvent.afterState);
      expect(savedRecords[0].organisationId).toBe(
        mockAuditEvent.organisationId,
      );
      expect(savedRecords[0].projectId).toBe(mockAuditEvent.projectId);
      expect(loggerDebugSpy).toHaveBeenCalledWith("Persisted 1 audit events");

      loggerDebugSpy.mockRestore();
    });

    it("should save multiple audit events", async () => {
      const secondEvent: AuditEvent = {
        action: "organisation.updated",
        actorId: "user-1",
        actorType: "user",
        resourceType: "organisation",
        resourceId: "org-1",
        organisationId: "org-1",
        metadata: { changedFields: ["name"] },
        beforeState: { id: "org-1", name: "Old Name" },
        afterState: { id: "org-1", name: "New Name" },
      };
      const savedLogs = [
        mockAuditLog,
        { ...mockAuditLog, id: "audit-2", action: "organisation.updated" },
      ];
      mockAuditLogRepository.save.mockResolvedValue(savedLogs);
      const loggerDebugSpy = jest
        .spyOn(Logger.prototype, "debug")
        .mockImplementation();

      await sink.write([mockAuditEvent, secondEvent]);

      expect(mockAuditLogRepository.save).toHaveBeenCalledTimes(1);
      const savedRecords = mockAuditLogRepository.save.mock.calls[0][0];
      expect(savedRecords).toHaveLength(2);
      expect(savedRecords[0].action).toBe(mockAuditEvent.action);
      expect(savedRecords[1].action).toBe(secondEvent.action);
      expect(loggerDebugSpy).toHaveBeenCalledWith("Persisted 2 audit events");

      loggerDebugSpy.mockRestore();
    });

    it("should handle events with optional fields", async () => {
      const eventWithoutOptionalFields: AuditEvent = {
        action: "organisation.deleted",
        actorType: "user",
        resourceType: "organisation",
        resourceId: "org-1",
      };
      const savedLog = { ...mockAuditLog, action: "organisation.deleted" };
      mockAuditLogRepository.save.mockResolvedValue([savedLog]);
      const loggerDebugSpy = jest
        .spyOn(Logger.prototype, "debug")
        .mockImplementation();

      await sink.write([eventWithoutOptionalFields]);

      const savedRecords = mockAuditLogRepository.save.mock.calls[0][0];
      expect(savedRecords[0].action).toBe(eventWithoutOptionalFields.action);
      expect(savedRecords[0].actorId).toBeUndefined();
      expect(savedRecords[0].actorType).toBe(
        eventWithoutOptionalFields.actorType,
      );
      expect(savedRecords[0].metadata).toBeUndefined();
      expect(savedRecords[0].beforeState).toBeUndefined();
      expect(savedRecords[0].afterState).toBeUndefined();
      expect(savedRecords[0].organisationId).toBeUndefined();
      expect(savedRecords[0].projectId).toBeUndefined();
      expect(loggerDebugSpy).toHaveBeenCalledWith("Persisted 1 audit events");

      loggerDebugSpy.mockRestore();
    });

    it("should handle events with null values", async () => {
      const eventWithNulls: AuditEvent = {
        action: "organisation.deleted",
        actorType: "user",
        resourceType: "organisation",
        resourceId: "org-1",
        organisationId: "org-1",
        beforeState: { id: "org-1", name: "Test Org" },
        afterState: null,
      };
      const savedLog = {
        ...mockAuditLog,
        action: "organisation.deleted",
        afterState: null,
      };
      mockAuditLogRepository.save.mockResolvedValue([savedLog]);
      const loggerDebugSpy = jest
        .spyOn(Logger.prototype, "debug")
        .mockImplementation();

      await sink.write([eventWithNulls]);

      const savedRecords = mockAuditLogRepository.save.mock.calls[0][0];
      expect(savedRecords[0].beforeState).toEqual(eventWithNulls.beforeState);
      expect(savedRecords[0].afterState).toBeNull();
      expect(loggerDebugSpy).toHaveBeenCalledWith("Persisted 1 audit events");

      loggerDebugSpy.mockRestore();
    });

    it("should handle system actor type", async () => {
      const systemEvent: AuditEvent = {
        action: "evaluation.completed",
        actorType: "system",
        resourceType: "evaluation",
        resourceId: "eval-1",
        organisationId: "org-1",
        projectId: "project-1",
        metadata: { evaluationId: "eval-1" },
      };
      const savedLog = {
        ...mockAuditLog,
        action: "evaluation.completed",
        actorType: "system",
      };
      mockAuditLogRepository.save.mockResolvedValue([savedLog]);
      const loggerDebugSpy = jest
        .spyOn(Logger.prototype, "debug")
        .mockImplementation();

      await sink.write([systemEvent]);

      const savedRecords = mockAuditLogRepository.save.mock.calls[0][0];
      expect(savedRecords[0].actorType).toBe("system");
      expect(savedRecords[0].projectId).toBe("project-1");
      expect(loggerDebugSpy).toHaveBeenCalledWith("Persisted 1 audit events");

      loggerDebugSpy.mockRestore();
    });
  });
});
