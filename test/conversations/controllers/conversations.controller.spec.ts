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

import { Test, TestingModule } from "@nestjs/testing";
import { ConversationsController } from "../../../src/conversations/conversations.controller";
import { ConversationsService } from "../../../src/conversations/conversations.service";
import { GetConversationsRequestDto } from "../../../src/conversations/dto/request/get-conversations-request.dto";
import { GetFullConversationRequestDto } from "../../../src/conversations/dto/request/get-full-conversation-request.dto";
import { GetConversationsByTracesRequestDto } from "../../../src/conversations/dto/request/get-conversations-by-traces-request.dto";

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

describe("ConversationsController", () => {
  let controller: ConversationsController;
  let service: ConversationsService;

  const mockService = {
    getConversationsByTraceIds: jest.fn(),
    getConversations: jest.fn(),
    getFullConversation: jest.fn(),
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

  let module: TestingModule;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      controllers: [ConversationsController],
      providers: [
        {
          provide: ConversationsService,
          useValue: mockService,
        },
      ],
    }).compile();

    controller = module.get<ConversationsController>(ConversationsController);
    service = module.get<ConversationsService>(ConversationsService);
  });

  afterAll(async () => {
    await module.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("getConversationsByTraceIds", () => {
    const query: GetConversationsByTracesRequestDto = {
      traceIds: ["trace-1", "trace-2"],
      startDate: "2024-01-01T00:00:00.000Z",
      endDate: "2024-01-02T00:00:00.000Z",
    };

    const mockResult = {
      traces: [{ traceID: "trace-1" }],
    };

    it("should get conversations by trace IDs", async () => {
      mockService.getConversationsByTraceIds.mockResolvedValue(mockResult);

      const result = await controller.getConversationsByTraceIds(
        "org-1",
        "project-1",
        "datasource-1",
        mockUserSession,
        query,
      );

      expect(result).toEqual(mockResult);
      expect(service.getConversationsByTraceIds).toHaveBeenCalledWith(
        "org-1",
        "project-1",
        "datasource-1",
        "user-1",
        query,
      );
    });
  });

  describe("getConversations", () => {
    const query: GetConversationsRequestDto = {
      start: "2024-01-01T00:00:00.000Z",
      end: "2024-01-02T00:00:00.000Z",
    };

    const mockResult = {
      conversations: [
        {
          conversationId: "459",
          name: "LangGraph",
          traceIds: ["trace-1", "trace-2"],
          traceCount: 2,
        },
      ],
    };

    it("should get conversations", async () => {
      mockService.getConversations.mockResolvedValue(mockResult);

      const result = await controller.getConversations(
        "org-1",
        "project-1",
        "datasource-1",
        "config-1",
        mockUserSession,
        query,
      );

      expect(result).toEqual(mockResult);
      expect(service.getConversations).toHaveBeenCalledWith(
        "org-1",
        "project-1",
        "datasource-1",
        "config-1",
        "user-1",
        query,
      );
    });
  });

  describe("getFullConversation", () => {
    const body: GetFullConversationRequestDto = {
      start: "2024-01-01T00:00:00.000Z",
      end: "2024-01-02T00:00:00.000Z",
      value: "459",
    };

    const mockResult = {
      traces: [{ traceID: "trace-1" }],
    };

    it("should get full conversation", async () => {
      mockService.getFullConversation.mockResolvedValue(mockResult);

      const result = await controller.getFullConversation(
        "org-1",
        "project-1",
        "datasource-1",
        "config-1",
        mockUserSession,
        body,
      );

      expect(result).toEqual(mockResult);
      expect(service.getFullConversation).toHaveBeenCalledWith(
        "org-1",
        "project-1",
        "datasource-1",
        "config-1",
        "user-1",
        body,
      );
    });
  });
});
