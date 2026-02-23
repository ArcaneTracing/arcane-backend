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

jest.mock(
  "../../../src/annotation-queue/guards/conversations-queue.guard",
  () => ({
    ConversationsQueueGuard: jest.fn(() => ({
      canActivate: jest.fn(() => true),
    })),
  }),
);

jest.mock(
  "../../../src/annotation-queue/guards/conversation-config-exists.guard",
  () => ({
    ConversationConfigExistsGuard: jest.fn(() => ({
      canActivate: jest.fn(() => true),
    })),
  }),
);

jest.mock(
  "../../../src/annotation-queue/interceptors/datasource-belongs-to-organisation.interceptor",
  () => ({
    DatasourceBelongsToOrganisationInterceptor: jest.fn(() => ({
      intercept: jest.fn((context, next) => next.handle()),
    })),
  }),
);

import { Test, TestingModule } from "@nestjs/testing";
import { ConversationController } from "../../../src/annotation-queue/controllers/conversation.controller";
import { ConversationService } from "../../../src/annotation-queue/services/conversation.service";
import { EnqueueConversationRequestDto } from "../../../src/annotation-queue/dto/request/enqueue-conversation-request.dto";
import { QueuedConversationResponseDto } from "../../../src/annotation-queue/dto/response/queued-conversation-response.dto";
import { MessageResponseDto } from "../../../src/annotation-queue/dto/response/message-response.dto";

describe("ConversationController", () => {
  let controller: ConversationController;
  let service: ConversationService;

  const mockService = {
    addConversationToQueue: jest.fn(),
    removeConversationFromQueue: jest.fn(),
  };

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ConversationController],
      providers: [
        {
          provide: ConversationService,
          useValue: mockService,
        },
      ],
    }).compile();

    controller = module.get<ConversationController>(ConversationController);
    service = module.get<ConversationService>(ConversationService);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("addConversationToQueue", () => {
    it("should add a conversation to the queue", async () => {
      const queueId = "queue-1";
      const userId = "user-1";
      const enqueueRequest: EnqueueConversationRequestDto = {
        otelConversationId: "conv-1",
        conversationConfigId: "config-1",
        datasourceId: "datasource-1",
        otelTraceIds: ["trace-1", "trace-2"],
        startDate: "2024-01-01T00:00:00Z",
        endDate: "2024-01-02T00:00:00Z",
      };

      const mockUserSession = {
        user: {
          id: userId,
        },
      };

      const mockResponse: QueuedConversationResponseDto = {
        id: "conv-1",
        otelConversationId: "conv-1",
        conversationConfigId: "config-1",
        datasourceId: "datasource-1",
        traceIds: ["trace-1", "trace-2"],
        startDate: "2024-01-01T00:00:00Z",
        endDate: "2024-01-02T00:00:00Z",
      };

      mockService.addConversationToQueue.mockResolvedValue(mockResponse);

      const result = await controller.addConversationToQueue(
        queueId,
        enqueueRequest,
        mockUserSession as any,
      );

      expect(mockService.addConversationToQueue).toHaveBeenCalledWith(
        queueId,
        userId,
        enqueueRequest,
      );
      expect(result).toEqual(mockResponse);
    });
  });

  describe("removeConversationFromQueue", () => {
    it("should remove a conversation from the queue", async () => {
      const queueId = "queue-1";
      const id = "conv-1";
      const mockResponse: MessageResponseDto = {
        message: "Conversation removed from queue successfully",
      };

      mockService.removeConversationFromQueue.mockResolvedValue(mockResponse);

      const result = await controller.removeConversationFromQueue(queueId, id);

      expect(mockService.removeConversationFromQueue).toHaveBeenCalledWith(
        id,
        queueId,
      );
      expect(result).toEqual(mockResponse);
    });
  });
});
