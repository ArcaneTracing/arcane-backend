import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { BadRequestException, NotFoundException } from "@nestjs/common";
import { QueueTemplateService } from "../../../src/annotation-queue/services/queue-template.service";
import { AnnotationTemplate } from "../../../src/annotation-queue/entities/annotation-template.entity";
import { AnnotationQueue } from "../../../src/annotation-queue/entities/annotation-queue.entity";
import { AnnotationQuestionType } from "../../../src/annotation-queue/entities/annotation-question-type.enum";

jest.mock(
  "../../../src/annotation-queue/mappers/annotation-question.mapper",
  () => ({
    AnnotationQuestionMapper: {
      toEntity: jest.fn((dto) => ({
        question: dto.question,
        type: dto.type,
      })),
    },
  }),
);

describe("QueueTemplateService", () => {
  let service: QueueTemplateService;
  let annotationTemplateRepository: Repository<AnnotationTemplate>;
  let annotationQueueRepository: Repository<AnnotationQueue>;

  const mockAnnotationTemplateRepository = {
    save: jest.fn(),
    findOne: jest.fn(),
  };

  const mockAnnotationQueueRepository = {
    findOne: jest.fn(),
  };

  const mockTemplate: AnnotationTemplate = {
    id: "template-1",
    questions: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  } as AnnotationTemplate;

  const mockQueue: AnnotationQueue = {
    id: "queue-1",
    templateId: "template-1",
    projectId: "project-1",
  } as AnnotationQueue;

  let module: TestingModule;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      providers: [
        QueueTemplateService,
        {
          provide: getRepositoryToken(AnnotationTemplate),
          useValue: mockAnnotationTemplateRepository,
        },
        {
          provide: getRepositoryToken(AnnotationQueue),
          useValue: mockAnnotationQueueRepository,
        },
      ],
    }).compile();

    service = module.get<QueueTemplateService>(QueueTemplateService);
    annotationTemplateRepository = module.get<Repository<AnnotationTemplate>>(
      getRepositoryToken(AnnotationTemplate),
    );
    annotationQueueRepository = module.get<Repository<AnnotationQueue>>(
      getRepositoryToken(AnnotationQueue),
    );
  });

  afterAll(async () => {
    await module.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("createTemplate", () => {
    it("should create a template with questions", async () => {
      const questions = [
        {
          question: "Test Question",
          type: AnnotationQuestionType.FREEFORM,
        },
      ];

      mockAnnotationTemplateRepository.save.mockResolvedValue(mockTemplate);

      const result = await service.createTemplate(questions);

      expect(mockAnnotationTemplateRepository.save).toHaveBeenCalled();
      expect(result).toEqual(mockTemplate);
    });

    it("should throw BadRequestException when questions array is empty", async () => {
      await expect(service.createTemplate([])).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.createTemplate([])).rejects.toThrow(
        "At least one question is required when creating a template",
      );
    });

    it("should throw BadRequestException when questions is null", async () => {
      await expect(service.createTemplate(null as any)).rejects.toThrow(
        BadRequestException,
      );
    });

    it("should throw BadRequestException when questions is undefined", async () => {
      await expect(service.createTemplate(undefined as any)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe("updateTemplate", () => {
    it("should update a template by creating a new one", async () => {
      const templateDto = {
        questions: [
          {
            question: "Updated Question",
            type: AnnotationQuestionType.FREEFORM,
          },
        ],
      };
      mockAnnotationTemplateRepository.save.mockResolvedValue(mockTemplate);

      const result = await service.updateTemplate(templateDto);

      expect(mockAnnotationTemplateRepository.save).toHaveBeenCalled();
      expect(result).toBe(mockTemplate.id);
    });

    it("should throw BadRequestException when questions array is empty", async () => {
      const templateDto = {
        questions: [],
      };

      await expect(service.updateTemplate(templateDto)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.updateTemplate(templateDto)).rejects.toThrow(
        "At least one question is required when updating template",
      );
    });

    it("should throw BadRequestException when questions is missing", async () => {
      const templateDto = {};

      await expect(service.updateTemplate(templateDto as any)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe("getTemplate", () => {
    it("should return template for an annotation queue", async () => {
      const templateWithQuestions = {
        ...mockTemplate,
        questions: [],
      };
      mockAnnotationQueueRepository.findOne.mockResolvedValue(mockQueue);
      mockAnnotationTemplateRepository.findOne.mockResolvedValue(
        templateWithQuestions,
      );

      const result = await service.getTemplate("project-1", "queue-1");

      expect(mockAnnotationQueueRepository.findOne).toHaveBeenCalledWith({
        where: { id: "queue-1", projectId: "project-1" },
      });
      expect(mockAnnotationTemplateRepository.findOne).toHaveBeenCalledWith({
        where: { id: "template-1" },
        relations: ["questions"],
      });
      expect(result).toBeDefined();
    });

    it("should throw NotFoundException when queue not found", async () => {
      mockAnnotationQueueRepository.findOne.mockResolvedValue(null);

      await expect(
        service.getTemplate("project-1", "non-existent"),
      ).rejects.toThrow(NotFoundException);
      await expect(
        service.getTemplate("project-1", "non-existent"),
      ).rejects.toThrow(
        "Annotation queue with ID non-existent not found in project project-1",
      );
    });

    it("should throw NotFoundException when template not found", async () => {
      mockAnnotationQueueRepository.findOne.mockResolvedValue(mockQueue);
      mockAnnotationTemplateRepository.findOne.mockResolvedValue(null);

      await expect(service.getTemplate("project-1", "queue-1")).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.getTemplate("project-1", "queue-1")).rejects.toThrow(
        "Template with ID template-1 not found",
      );
    });
  });
});
