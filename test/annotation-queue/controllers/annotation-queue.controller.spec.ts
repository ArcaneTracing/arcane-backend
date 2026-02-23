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

jest.mock("@thallesp/nestjs-better-auth", () => ({
  Session:
    () => (target: any, propertyKey: string, parameterIndex: number) => {},
  UserSession: class UserSession {},
}));

import { Test, TestingModule } from "@nestjs/testing";
import { AnnotationQueueController } from "../../../src/annotation-queue/controllers/annotation-queue.controller";
import { AnnotationQueueService } from "../../../src/annotation-queue/services/annotation-queue.service";
import { QueueTemplateService } from "../../../src/annotation-queue/services/queue-template.service";
import {
  CreateAnnotationQueueRequestDto,
  UpdateAnnotationQueueRequestDto,
} from "../../../src/annotation-queue/dto/request/create-annotation-queue-request.dto";
import { AnnotationQueueResponseDto } from "../../../src/annotation-queue/dto/response/annotation-queue-response.dto";
import { AnnotationQueueListItemResponseDto } from "../../../src/annotation-queue/dto/response/annotation-queue-list-item-response.dto";
import { AnnotationTemplateResponseDto } from "../../../src/annotation-queue/dto/response/annotation-template-response.dto";
import { AnnotationQueueType } from "../../../src/annotation-queue/entities/annotation-queue-type.enum";

describe("AnnotationQueueController", () => {
  let controller: AnnotationQueueController;
  let annotationQueueService: AnnotationQueueService;
  let queueTemplateService: QueueTemplateService;

  const mockAnnotationQueueService = {
    findAll: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
  };

  const mockQueueTemplateService = {
    getTemplate: jest.fn(),
  };

  const mockAnnotationQueueResponseDto: AnnotationQueueResponseDto = {
    id: "queue-1",
    name: "Test Queue",
    description: "Test Description",
    type: AnnotationQueueType.TRACES,
    templateId: "template-1",
    annotations: [],
    tracesToBeAnnotated: [],
    conversationsToBeAnnotated: [],
  };

  const mockAnnotationQueueListItemResponseDto: AnnotationQueueListItemResponseDto =
    {
      id: "queue-1",
      name: "Test Queue",
      description: "Test Description",
      type: AnnotationQueueType.TRACES,
    };

  const mockUserSession = {
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
      controllers: [AnnotationQueueController],
      providers: [
        {
          provide: AnnotationQueueService,
          useValue: mockAnnotationQueueService,
        },
        {
          provide: QueueTemplateService,
          useValue: mockQueueTemplateService,
        },
      ],
    }).compile();

    controller = module.get<AnnotationQueueController>(
      AnnotationQueueController,
    );
    annotationQueueService = module.get<AnnotationQueueService>(
      AnnotationQueueService,
    );
    queueTemplateService =
      module.get<QueueTemplateService>(QueueTemplateService);
  });

  afterAll(async () => {
    await module.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("findAll", () => {
    it("should return all annotation queues for a project", async () => {
      mockAnnotationQueueService.findAll.mockResolvedValue([
        mockAnnotationQueueListItemResponseDto,
      ]);

      const result = await controller.findAll("project-1");

      expect(result).toEqual([mockAnnotationQueueListItemResponseDto]);
      expect(annotationQueueService.findAll).toHaveBeenCalledWith(
        "project-1",
        undefined,
      );
    });

    it("should filter by type when provided", async () => {
      mockAnnotationQueueService.findAll.mockResolvedValue([
        mockAnnotationQueueListItemResponseDto,
      ]);

      const result = await controller.findAll(
        "project-1",
        AnnotationQueueType.TRACES,
      );

      expect(result).toEqual([mockAnnotationQueueListItemResponseDto]);
      expect(annotationQueueService.findAll).toHaveBeenCalledWith(
        "project-1",
        AnnotationQueueType.TRACES,
      );
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
      mockAnnotationQueueService.create.mockResolvedValue(
        mockAnnotationQueueResponseDto,
      );

      const result = await controller.create(
        "project-1",
        createDto,
        mockUserSession as any,
      );

      expect(result).toEqual(mockAnnotationQueueResponseDto);
      expect(annotationQueueService.create).toHaveBeenCalledWith(
        "project-1",
        createDto,
        "user-1",
      );
    });
  });

  describe("findOne", () => {
    it("should return a single annotation queue", async () => {
      mockAnnotationQueueService.findOne.mockResolvedValue(
        mockAnnotationQueueResponseDto,
      );

      const result = await controller.findOne("project-1", "queue-1");

      expect(result).toEqual(mockAnnotationQueueResponseDto);
      expect(annotationQueueService.findOne).toHaveBeenCalledWith(
        "project-1",
        "queue-1",
      );
    });
  });

  describe("update", () => {
    it("should update an annotation queue", async () => {
      const updateDto: UpdateAnnotationQueueRequestDto = {
        name: "Updated Queue",
      };
      const updatedQueue = {
        ...mockAnnotationQueueResponseDto,
        name: "Updated Queue",
      };
      mockAnnotationQueueService.update.mockResolvedValue(updatedQueue);

      const result = await controller.update("project-1", "queue-1", updateDto);

      expect(result).toEqual(updatedQueue);
      expect(annotationQueueService.update).toHaveBeenCalledWith(
        "project-1",
        "queue-1",
        updateDto,
      );
    });
  });

  describe("remove", () => {
    it("should remove an annotation queue", async () => {
      mockAnnotationQueueService.remove.mockResolvedValue({
        message: "Annotation queue deleted successfully",
      });

      const result = await controller.remove("project-1", "queue-1");

      expect(result).toEqual({
        message: "Annotation queue deleted successfully",
      });
      expect(annotationQueueService.remove).toHaveBeenCalledWith(
        "project-1",
        "queue-1",
      );
    });
  });

  describe("getTemplate", () => {
    it("should return the template for an annotation queue", async () => {
      const mockTemplate: AnnotationTemplateResponseDto = {
        id: "template-1",
        questions: [],
      };
      mockQueueTemplateService.getTemplate.mockResolvedValue(mockTemplate);

      const result = await controller.getTemplate("project-1", "queue-1");

      expect(result).toEqual(mockTemplate);
      expect(queueTemplateService.getTemplate).toHaveBeenCalledWith(
        "project-1",
        "queue-1",
      );
    });
  });
});
