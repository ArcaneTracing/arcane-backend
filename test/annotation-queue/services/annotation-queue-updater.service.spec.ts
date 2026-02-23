import { Test, TestingModule } from "@nestjs/testing";
import { AnnotationQueueUpdater } from "../../../src/annotation-queue/services/annotation-queue-updater.service";
import { QueueTemplateService } from "../../../src/annotation-queue/services/queue-template.service";
import { AnnotationQueue } from "../../../src/annotation-queue/entities/annotation-queue.entity";
import { UpdateAnnotationQueueRequestDto } from "../../../src/annotation-queue/dto/request/create-annotation-queue-request.dto";
import { AnnotationQuestionType } from "../../../src/annotation-queue/entities/annotation-question-type.enum";

describe("AnnotationQueueUpdater", () => {
  let service: AnnotationQueueUpdater;
  let queueTemplateService: QueueTemplateService;

  const mockQueueTemplateService = {
    updateTemplate: jest.fn(),
  };

  const createMockQueue = (): AnnotationQueue =>
    ({
      id: "queue-1",
      name: "Original Name",
      description: "Original Description",
      templateId: "template-1",
    }) as AnnotationQueue;

  let module: TestingModule;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      providers: [
        AnnotationQueueUpdater,
        {
          provide: QueueTemplateService,
          useValue: mockQueueTemplateService,
        },
      ],
    }).compile();

    service = module.get<AnnotationQueueUpdater>(AnnotationQueueUpdater);
    queueTemplateService =
      module.get<QueueTemplateService>(QueueTemplateService);
  });

  afterAll(async () => {
    await module.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("applyUpdates", () => {
    it("should update name when provided", async () => {
      const mockQueue = createMockQueue();
      const updateDto: UpdateAnnotationQueueRequestDto = {
        name: "Updated Name",
      };

      await service.applyUpdates(mockQueue, updateDto);

      expect(mockQueue.name).toBe("Updated Name");
      expect(mockQueueTemplateService.updateTemplate).not.toHaveBeenCalled();
    });

    it("should update description when provided", async () => {
      const mockQueue = createMockQueue();
      const updateDto: UpdateAnnotationQueueRequestDto = {
        description: "Updated Description",
      };

      await service.applyUpdates(mockQueue, updateDto);

      expect(mockQueue.description).toBe("Updated Description");
      expect(mockQueueTemplateService.updateTemplate).not.toHaveBeenCalled();
    });

    it("should update template when provided", async () => {
      const mockQueue = createMockQueue();
      const updateDto: UpdateAnnotationQueueRequestDto = {
        template: {
          questions: [
            {
              question: "New Question",
              type: AnnotationQuestionType.FREEFORM,
            },
          ],
        },
      };
      mockQueueTemplateService.updateTemplate.mockResolvedValue(
        "new-template-id",
      );

      await service.applyUpdates(mockQueue, updateDto);

      expect(mockQueueTemplateService.updateTemplate).toHaveBeenCalledWith(
        updateDto.template,
      );
      expect(mockQueue.templateId).toBe("new-template-id");
    });

    it("should update multiple fields at once", async () => {
      const mockQueue = createMockQueue();
      const updateDto: UpdateAnnotationQueueRequestDto = {
        name: "Updated Name",
        description: "Updated Description",
        template: {
          questions: [
            {
              question: "New Question",
              type: AnnotationQuestionType.FREEFORM,
            },
          ],
        },
      };
      mockQueueTemplateService.updateTemplate.mockResolvedValue(
        "new-template-id",
      );

      await service.applyUpdates(mockQueue, updateDto);

      expect(mockQueue.name).toBe("Updated Name");
      expect(mockQueue.description).toBe("Updated Description");
      expect(mockQueue.templateId).toBe("new-template-id");
    });

    it("should not update fields that are undefined", async () => {
      const mockQueue = createMockQueue();
      const originalName = mockQueue.name;
      const originalDescription = mockQueue.description;
      const updateDto: UpdateAnnotationQueueRequestDto = {};

      await service.applyUpdates(mockQueue, updateDto);

      expect(mockQueue.name).toBe(originalName);
      expect(mockQueue.description).toBe(originalDescription);
      expect(mockQueueTemplateService.updateTemplate).not.toHaveBeenCalled();
    });
  });
});
