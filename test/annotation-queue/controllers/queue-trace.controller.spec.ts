jest.mock("@thallesp/nestjs-better-auth", () => ({
  Session:
    () => (target: any, propertyKey: string, parameterIndex: number) => {},
  UserSession: class UserSession {},
}));

jest.mock("../../../src/rbac/guards/org-project-permission.guard", () => ({
  OrgProjectPermissionGuard: jest.fn(() => ({
    canActivate: jest.fn(() => true),
  })),
}));

jest.mock(
  "../../../src/annotation-queue/guards/queue-belongs-to-project.guard",
  () => ({
    QueueBelongsToProjectGuard: jest.fn(() => ({
      canActivate: jest.fn(() => true),
    })),
  }),
);

jest.mock("../../../src/annotation-queue/guards/traces-queue.guard", () => ({
  TracesQueueGuard: jest.fn(() => ({
    canActivate: jest.fn(() => true),
  })),
}));

jest.mock(
  "../../../src/annotation-queue/interceptors/datasource-belongs-to-organisation.interceptor",
  () => ({
    DatasourceBelongsToOrganisationInterceptor: jest.fn(() => ({
      intercept: jest.fn((context, next) => next.handle()),
    })),
  }),
);

import { Test, TestingModule } from "@nestjs/testing";
import { QueueTraceController } from "../../../src/annotation-queue/controllers/queue-trace.controller";
import { QueuedTraceService } from "../../../src/annotation-queue/services/queued-trace.service";
import { EnqueueTraceRequestDto } from "../../../src/annotation-queue/dto/request/enqueue-trace-request.dto";
import { EnqueueTraceBulkRequestDto } from "../../../src/annotation-queue/dto/request/enqueue-trace-bulk-request.dto";
import { QueuedTraceResponseDto } from "../../../src/annotation-queue/dto/response/queued-trace-response.dto";
import { BulkQueueTraceResponseDto } from "../../../src/annotation-queue/dto/response/bulk-queue-trace-response.dto";
import { MessageResponseDto } from "../../../src/annotation-queue/dto/response/message-response.dto";

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

describe("QueueTraceController", () => {
  let controller: QueueTraceController;
  let service: QueuedTraceService;

  const mockService = {
    addTraceToQueue: jest.fn(),
    addTracesToQueueBulk: jest.fn(),
    removeTraceFromQueue: jest.fn(),
    removeTraceFromQueueByOtelTraceId: jest.fn(),
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
      email: "user@example.com",
      name: "Test User",
      emailVerified: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  };

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [QueueTraceController],
      providers: [
        {
          provide: QueuedTraceService,
          useValue: mockService,
        },
      ],
    }).compile();

    controller = module.get<QueueTraceController>(QueueTraceController);
    service = module.get<QueuedTraceService>(QueuedTraceService);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("addTraceToQueue", () => {
    it("should add a trace to the queue", async () => {
      const queueId = "queue-1";
      const createDto: EnqueueTraceRequestDto = {
        otelTraceId: "trace-1",
        datasourceId: "datasource-1",
        startDate: "2024-01-01T00:00:00Z",
        endDate: "2024-01-02T00:00:00Z",
      };

      const mockResponse: QueuedTraceResponseDto = {
        id: "trace-1",
        otelTraceId: "trace-1",
        datasourceId: "datasource-1",
        startDate: "2024-01-01T00:00:00Z",
        endDate: "2024-01-02T00:00:00Z",
      };

      mockService.addTraceToQueue.mockResolvedValue(mockResponse);

      const result = await controller.addTraceToQueue(
        queueId,
        createDto,
        mockUserSession,
      );

      expect(mockService.addTraceToQueue).toHaveBeenCalledWith(
        queueId,
        "user-1",
        createDto,
      );
      expect(result).toEqual(mockResponse);
    });
  });

  describe("addTracesToQueueBulk", () => {
    it("should add multiple traces to the queue", async () => {
      const queueId = "queue-1";
      const createDto: EnqueueTraceBulkRequestDto = {
        otelTraceIds: ["trace-1", "trace-2", "trace-3"],
        datasourceId: "datasource-1",
        startDate: "2024-01-01T00:00:00Z",
        endDate: "2024-01-02T00:00:00Z",
      };

      const mockResponse: BulkQueueTraceResponseDto = {
        added: [
          { id: "qt-1", otelTraceId: "trace-1", datasourceId: "datasource-1" },
          { id: "qt-2", otelTraceId: "trace-2", datasourceId: "datasource-1" },
          { id: "qt-3", otelTraceId: "trace-3", datasourceId: "datasource-1" },
        ],

        skipped: [],
        total: 3,
        addedCount: 3,
        skippedCount: 0,
      };

      mockService.addTracesToQueueBulk.mockResolvedValue(mockResponse);

      const result = await controller.addTracesToQueueBulk(
        queueId,
        createDto,
        mockUserSession,
      );

      expect(mockService.addTracesToQueueBulk).toHaveBeenCalledWith(
        queueId,
        "user-1",
        createDto,
      );
      expect(result).toEqual(mockResponse);
    });
  });

  describe("removeTraceFromQueueById", () => {
    it("should remove a trace from the queue by id", async () => {
      const queueId = "queue-1";
      const id = "trace-1";
      const mockResponse: MessageResponseDto = {
        message: "Trace removed from queue successfully",
      };

      mockService.removeTraceFromQueue.mockResolvedValue(mockResponse);

      const result = await controller.removeTraceFromQueueById(queueId, id);

      expect(mockService.removeTraceFromQueue).toHaveBeenCalledWith(
        queueId,
        id,
      );
      expect(result).toEqual(mockResponse);
    });
  });

  describe("removeTraceFromQueue", () => {
    it("should remove a trace from the queue by otelTraceId", async () => {
      const queueId = "queue-1";
      const otelTraceId = "trace-1";
      const mockResponse: MessageResponseDto = {
        message: "Trace removed from queue successfully",
      };

      mockService.removeTraceFromQueueByOtelTraceId.mockResolvedValue(
        mockResponse,
      );

      const result = await controller.removeTraceFromQueue(
        queueId,
        otelTraceId,
      );

      expect(
        mockService.removeTraceFromQueueByOtelTraceId,
      ).toHaveBeenCalledWith(queueId, otelTraceId);
      expect(result).toEqual(mockResponse);
    });
  });
});
