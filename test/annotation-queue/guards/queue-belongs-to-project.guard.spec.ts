import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import {
  ExecutionContext,
  ForbiddenException,
  NotFoundException,
} from "@nestjs/common";
import { Repository } from "typeorm";
import { QueueBelongsToProjectGuard } from "../../../src/annotation-queue/guards/queue-belongs-to-project.guard";
import { AnnotationQueue } from "../../../src/annotation-queue/entities/annotation-queue.entity";

describe("QueueBelongsToProjectGuard", () => {
  let guard: QueueBelongsToProjectGuard;
  let repository: Repository<AnnotationQueue>;

  const mockRepository = {
    exists: jest.fn(),
  };

  const createMockContext = (params: any = {}): ExecutionContext => {
    const request = {
      params,
    };
    return {
      switchToHttp: () => ({
        getRequest: () => request,
      }),
    } as ExecutionContext;
  };

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        QueueBelongsToProjectGuard,
        {
          provide: getRepositoryToken(AnnotationQueue),
          useValue: mockRepository,
        },
      ],
    }).compile();

    guard = module.get<QueueBelongsToProjectGuard>(QueueBelongsToProjectGuard);
    repository = module.get<Repository<AnnotationQueue>>(
      getRepositoryToken(AnnotationQueue),
    );
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("canActivate", () => {
    it("should return true when queue belongs to project", async () => {
      const params = { projectId: "project-1", queueId: "queue-1" };
      const context = createMockContext(params);
      mockRepository.exists.mockResolvedValue(true);

      const result = await guard.canActivate(context);

      expect(mockRepository.exists).toHaveBeenCalledWith({
        where: { id: "queue-1", projectId: "project-1" },
      });
      expect(result).toBe(true);
    });

    it("should throw ForbiddenException when projectId is missing", async () => {
      const params = { queueId: "queue-1" };
      const context = createMockContext(params);

      const promise = guard.canActivate(context);
      await expect(promise).rejects.toThrow(ForbiddenException);
      await expect(promise).rejects.toThrow(
        "Project ID and Queue ID are required",
      );
      expect(mockRepository.exists).not.toHaveBeenCalled();
    });

    it("should throw ForbiddenException when queueId is missing", async () => {
      const params = { projectId: "project-1" };
      const context = createMockContext(params);

      const promise = guard.canActivate(context);
      await expect(promise).rejects.toThrow(ForbiddenException);
      await expect(promise).rejects.toThrow(
        "Project ID and Queue ID are required",
      );
      expect(mockRepository.exists).not.toHaveBeenCalled();
    });

    it("should throw NotFoundException when queue does not belong to project", async () => {
      const params = { projectId: "project-1", queueId: "queue-1" };
      const context = createMockContext(params);
      mockRepository.exists.mockResolvedValue(false);

      const promise = guard.canActivate(context);
      await expect(promise).rejects.toThrow(NotFoundException);
      await expect(promise).rejects.toThrow("Annotation queue not found");
      expect(mockRepository.exists).toHaveBeenCalledWith({
        where: { id: "queue-1", projectId: "project-1" },
      });
    });
  });
});
