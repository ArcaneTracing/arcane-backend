import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { NotFoundException } from "@nestjs/common";
import { Repository } from "typeorm";
import { AnnotationValidator } from "../../../src/annotation-queue/validators/annotation.validator";
import { AnnotationQueue } from "../../../src/annotation-queue/entities/annotation-queue.entity";
import { QueuedTrace } from "../../../src/annotation-queue/entities/queued-trace.entity";
import { QueuedConversation } from "../../../src/annotation-queue/entities/queued-conversation.entity";
import { AnnotationQueueType } from "../../../src/annotation-queue/entities/annotation-queue-type.enum";
import { CreateAnnotationRequestDto } from "../../../src/annotation-queue/dto/request/create-annotation-request.dto";

describe("AnnotationValidator", () => {
  let validator: AnnotationValidator;
  let annotationQueueRepository: Repository<AnnotationQueue>;
  let queueTraceRepository: Repository<QueuedTrace>;
  let conversationRepository: Repository<QueuedConversation>;

  const mockAnnotationQueueRepository = {
    findOne: jest.fn(),
  };

  const mockQueueTraceRepository = {
    exists: jest.fn(),
  };

  const mockConversationRepository = {
    exists: jest.fn(),
  };

  const mockTracesQueue: AnnotationQueue = {
    id: "queue-1",
    projectId: "project-1",
    type: AnnotationQueueType.TRACES,
  } as AnnotationQueue;

  const mockConversationsQueue: AnnotationQueue = {
    id: "queue-1",
    projectId: "project-1",
    type: AnnotationQueueType.CONVERSATIONS,
  } as AnnotationQueue;

  let module: TestingModule;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      providers: [
        AnnotationValidator,
        {
          provide: getRepositoryToken(AnnotationQueue),
          useValue: mockAnnotationQueueRepository,
        },
        {
          provide: getRepositoryToken(QueuedTrace),
          useValue: mockQueueTraceRepository,
        },
        {
          provide: getRepositoryToken(QueuedConversation),
          useValue: mockConversationRepository,
        },
      ],
    }).compile();

    validator = module.get<AnnotationValidator>(AnnotationValidator);
    annotationQueueRepository = module.get<Repository<AnnotationQueue>>(
      getRepositoryToken(AnnotationQueue),
    );
    queueTraceRepository = module.get<Repository<QueuedTrace>>(
      getRepositoryToken(QueuedTrace),
    );
    conversationRepository = module.get<Repository<QueuedConversation>>(
      getRepositoryToken(QueuedConversation),
    );
  });

  afterAll(async () => {
    await module.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("validateDto", () => {
    it("should validate trace annotation for TRACES queue", async () => {
      const queueId = "queue-1";
      const projectId = "project-1";
      const createDto: CreateAnnotationRequestDto = {
        traceId: "trace-1",
        answers: [],
      };

      mockAnnotationQueueRepository.findOne.mockResolvedValue(mockTracesQueue);
      mockQueueTraceRepository.exists.mockResolvedValue(true);

      await validator.validateDto(createDto, queueId, projectId);

      expect(mockAnnotationQueueRepository.findOne).toHaveBeenCalledWith({
        where: { id: queueId, projectId },
        select: ["type"],
      });
      expect(mockQueueTraceRepository.exists).toHaveBeenCalledWith({
        where: { id: "trace-1", queueId },
      });
    });

    it("should validate conversation annotation for CONVERSATIONS queue", async () => {
      const queueId = "queue-1";
      const projectId = "project-1";
      const createDto: CreateAnnotationRequestDto = {
        conversationId: "conv-1",
        answers: [],
      };

      mockAnnotationQueueRepository.findOne.mockResolvedValue(
        mockConversationsQueue,
      );
      mockConversationRepository.exists.mockResolvedValue(true);

      await validator.validateDto(createDto, queueId, projectId);

      expect(mockAnnotationQueueRepository.findOne).toHaveBeenCalledWith({
        where: { id: queueId, projectId },
        select: ["type"],
      });
      expect(mockConversationRepository.exists).toHaveBeenCalledWith({
        where: { id: "conv-1", queueId },
      });
    });

    it("should not validate trace for CONVERSATIONS queue", async () => {
      const queueId = "queue-1";
      const projectId = "project-1";
      const createDto: CreateAnnotationRequestDto = {
        conversationId: "conv-1",
        answers: [],
      };

      mockAnnotationQueueRepository.findOne.mockResolvedValue(
        mockConversationsQueue,
      );
      mockConversationRepository.exists.mockResolvedValue(true);

      await validator.validateDto(createDto, queueId, projectId);

      expect(mockQueueTraceRepository.exists).not.toHaveBeenCalled();
    });

    it("should not validate conversation for TRACES queue", async () => {
      const queueId = "queue-1";
      const projectId = "project-1";
      const createDto: CreateAnnotationRequestDto = {
        traceId: "trace-1",
        answers: [],
      };

      mockAnnotationQueueRepository.findOne.mockResolvedValue(mockTracesQueue);
      mockQueueTraceRepository.exists.mockResolvedValue(true);

      await validator.validateDto(createDto, queueId, projectId);

      expect(mockConversationRepository.exists).not.toHaveBeenCalled();
    });
  });

  describe("validateQueueTraceExists", () => {
    it("should throw NotFoundException when traceId is missing", async () => {
      const queueId = "queue-1";

      const promise = validator.validateQueueTraceExists(queueId, undefined);
      await expect(promise).rejects.toThrow(NotFoundException);
      await expect(promise).rejects.toThrow(
        "Queue trace ID missing in queue with type trace",
      );
      expect(mockQueueTraceRepository.exists).not.toHaveBeenCalled();
    });

    it("should throw NotFoundException when queue trace does not exist", async () => {
      const queueId = "queue-1";
      const queueTraceId = "trace-1";

      mockQueueTraceRepository.exists.mockResolvedValue(false);

      const promise = validator.validateQueueTraceExists(queueId, queueTraceId);
      await expect(promise).rejects.toThrow(NotFoundException);
      await expect(promise).rejects.toThrow(
        `Queue trace with ID ${queueTraceId} not found in queue ${queueId}`,
      );
    });

    it("should pass when queue trace exists", async () => {
      const queueId = "queue-1";
      const queueTraceId = "trace-1";

      mockQueueTraceRepository.exists.mockResolvedValue(true);

      await validator.validateQueueTraceExists(queueId, queueTraceId);

      expect(mockQueueTraceRepository.exists).toHaveBeenCalledWith({
        where: { id: queueTraceId, queueId },
      });
    });
  });

  describe("validateConversationExists", () => {
    it("should throw NotFoundException when conversationId is missing", async () => {
      const queueId = "queue-1";

      const promise = validator.validateConversationExists(queueId, undefined);
      await expect(promise).rejects.toThrow(NotFoundException);
      await expect(promise).rejects.toThrow(
        "Conversation ID missing in queue with type trace",
      );
      expect(mockConversationRepository.exists).not.toHaveBeenCalled();
    });

    it("should throw NotFoundException when conversation does not exist", async () => {
      const queueId = "queue-1";
      const conversationId = "conv-1";

      mockConversationRepository.exists.mockResolvedValue(false);

      const promise = validator.validateConversationExists(
        queueId,
        conversationId,
      );
      await expect(promise).rejects.toThrow(NotFoundException);
      await expect(promise).rejects.toThrow(
        `Queued conversation with ID ${conversationId} not found in queue ${queueId}`,
      );
    });

    it("should pass when conversation exists", async () => {
      const queueId = "queue-1";
      const conversationId = "conv-1";

      mockConversationRepository.exists.mockResolvedValue(true);

      await validator.validateConversationExists(queueId, conversationId);

      expect(mockConversationRepository.exists).toHaveBeenCalledWith({
        where: { id: conversationId, queueId },
      });
    });
  });
});
