import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { Repository, QueryRunner } from "typeorm";
import { AnnotationUpdateService } from "../../../src/annotation-queue/services/annotation-update.service";
import { AnnotationManagementService } from "../../../src/annotation-queue/services/annotation-management.service";
import { Annotation } from "../../../src/annotation-queue/entities/annotation.entity";
import { AnnotationAnswer } from "../../../src/annotation-queue/entities/annotation-answer.entity";
import {
  AnnotationMapper,
  AnnotationAnswerMapper,
} from "../../../src/annotation-queue/mappers";
import { UpdateAnnotationRequestDto } from "../../../src/annotation-queue/dto/request/update-annotation-request.dto";
import { AuditService } from "../../../src/audit/audit.service";
import { AnnotationQueue } from "../../../src/annotation-queue/entities/annotation-queue.entity";
import { Project } from "../../../src/projects/entities/project.entity";
import { QueuedTrace } from "../../../src/annotation-queue/entities/queued-trace.entity";

jest.mock("../../../src/annotation-queue/mappers");

describe("AnnotationUpdateService", () => {
  let service: AnnotationUpdateService;
  let annotationRepository: Repository<Annotation>;
  let annotationManagementService: AnnotationManagementService;

  const mockQueryBuilder = {
    delete: jest.fn().mockReturnThis(),
    from: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    execute: jest.fn(),
  };

  const mockManager = {
    createQueryBuilder: jest.fn().mockReturnValue(mockQueryBuilder),
  };

  const mockAnnotationRepository = {
    save: jest.fn(),
    findOne: jest.fn(),
    manager: mockManager,
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

  const mockAnnotationManagementService = {
    findById: jest.fn(),
  };

  const mockTrace: QueuedTrace = {
    id: "trace-1",
    queueId: "queue-1",
  } as QueuedTrace;

  const mockAnnotation: Annotation = {
    id: "annotation-1",
    traceId: "trace-1",
    conversationId: null,
    trace: mockTrace,
    conversation: null,
    answers: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  } as Annotation;

  const mockAnswerDto = {
    questionId: "question-1",
    value: "answer value",
  };

  const mockAnswerEntity: AnnotationAnswer = {
    id: "answer-1",
    annotationId: "annotation-1",
    questionId: "question-1",
    value: "answer value",
  } as AnnotationAnswer;

  let module: TestingModule;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      providers: [
        AnnotationUpdateService,
        {
          provide: getRepositoryToken(Annotation),
          useValue: mockAnnotationRepository,
        },
        {
          provide: AnnotationManagementService,
          useValue: mockAnnotationManagementService,
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

    service = module.get<AnnotationUpdateService>(AnnotationUpdateService);
    annotationRepository = module.get<Repository<Annotation>>(
      getRepositoryToken(Annotation),
    );
    annotationManagementService = module.get<AnnotationManagementService>(
      AnnotationManagementService,
    );
  });

  afterAll(async () => {
    await module.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("updateAnnotationAnswer", () => {
    it("should update annotation answers successfully", async () => {
      const annotationId = "annotation-1";
      const updateDto: UpdateAnnotationRequestDto = {
        answers: [mockAnswerDto],
      };

      const updatedAnnotation = {
        ...mockAnnotation,
        answers: [mockAnswerEntity],
      };

      const mockResponseDto = {
        id: "annotation-1",
        queueId: "queue-1",
        answers: [
          { id: "answer-1", questionId: "question-1", value: "answer value" },
        ],
      };

      const queue = { id: "queue-1", projectId: "project-1" };
      const project = { id: "project-1", organisationId: "org-1" };
      mockAnnotationRepository.findOne.mockResolvedValue(mockAnnotation);
      mockAnnotationQueueRepository.findOne.mockResolvedValue(queue);
      mockProjectRepository.findOne.mockResolvedValue(project);
      mockQueryBuilder.execute.mockResolvedValue(undefined);
      (AnnotationAnswerMapper.toEntity as jest.Mock).mockReturnValue(
        mockAnswerEntity,
      );
      mockAnnotationRepository.save.mockResolvedValue(updatedAnnotation);
      (AnnotationMapper.toDto as jest.Mock).mockReturnValue(mockResponseDto);

      const result = await service.updateAnnotationAnswer(
        annotationId,
        updateDto,
      );

      expect(mockAnnotationRepository.findOne).toHaveBeenCalledWith({
        where: { id: annotationId },
        relations: ["answers", "trace", "conversation"],
      });
      expect(mockAnnotationQueueRepository.findOne).toHaveBeenCalledWith({
        where: { id: "queue-1" },
        select: ["id", "projectId"],
      });
      expect(mockProjectRepository.findOne).toHaveBeenCalledWith({
        where: { id: "project-1" },
        select: ["id", "organisationId"],
      });
      expect(mockManager.createQueryBuilder).toHaveBeenCalled();
      expect(mockQueryBuilder.delete).toHaveBeenCalled();
      expect(mockQueryBuilder.from).toHaveBeenCalledWith(AnnotationAnswer);
      expect(mockQueryBuilder.where).toHaveBeenCalledWith(
        "annotationId = :annotationId",
        {
          annotationId,
        },
      );
      expect(mockQueryBuilder.execute).toHaveBeenCalled();
      expect(AnnotationAnswerMapper.toEntity).toHaveBeenCalledWith(
        mockAnswerDto,
        mockAnnotation,
        annotationId,
      );
      expect(mockAnnotationRepository.save).toHaveBeenCalledWith({
        ...mockAnnotation,
        answers: [mockAnswerEntity],
      });
      expect(mockAuditService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "annotation.updated",
          actorType: "user",
          resourceType: "annotation",
          resourceId: annotationId,
          organisationId: "org-1",
          projectId: "project-1",
          beforeState: expect.objectContaining({
            id: annotationId,
            traceId: mockAnnotation.traceId,
            answersCount: 0,
          }),
          afterState: expect.objectContaining({
            id: updatedAnnotation.id,
            answersCount: 1,
          }),
          metadata: expect.objectContaining({
            queueId: "queue-1",
            projectId: "project-1",
            previousAnswersCount: 0,
            newAnswersCount: 1,
          }),
        }),
      );
      expect(result).toEqual(mockResponseDto);
    });

    it("should handle empty answers array", async () => {
      const annotationId = "annotation-1";
      const updateDto: UpdateAnnotationRequestDto = {
        answers: [],
      };

      const updatedAnnotation = {
        ...mockAnnotation,
        answers: [],
      };

      const mockResponseDto = {
        id: "annotation-1",
        queueId: "queue-1",
        answers: [],
      };

      const queue = { id: "queue-1", projectId: "project-1" };
      const project = { id: "project-1", organisationId: "org-1" };
      mockAnnotationRepository.findOne.mockResolvedValue(mockAnnotation);
      mockAnnotationQueueRepository.findOne.mockResolvedValue(queue);
      mockProjectRepository.findOne.mockResolvedValue(project);
      mockQueryBuilder.execute.mockResolvedValue(undefined);
      mockAnnotationRepository.save.mockResolvedValue(updatedAnnotation);
      (AnnotationMapper.toDto as jest.Mock).mockReturnValue(mockResponseDto);

      const result = await service.updateAnnotationAnswer(
        annotationId,
        updateDto,
      );

      expect(mockAnnotationRepository.save).toHaveBeenCalledWith({
        ...mockAnnotation,
        answers: [],
      });
      expect(result).toEqual(mockResponseDto);
    });

    it("should handle multiple answers", async () => {
      const annotationId = "annotation-1";
      const updateDto: UpdateAnnotationRequestDto = {
        answers: [
          mockAnswerDto,
          { questionId: "question-2", value: "answer 2" },
        ],
      };

      const answerEntity2: AnnotationAnswer = {
        id: "answer-2",
        annotationId: "annotation-1",
        questionId: "question-2",
        value: "answer 2",
      } as AnnotationAnswer;

      const updatedAnnotation = {
        ...mockAnnotation,
        answers: [mockAnswerEntity, answerEntity2],
      };

      const mockResponseDto = {
        id: "annotation-1",
        queueId: "queue-1",
        answers: [
          { id: "answer-1", questionId: "question-1", value: "answer value" },
          { id: "answer-2", questionId: "question-2", value: "answer 2" },
        ],
      };

      const queue = { id: "queue-1", projectId: "project-1" };
      const project = { id: "project-1", organisationId: "org-1" };
      mockAnnotationRepository.findOne.mockResolvedValue(mockAnnotation);
      mockAnnotationQueueRepository.findOne.mockResolvedValue(queue);
      mockProjectRepository.findOne.mockResolvedValue(project);
      mockQueryBuilder.execute.mockResolvedValue(undefined);
      (AnnotationAnswerMapper.toEntity as jest.Mock)
        .mockReturnValueOnce(mockAnswerEntity)
        .mockReturnValueOnce(answerEntity2);
      mockAnnotationRepository.save.mockResolvedValue(updatedAnnotation);
      (AnnotationMapper.toDto as jest.Mock).mockReturnValue(mockResponseDto);

      const result = await service.updateAnnotationAnswer(
        annotationId,
        updateDto,
      );

      expect(AnnotationAnswerMapper.toEntity).toHaveBeenCalledTimes(2);
      expect(mockAnnotationRepository.save).toHaveBeenCalledWith({
        ...mockAnnotation,
        answers: [mockAnswerEntity, answerEntity2],
      });
      expect(result).toEqual(mockResponseDto);
    });
  });
});
