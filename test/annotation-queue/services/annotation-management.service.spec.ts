import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { NotFoundException } from "@nestjs/common";
import { Repository } from "typeorm";
import { AnnotationManagementService } from "../../../src/annotation-queue/services/annotation-management.service";
import { Annotation } from "../../../src/annotation-queue/entities/annotation.entity";
import { AnnotationMapper } from "../../../src/annotation-queue/mappers";
import {
  ERROR_MESSAGES,
  formatError,
} from "../../../src/common/constants/error-messages.constants";
import { AuditService } from "../../../src/audit/audit.service";
import { AnnotationQueue } from "../../../src/annotation-queue/entities/annotation-queue.entity";
import { Project } from "../../../src/projects/entities/project.entity";
import { QueuedTrace } from "../../../src/annotation-queue/entities/queued-trace.entity";

jest.mock("../../../src/annotation-queue/mappers");

describe("AnnotationManagementService", () => {
  let service: AnnotationManagementService;
  let repository: Repository<Annotation>;

  const mockRepository = {
    findOne: jest.fn(),
    remove: jest.fn(),
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

  let module: TestingModule;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      providers: [
        AnnotationManagementService,
        {
          provide: getRepositoryToken(Annotation),
          useValue: mockRepository,
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

    service = module.get<AnnotationManagementService>(
      AnnotationManagementService,
    );
    repository = module.get<Repository<Annotation>>(
      getRepositoryToken(Annotation),
    );
  });

  afterAll(async () => {
    await module.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("findById", () => {
    it("should return annotation when found", async () => {
      mockRepository.findOne.mockResolvedValue(mockAnnotation);

      const result = await service.findById("annotation-1");

      expect(mockRepository.findOne).toHaveBeenCalledWith({
        where: { id: "annotation-1" },
        relations: ["answers"],
      });
      expect(result).toEqual(mockAnnotation);
    });

    it("should throw NotFoundException when annotation does not exist", async () => {
      mockRepository.findOne.mockResolvedValue(null);

      const promise = service.findById("annotation-1");
      await expect(promise).rejects.toThrow(NotFoundException);
      await expect(promise).rejects.toThrow(
        formatError(ERROR_MESSAGES.ANNOTATION_NOT_FOUND),
      );
    });
  });

  describe("removeAnnotation", () => {
    it("should remove annotation successfully", async () => {
      const queue = { id: "queue-1", projectId: "project-1" };
      const project = { id: "project-1", organisationId: "org-1" };
      mockRepository.findOne.mockResolvedValue(mockAnnotation);
      mockAnnotationQueueRepository.findOne.mockResolvedValue(queue);
      mockProjectRepository.findOne.mockResolvedValue(project);
      mockRepository.remove.mockResolvedValue(mockAnnotation);
      (AnnotationMapper.toMessageResponse as jest.Mock).mockReturnValue({
        message: "Annotation deleted successfully",
      });

      const result = await service.removeAnnotation("annotation-1");

      expect(mockRepository.findOne).toHaveBeenCalledWith({
        where: { id: "annotation-1" },
        relations: ["trace", "conversation", "answers"],
      });
      expect(mockAnnotationQueueRepository.findOne).toHaveBeenCalledWith({
        where: { id: "queue-1" },
        select: ["id", "projectId"],
      });
      expect(mockProjectRepository.findOne).toHaveBeenCalledWith({
        where: { id: "project-1" },
        select: ["id", "organisationId"],
      });
      expect(mockRepository.remove).toHaveBeenCalledWith(mockAnnotation);
      expect(mockAuditService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "annotation.deleted",
          actorType: "user",
          resourceType: "annotation",
          resourceId: "annotation-1",
          organisationId: "org-1",
          projectId: "project-1",
          beforeState: expect.objectContaining({
            id: "annotation-1",
            traceId: mockAnnotation.traceId,
            answersCount: 0,
          }),
          afterState: null,
          metadata: expect.objectContaining({
            queueId: "queue-1",
            projectId: "project-1",
          }),
        }),
      );
      expect(AnnotationMapper.toMessageResponse).toHaveBeenCalledWith(
        "Annotation deleted successfully",
      );
      expect(result).toEqual({ message: "Annotation deleted successfully" });
    });

    it("should throw NotFoundException when annotation does not exist", async () => {
      mockRepository.findOne.mockResolvedValue(null);

      const promise = service.removeAnnotation("annotation-1");
      await expect(promise).rejects.toThrow(NotFoundException);
      await expect(promise).rejects.toThrow(
        formatError(ERROR_MESSAGES.ANNOTATION_NOT_FOUND),
      );
      expect(mockRepository.remove).not.toHaveBeenCalled();
    });
  });
});
