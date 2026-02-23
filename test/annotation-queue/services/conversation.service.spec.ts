import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { NotFoundException, BadRequestException } from "@nestjs/common";
import { Repository } from "typeorm";
import { ConversationService } from "../../../src/annotation-queue/services/conversation.service";
import { QueuedConversation } from "../../../src/annotation-queue/entities/queued-conversation.entity";
import { ConversationMapper } from "../../../src/annotation-queue/mappers/conversation.mapper";
import { EnqueueConversationRequestDto } from "../../../src/annotation-queue/dto/request/enqueue-conversation-request.dto";
import {
  ERROR_MESSAGES,
  formatError,
} from "../../../src/common/constants/error-messages.constants";

jest.mock("../../../src/annotation-queue/mappers/conversation.mapper");

describe("ConversationService", () => {
  let service: ConversationService;
  let repository: Repository<QueuedConversation>;

  const mockRepository = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    remove: jest.fn(),
    existsBy: jest.fn(),
  };

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ConversationService,
        {
          provide: getRepositoryToken(QueuedConversation),
          useValue: mockRepository,
        },
      ],
    }).compile();

    service = module.get<ConversationService>(ConversationService);
    repository = module.get<Repository<QueuedConversation>>(
      getRepositoryToken(QueuedConversation),
    );
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("addConversationToQueue", () => {
    it("should add a conversation to the queue", async () => {
      const queueId = "queue-1";
      const userId = "user-1";
      const createDto: EnqueueConversationRequestDto = {
        otelConversationId: "conv-1",
        conversationConfigId: "config-1",
        datasourceId: "datasource-1",
        otelTraceIds: ["trace-1", "trace-2"],
        startDate: "2024-01-01T00:00:00Z",
        endDate: "2024-01-02T00:00:00Z",
      };

      const mockEntity = {
        id: "conv-1",
        ...createDto,
        startDate: new Date("2024-01-01T00:00:00Z"),
        endDate: new Date("2024-01-02T00:00:00Z"),
      } as unknown as Partial<QueuedConversation>;
      const mockSavedEntity = {
        id: "conv-1",
        ...createDto,
        startDate: new Date("2024-01-01T00:00:00Z"),
        endDate: new Date("2024-01-02T00:00:00Z"),
      } as unknown as QueuedConversation;
      const mockResponseDto = {
        id: "conv-1",
        otelConversationId: "conv-1",
        conversationConfigId: "config-1",
        datasourceId: "datasource-1",
        traceIds: ["trace-1", "trace-2"],
        startDate: "2024-01-01T00:00:00Z",
        endDate: "2024-01-02T00:00:00Z",
      };

      mockRepository.existsBy.mockResolvedValue(false);
      (ConversationMapper.toEntity as jest.Mock).mockReturnValue(mockEntity);
      mockRepository.create.mockReturnValue(mockEntity);
      mockRepository.save.mockResolvedValue(mockSavedEntity);
      (ConversationMapper.toDto as jest.Mock).mockReturnValue(mockResponseDto);

      const result = await service.addConversationToQueue(
        queueId,
        userId,
        createDto,
      );

      expect(mockRepository.existsBy).toHaveBeenCalledWith({
        queueId,
        conversationConfigId: createDto.conversationConfigId,
        datasourceId: createDto.datasourceId,
        otelConversationId: createDto.otelConversationId,
      });
      expect(ConversationMapper.toEntity).toHaveBeenCalledWith(
        createDto,
        queueId,
        userId,
      );
      expect(mockRepository.create).toHaveBeenCalledWith(mockEntity);
      expect(mockRepository.save).toHaveBeenCalledWith(mockEntity);
      expect(ConversationMapper.toDto).toHaveBeenCalledWith(mockSavedEntity);
      expect(result).toEqual(mockResponseDto);
    });

    it("should handle conversation without dates", async () => {
      const queueId = "queue-1";
      const userId = "user-1";
      const createDto: EnqueueConversationRequestDto = {
        otelConversationId: "conv-1",
        conversationConfigId: "config-1",
        datasourceId: "datasource-1",
        otelTraceIds: [],
      };

      const mockEntity = {
        id: "conv-1",
        ...createDto,
      } as unknown as Partial<QueuedConversation>;
      const mockSavedEntity = {
        id: "conv-1",
        ...createDto,
      } as unknown as QueuedConversation;
      const mockResponseDto = {
        id: "conv-1",
        otelConversationId: "conv-1",
        conversationConfigId: "config-1",
        datasourceId: "datasource-1",
        traceIds: [],
      };

      mockRepository.existsBy.mockResolvedValue(false);
      (ConversationMapper.toEntity as jest.Mock).mockReturnValue(mockEntity);
      mockRepository.create.mockReturnValue(mockEntity);
      mockRepository.save.mockResolvedValue(mockSavedEntity);
      (ConversationMapper.toDto as jest.Mock).mockReturnValue(mockResponseDto);

      const result = await service.addConversationToQueue(
        queueId,
        userId,
        createDto,
      );

      expect(result).toEqual(mockResponseDto);
    });

    it("should throw BadRequestException when conversation already exists", async () => {
      const queueId = "queue-1";
      const userId = "user-1";
      const createDto: EnqueueConversationRequestDto = {
        otelConversationId: "conv-1",
        conversationConfigId: "config-1",
        datasourceId: "datasource-1",
        otelTraceIds: ["trace-1"],
      };

      mockRepository.existsBy.mockResolvedValue(true);

      await expect(
        service.addConversationToQueue(queueId, userId, createDto),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.addConversationToQueue(queueId, userId, createDto),
      ).rejects.toThrow("Conversation already exists in this queue");

      expect(mockRepository.existsBy).toHaveBeenCalledWith({
        queueId,
        conversationConfigId: createDto.conversationConfigId,
        datasourceId: createDto.datasourceId,
        otelConversationId: createDto.otelConversationId,
      });
      expect(mockRepository.create).not.toHaveBeenCalled();
      expect(mockRepository.save).not.toHaveBeenCalled();
    });
  });

  describe("removeConversationFromQueue", () => {
    it("should remove a conversation from the queue", async () => {
      const conversationId = "conv-1";
      const queueId = "queue-1";
      const mockConversation = {
        id: conversationId,
        queueId,
        otelConversationId: "conv-1",
      } as QueuedConversation;

      mockRepository.findOne.mockResolvedValue(mockConversation);
      mockRepository.remove.mockResolvedValue(mockConversation);
      (ConversationMapper.toMessageResponse as jest.Mock).mockReturnValue({
        message: "Conversation removed from queue successfully",
      });

      const result = await service.removeConversationFromQueue(
        conversationId,
        queueId,
      );

      expect(mockRepository.findOne).toHaveBeenCalledWith({
        where: { id: conversationId, queueId },
      });
      expect(mockRepository.remove).toHaveBeenCalledWith(mockConversation);
      expect(ConversationMapper.toMessageResponse).toHaveBeenCalledWith(
        "Conversation removed from queue successfully",
      );
      expect(result).toEqual({
        message: "Conversation removed from queue successfully",
      });
    });

    it("should throw NotFoundException when conversation does not exist", async () => {
      const conversationId = "conv-1";
      const queueId = "queue-1";

      mockRepository.findOne.mockResolvedValue(null);

      const promise = service.removeConversationFromQueue(
        conversationId,
        queueId,
      );
      await expect(promise).rejects.toThrow(NotFoundException);
      await expect(promise).rejects.toThrow(
        formatError(
          ERROR_MESSAGES.CONVERSATION_NOT_FOUND,
          conversationId,
          queueId,
        ),
      );
      expect(mockRepository.remove).not.toHaveBeenCalled();
    });
  });
});
