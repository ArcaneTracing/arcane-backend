import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { NotFoundException } from "@nestjs/common";
import { Repository } from "typeorm";
import { AnnotationCreationService } from "../../../src/annotation-queue/services/annotation-creation.service";
import { AnnotationValidator } from "../../../src/annotation-queue/validators/annotation.validator";
import { Annotation } from "../../../src/annotation-queue/entities/annotation.entity";
import { QueuedTrace } from "../../../src/annotation-queue/entities/queued-trace.entity";
import { QueuedConversation } from "../../../src/annotation-queue/entities/queued-conversation.entity";
import { CreateAnnotationRequestDto } from "../../../src/annotation-queue/dto/request/create-annotation-request.dto";
import { AnnotationMapper } from "../../../src/annotation-queue/mappers";
import {
  ERROR_MESSAGES,
  formatError,
} from "../../../src/common/constants/error-messages.constants";
import { AuditService } from "../../../src/audit/audit.service";
import { AnnotationQueue } from "../../../src/annotation-queue/entities/annotation-queue.entity";
import { Project } from "../../../src/projects/entities/project.entity";

jest.mock("../../../src/annotation-queue/mappers");

describe("AnnotationCreationService", () => {
  let service: AnnotationCreationService;
  let annotationRepository: Repository<Annotation>;
  let queueTraceRepository: Repository<QueuedTrace>;
  let conversationRepository: Repository<QueuedConversation>;
  let annotationValidator: AnnotationValidator;

  const mockAnnotationRepository = {
    save: jest.fn(),
  };

  const mockQueueTraceRepository = {
    findOne: jest.fn(),
  };

  const mockConversationRepository = {
    findOne: jest.fn(),
  };

  const mockAnnotationValidator = {
    validateDto: jest.fn(),
  };

  const mockAnnotationQueueRepository = {
    findOne: jest.fn(),
  };

  const mockProjectRepository = {
    findOne: jest.fn(),
  };

  const mockAuditService = {
    record: jest.fn().mockResolvedValue(undefined),
  };

  const mockQueueTrace: QueuedTrace = {
    id: "trace-1",
    queueId: "queue-1",
    otelTraceId: "otel-trace-1",
    datasourceId: "datasource-1",
  } as QueuedTrace;

  const mockConversation: QueuedConversation = {
    id: "conv-1",
    queueId: "queue-1",
    otelConversationId: "otel-conv-1",
    conversationConfigId: "config-1",
    datasourceId: "datasource-1",
  } as QueuedConversation;

  const mockAnnotation: Annotation = {
    id: "annotation-1",
    traceId: "trace-1",
    conversationId: null,
    answers: [],
    startDate: null,
    endDate: null,
    createdById: "user-1",
    createdAt: new Date(),
    updatedAt: new Date(),
  } as Annotation;

  let module: TestingModule;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      providers: [
        AnnotationCreationService,
        {
          provide: getRepositoryToken(Annotation),
          useValue: mockAnnotationRepository,
        },
        {
          provide: getRepositoryToken(QueuedTrace),
          useValue: mockQueueTraceRepository,
        },
        {
          provide: getRepositoryToken(QueuedConversation),
          useValue: mockConversationRepository,
        },
        {
          provide: AnnotationValidator,
          useValue: mockAnnotationValidator,
        },
        {
          provide: getRepositoryToken(AnnotationQueue),
          useValue: mockAnnotationQueueRepository,
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

    service = module.get<AnnotationCreationService>(AnnotationCreationService);
    annotationRepository = module.get<Repository<Annotation>>(
      getRepositoryToken(Annotation),
    );
    queueTraceRepository = module.get<Repository<QueuedTrace>>(
      getRepositoryToken(QueuedTrace),
    );
    conversationRepository = module.get<Repository<QueuedConversation>>(
      getRepositoryToken(QueuedConversation),
    );
    annotationValidator = module.get<AnnotationValidator>(AnnotationValidator);
  });

  afterAll(async () => {
    await module.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("createAnnotation", () => {
    it("should create annotation from queue trace", async () => {
      const projectId = "project-1";
      const queueId = "queue-1";
      const userId = "user-1";
      const createDto: CreateAnnotationRequestDto = {
        traceId: "trace-1",
        answers: [],
      };

      const mockAnnotationEntity = {
        id: "annotation-1",
        ...createDto,
      } as Annotation;
      const mockResponseDto = {
        id: "annotation-1",
        queueId: "queue-1",
        answers: [],
      };

      const project = { id: "project-1", organisationId: "org-1" };
      mockProjectRepository.findOne.mockResolvedValue(project);
      mockAnnotationValidator.validateDto.mockResolvedValue(undefined);
      mockQueueTraceRepository.findOne.mockResolvedValue(mockQueueTrace);
      (AnnotationMapper.toEntityFromQueueTrace as jest.Mock).mockReturnValue(
        mockAnnotationEntity,
      );
      mockAnnotationRepository.save.mockResolvedValue(mockAnnotation);
      (AnnotationMapper.toDto as jest.Mock).mockReturnValue(mockResponseDto);

      const result = await service.createAnnotation(
        projectId,
        queueId,
        userId,
        createDto,
      );

      expect(mockProjectRepository.findOne).toHaveBeenCalledWith({
        where: { id: projectId },
        select: ["id", "organisationId"],
      });
      expect(mockAnnotationValidator.validateDto).toHaveBeenCalledWith(
        createDto,
        queueId,
        projectId,
      );
      expect(mockQueueTraceRepository.findOne).toHaveBeenCalledWith({
        where: { id: "trace-1", queueId },
      });
      expect(AnnotationMapper.toEntityFromQueueTrace).toHaveBeenCalledWith(
        mockQueueTrace,
        createDto,
        userId,
      );
      expect(mockAnnotationRepository.save).toHaveBeenCalledWith(
        mockAnnotationEntity,
      );
      expect(mockAuditService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "annotation.created",
          actorId: userId,
          actorType: "user",
          resourceType: "annotation",
          resourceId: mockAnnotation.id,
          organisationId: "org-1",
          projectId,
          afterState: expect.objectContaining({
            id: mockAnnotation.id,
            traceId: mockAnnotation.traceId,
          }),
          metadata: expect.objectContaining({
            queueId,
            projectId,
            traceId: createDto.traceId,
            answersCount: 0,
          }),
        }),
      );
      expect(result).toEqual(mockResponseDto);
    });

    it("should create annotation from queue conversation", async () => {
      const projectId = "project-1";
      const queueId = "queue-1";
      const userId = "user-1";
      const createDto: CreateAnnotationRequestDto = {
        conversationId: "conv-1",
        answers: [],
      };

      const mockAnnotationEntity = {
        id: "annotation-1",
        ...createDto,
      } as Annotation;
      const mockResponseDto = {
        id: "annotation-1",
        queueId: "queue-1",
        answers: [],
      };

      const project = { id: "project-1", organisationId: "org-1" };
      const mockAnnotationWithConversation = {
        ...mockAnnotation,
        traceId: null,
        conversationId: "conv-1",
      };
      mockProjectRepository.findOne.mockResolvedValue(project);
      mockAnnotationValidator.validateDto.mockResolvedValue(undefined);
      mockConversationRepository.findOne.mockResolvedValue(mockConversation);
      (AnnotationMapper.toEntityFromConversation as jest.Mock).mockReturnValue(
        mockAnnotationEntity,
      );
      mockAnnotationRepository.save.mockResolvedValue(
        mockAnnotationWithConversation,
      );
      (AnnotationMapper.toDto as jest.Mock).mockReturnValue(mockResponseDto);

      const result = await service.createAnnotation(
        projectId,
        queueId,
        userId,
        createDto,
      );

      expect(mockProjectRepository.findOne).toHaveBeenCalledWith({
        where: { id: projectId },
        select: ["id", "organisationId"],
      });
      expect(mockAnnotationValidator.validateDto).toHaveBeenCalledWith(
        createDto,
        queueId,
        projectId,
      );
      expect(mockConversationRepository.findOne).toHaveBeenCalledWith({
        where: { id: "conv-1", queueId },
      });
      expect(AnnotationMapper.toEntityFromConversation).toHaveBeenCalledWith(
        mockConversation,
        createDto,
        userId,
      );
      expect(mockAnnotationRepository.save).toHaveBeenCalledWith(
        mockAnnotationEntity,
      );
      expect(mockAuditService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "annotation.created",
          actorId: userId,
          actorType: "user",
          resourceType: "annotation",
          resourceId: mockAnnotationWithConversation.id,
          organisationId: "org-1",
          projectId,
          afterState: expect.objectContaining({
            id: mockAnnotationWithConversation.id,
            conversationId: mockAnnotationWithConversation.conversationId,
          }),
          metadata: expect.objectContaining({
            queueId,
            projectId,
            conversationId: createDto.conversationId,
            answersCount: 0,
          }),
        }),
      );
      expect(result).toEqual(mockResponseDto);
    });

    it("should throw NotFoundException when queue trace does not exist", async () => {
      const projectId = "project-1";
      const queueId = "queue-1";
      const userId = "user-1";
      const createDto: CreateAnnotationRequestDto = {
        traceId: "trace-1",
        answers: [],
      };

      mockAnnotationValidator.validateDto.mockResolvedValue(undefined);
      mockQueueTraceRepository.findOne.mockResolvedValue(null);

      const promise = service.createAnnotation(
        projectId,
        queueId,
        userId,
        createDto,
      );
      await expect(promise).rejects.toThrow(NotFoundException);
      await expect(promise).rejects.toThrow(
        formatError(
          ERROR_MESSAGES.QUEUE_TRACE_NOT_FOUND_IN_QUEUE,
          "trace-1",
          queueId,
        ),
      );
      expect(mockAnnotationRepository.save).not.toHaveBeenCalled();
    });

    it("should throw NotFoundException when conversation does not exist", async () => {
      const projectId = "project-1";
      const queueId = "queue-1";
      const userId = "user-1";
      const createDto: CreateAnnotationRequestDto = {
        conversationId: "conv-1",
        answers: [],
      };

      mockAnnotationValidator.validateDto.mockResolvedValue(undefined);
      mockConversationRepository.findOne.mockResolvedValue(null);

      const promise = service.createAnnotation(
        projectId,
        queueId,
        userId,
        createDto,
      );
      await expect(promise).rejects.toThrow(NotFoundException);
      await expect(promise).rejects.toThrow(
        formatError(
          ERROR_MESSAGES.QUEUED_CONVERSATION_NOT_FOUND_IN_QUEUE,
          "conv-1",
          queueId,
        ),
      );
      expect(mockAnnotationRepository.save).not.toHaveBeenCalled();
    });
  });
});
