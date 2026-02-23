import { Test, TestingModule } from "@nestjs/testing";
import { NotFoundException } from "@nestjs/common";
import { AnnotationQueueValidator } from "../../../src/annotation-queue/validators/annotation-queue.validator";
import { AnnotationQueue } from "../../../src/annotation-queue/entities/annotation-queue.entity";

describe("AnnotationQueueValidator", () => {
  let validator: AnnotationQueueValidator;
  let module: TestingModule;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      providers: [AnnotationQueueValidator],
    }).compile();

    validator = module.get<AnnotationQueueValidator>(AnnotationQueueValidator);
  });

  afterAll(async () => {
    await module.close();
  });

  describe("validateQueueExists", () => {
    it("should return queue when it exists", () => {
      const queue: AnnotationQueue = {
        id: "queue-1",
        name: "Test Queue",
        projectId: "project-1",
      } as AnnotationQueue;

      const result = validator.validateQueueExists(
        queue,
        "queue-1",
        "project-1",
      );

      expect(result).toEqual(queue);
    });

    it("should throw NotFoundException when queue is null", () => {
      expect(() => {
        validator.validateQueueExists(null, "queue-1", "project-1");
      }).toThrow(NotFoundException);
      expect(() => {
        validator.validateQueueExists(null, "queue-1", "project-1");
      }).toThrow(
        "Annotation queue with ID queue-1 not found in project project-1",
      );
    });
  });
});
