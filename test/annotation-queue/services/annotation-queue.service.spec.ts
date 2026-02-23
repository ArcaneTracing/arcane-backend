import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { AnnotationQueueService } from "../../../src/annotation-queue/services/annotation-queue.service";
import { QueueTemplateService } from "../../../src/annotation-queue/services/queue-template.service";
import { AnnotationQueueValidator } from "../../../src/annotation-queue/validators/annotation-queue.validator";
import { AnnotationQueueUpdater } from "../../../src/annotation-queue/services/annotation-queue-updater.service";
import { AnnotationQueue } from "../../../src/annotation-queue/entities/annotation-queue.entity";
import { AnnotationTemplate } from "../../../src/annotation-queue/entities/annotation-template.entity";
import { AnnotationQueueType } from "../../../src/annotation-queue/entities/annotation-queue-type.enum";
import {
  CreateAnnotationQueueRequestDto,
  UpdateAnnotationQueueRequestDto,
} from "../../../src/annotation-queue/dto/request/create-annotation-queue-request.dto";
import { AuditService } from "../../../src/audit/audit.service";
import { Project } from "../../../src/projects/entities/project.entity";

describe("AnnotationQueueService", () => {
  let service: AnnotationQueueService;
  let annotationQueueRepository: Repository<AnnotationQueue>;
  let queueTemplateService: QueueTemplateService;
  let annotationQueueValidator: AnnotationQueueValidator;
  let annotationQueueUpdater: AnnotationQueueUpdater;

  const mockAnnotationQueueRepository = {
    find: jest.fn(),
    findOne: jest.fn(),
    save: jest.fn(),
    remove: jest.fn(),
  };

  const mockQueueTemplateService = {
    createTemplate: jest.fn(),
  };

  const mockAnnotationQueueValidator = {
    validateQueueExists: jest.fn(),
  };

  const mockAnnotationQueueUpdater = {
    applyUpdates: jest.fn(),
  };

  const mockProjectRepository = {
    findOne: jest.fn(),
  };

  const mockAuditService = {
    record: jest.fn().mockResolvedValue(undefined),
  };

  const mockTemplate: AnnotationTemplate = {
    id: "template-1",
    questions: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  } as AnnotationTemplate;

  const mockAnnotationQueue: AnnotationQueue = {
    id: "queue-1",
    name: "Test Queue",
    description: "Test Description",
    type: AnnotationQueueType.TRACES,
    projectId: "project-1",
    templateId: "template-1",
    template: mockTemplate,
    traces: [],
    conversations: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    createdById: "user-1",
  } as AnnotationQueue;

  let module: TestingModule;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      providers: [
        AnnotationQueueService,
        {
          provide: getRepositoryToken(AnnotationQueue),
          useValue: mockAnnotationQueueRepository,
        },
        {
          provide: getRepositoryToken(Project),
          useValue: mockProjectRepository,
        },
        {
          provide: QueueTemplateService,
          useValue: mockQueueTemplateService,
        },
        {
          provide: AnnotationQueueValidator,
          useValue: mockAnnotationQueueValidator,
        },
        {
          provide: AnnotationQueueUpdater,
          useValue: mockAnnotationQueueUpdater,
        },
        {
          provide: AuditService,
          useValue: mockAuditService,
        },
      ],
    }).compile();

    service = module.get<AnnotationQueueService>(AnnotationQueueService);
    annotationQueueRepository = module.get<Repository<AnnotationQueue>>(
      getRepositoryToken(AnnotationQueue),
    );
    queueTemplateService =
      module.get<QueueTemplateService>(QueueTemplateService);
    annotationQueueValidator = module.get<AnnotationQueueValidator>(
      AnnotationQueueValidator,
    );
    annotationQueueUpdater = module.get<AnnotationQueueUpdater>(
      AnnotationQueueUpdater,
    );
  });

  afterAll(async () => {
    await module.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("findAll", () => {
    it("should return all annotation queues for a project", async () => {
      mockAnnotationQueueRepository.find.mockResolvedValue([
        mockAnnotationQueue,
      ]);

      const result = await service.findAll("project-1");

      expect(mockAnnotationQueueRepository.find).toHaveBeenCalledWith({
        where: { projectId: "project-1" },
        relations: ["template", "template.questions"],
        order: { createdAt: "DESC" },
      });
      expect(result).toHaveLength(1);
      expect(result[0].id).toBeDefined();
    });

    it("should filter by type when provided", async () => {
      mockAnnotationQueueRepository.find.mockResolvedValue([
        mockAnnotationQueue,
      ]);

      const result = await service.findAll(
        "project-1",
        AnnotationQueueType.TRACES,
      );

      expect(mockAnnotationQueueRepository.find).toHaveBeenCalledWith({
        where: { projectId: "project-1", type: AnnotationQueueType.TRACES },
        relations: ["template", "template.questions"],
        order: { createdAt: "DESC" },
      });
      expect(result).toHaveLength(1);
    });

    it("should return empty array when no queues exist", async () => {
      mockAnnotationQueueRepository.find.mockResolvedValue([]);

      const result = await service.findAll("project-1");

      expect(result).toEqual([]);
    });
  });

  describe("create", () => {
    it("should create a new annotation queue", async () => {
      const createDto: CreateAnnotationQueueRequestDto = {
        name: "Test Queue",
        description: "Test Description",
        type: AnnotationQueueType.TRACES,
        template: {
          questions: [],
        },
      };
      const project = { id: "project-1", organisationId: "org-1" };
      mockProjectRepository.findOne.mockResolvedValue(project);
      mockQueueTemplateService.createTemplate.mockResolvedValue(mockTemplate);
      mockAnnotationQueueRepository.save.mockResolvedValue(mockAnnotationQueue);

      const result = await service.create("project-1", createDto, "user-1");

      expect(mockProjectRepository.findOne).toHaveBeenCalledWith({
        where: { id: "project-1" },
        select: ["id", "organisationId"],
      });
      expect(mockQueueTemplateService.createTemplate).toHaveBeenCalledWith(
        createDto.template.questions,
      );
      expect(mockAnnotationQueueRepository.save).toHaveBeenCalledWith({
        name: createDto.name,
        description: createDto.description,
        type: createDto.type,
        projectId: "project-1",
        template: mockTemplate,
        templateId: mockTemplate.id,
        createdById: "user-1",
      });
      expect(mockAuditService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "annotation_queue.created",
          actorId: "user-1",
          actorType: "user",
          resourceType: "annotation_queue",
          resourceId: mockAnnotationQueue.id,
          organisationId: "org-1",
          projectId: "project-1",
          afterState: expect.objectContaining({
            id: mockAnnotationQueue.id,
            name: mockAnnotationQueue.name,
            type: mockAnnotationQueue.type,
          }),
          metadata: expect.objectContaining({
            creatorId: "user-1",
            projectId: "project-1",
          }),
        }),
      );
      expect(result).toBeDefined();
    });

    it("should default to TRACES type when type not provided", async () => {
      const createDto: CreateAnnotationQueueRequestDto = {
        name: "Test Queue",
        template: {
          questions: [],
        },
      };
      const project = { id: "project-1", organisationId: "org-1" };
      mockProjectRepository.findOne.mockResolvedValue(project);
      mockQueueTemplateService.createTemplate.mockResolvedValue(mockTemplate);
      mockAnnotationQueueRepository.save.mockResolvedValue(mockAnnotationQueue);

      await service.create("project-1", createDto, "user-1");

      expect(mockAnnotationQueueRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          type: AnnotationQueueType.TRACES,
        }),
      );
    });
  });

  describe("findOne", () => {
    it("should return a single annotation queue with TRACES relations", async () => {
      const queueBasic = { id: "queue-1", type: AnnotationQueueType.TRACES };
      const queueWithRelations = {
        ...mockAnnotationQueue,
        traces: [],
      };
      mockAnnotationQueueRepository.findOne
        .mockResolvedValueOnce(queueBasic)
        .mockResolvedValueOnce(queueWithRelations);
      mockAnnotationQueueValidator.validateQueueExists.mockReturnValue(
        queueBasic,
      );

      const result = await service.findOne("project-1", "queue-1");

      expect(mockAnnotationQueueRepository.findOne).toHaveBeenCalledTimes(2);
      expect(mockAnnotationQueueRepository.findOne).toHaveBeenNthCalledWith(2, {
        where: { id: "queue-1", projectId: "project-1" },
        relations: [
          "template",
          "template.questions",
          "traces",
          "traces.annotations",
          "traces.annotations.answers",
          "traces.annotations.trace",
        ],
      });
      expect(result).toBeDefined();
    });

    it("should return a single annotation queue with CONVERSATIONS relations", async () => {
      const queueBasic = {
        id: "queue-1",
        type: AnnotationQueueType.CONVERSATIONS,
      };
      const queueWithRelations = {
        ...mockAnnotationQueue,
        type: AnnotationQueueType.CONVERSATIONS,
        conversations: [],
      };
      mockAnnotationQueueRepository.findOne
        .mockResolvedValueOnce(queueBasic)
        .mockResolvedValueOnce(queueWithRelations);
      mockAnnotationQueueValidator.validateQueueExists.mockReturnValue(
        queueBasic,
      );

      const result = await service.findOne("project-1", "queue-1");

      expect(mockAnnotationQueueRepository.findOne).toHaveBeenCalledTimes(2);
      expect(mockAnnotationQueueRepository.findOne).toHaveBeenNthCalledWith(2, {
        where: { id: "queue-1", projectId: "project-1" },
        relations: [
          "template",
          "template.questions",
          "conversations",
          "conversations.annotations",
          "conversations.annotations.answers",
          "conversations.annotations.conversation",
        ],
      });
      expect(result).toBeDefined();
    });
  });

  describe("update", () => {
    it("should update an annotation queue", async () => {
      const updateDto: UpdateAnnotationQueueRequestDto = {
        name: "Updated Queue",
      };
      const project = { id: "project-1", organisationId: "org-1" };
      const updatedQueue = { ...mockAnnotationQueue, name: "Updated Queue" };
      const queueWithRelations = {
        ...updatedQueue,
        traces: [],
        conversations: [],
      };
      mockProjectRepository.findOne.mockResolvedValue(project);
      mockAnnotationQueueRepository.findOne
        .mockResolvedValueOnce(mockAnnotationQueue)
        .mockResolvedValueOnce(queueWithRelations);
      mockAnnotationQueueValidator.validateQueueExists.mockReturnValue(
        mockAnnotationQueue,
      );
      mockAnnotationQueueRepository.save.mockResolvedValue(updatedQueue);

      const result = await service.update("project-1", "queue-1", updateDto);

      expect(mockProjectRepository.findOne).toHaveBeenCalledWith({
        where: { id: "project-1" },
        select: ["id", "organisationId"],
      });
      expect(
        mockAnnotationQueueValidator.validateQueueExists,
      ).toHaveBeenCalledWith(mockAnnotationQueue, "queue-1", "project-1");
      expect(mockAnnotationQueueUpdater.applyUpdates).toHaveBeenCalledWith(
        mockAnnotationQueue,
        updateDto,
      );
      expect(mockAnnotationQueueRepository.save).toHaveBeenCalled();
      expect(mockAuditService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "annotation_queue.updated",
          actorType: "user",
          resourceType: "annotation_queue",
          resourceId: "queue-1",
          organisationId: "org-1",
          projectId: "project-1",
          beforeState: expect.objectContaining({
            id: mockAnnotationQueue.id,
            name: mockAnnotationQueue.name,
          }),
          afterState: expect.objectContaining({
            id: updatedQueue.id,
            name: "Updated Queue",
          }),
          metadata: expect.objectContaining({
            changedFields: ["name"],
            projectId: "project-1",
          }),
        }),
      );
      expect(result).toBeDefined();
    });
  });

  describe("remove", () => {
    it("should remove an annotation queue", async () => {
      const project = { id: "project-1", organisationId: "org-1" };
      mockProjectRepository.findOne.mockResolvedValue(project);
      mockAnnotationQueueRepository.findOne.mockResolvedValue(
        mockAnnotationQueue,
      );
      mockAnnotationQueueValidator.validateQueueExists.mockReturnValue(
        mockAnnotationQueue,
      );
      mockAnnotationQueueRepository.remove.mockResolvedValue(
        mockAnnotationQueue,
      );

      const result = await service.remove("project-1", "queue-1");

      expect(mockProjectRepository.findOne).toHaveBeenCalledWith({
        where: { id: "project-1" },
        select: ["id", "organisationId"],
      });
      expect(
        mockAnnotationQueueValidator.validateQueueExists,
      ).toHaveBeenCalledWith(mockAnnotationQueue, "queue-1", "project-1");
      expect(mockAnnotationQueueRepository.remove).toHaveBeenCalledWith(
        mockAnnotationQueue,
      );
      expect(mockAuditService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "annotation_queue.deleted",
          actorType: "user",
          resourceType: "annotation_queue",
          resourceId: "queue-1",
          organisationId: "org-1",
          projectId: "project-1",
          beforeState: expect.objectContaining({
            id: mockAnnotationQueue.id,
            name: mockAnnotationQueue.name,
          }),
          afterState: null,
          metadata: expect.objectContaining({
            projectId: "project-1",
          }),
        }),
      );
      expect(result).toEqual({
        message: "Annotation queue deleted successfully",
      });
    });
  });
});
