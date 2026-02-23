import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { ExecutionContext, BadRequestException } from "@nestjs/common";
import { Repository } from "typeorm";
import { ConversationsQueueGuard } from "../../../src/annotation-queue/guards/conversations-queue.guard";
import { AnnotationQueue } from "../../../src/annotation-queue/entities/annotation-queue.entity";
import { AnnotationQueueType } from "../../../src/annotation-queue/entities/annotation-queue-type.enum";

describe("ConversationsQueueGuard", () => {
  let guard: ConversationsQueueGuard;
  let repository: Repository<AnnotationQueue>;

  const mockRepository = {
    createQueryBuilder: jest.fn(),
  };

  const mockQueryBuilder = {
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    getExists: jest.fn(),
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
        ConversationsQueueGuard,
        {
          provide: getRepositoryToken(AnnotationQueue),
          useValue: mockRepository,
        },
      ],
    }).compile();

    guard = module.get<ConversationsQueueGuard>(ConversationsQueueGuard);
    repository = module.get<Repository<AnnotationQueue>>(
      getRepositoryToken(AnnotationQueue),
    );
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);
  });

  describe("canActivate", () => {
    it("should return true when queue is a conversations queue", async () => {
      const params = { queueId: "queue-1" };
      const context = createMockContext(params);
      mockQueryBuilder.getExists.mockResolvedValue(true);

      const result = await guard.canActivate(context);

      expect(mockRepository.createQueryBuilder).toHaveBeenCalledWith("q");
      expect(mockQueryBuilder.where).toHaveBeenCalledWith("q.id = :queueId", {
        queueId: "queue-1",
      });
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        "q.type = :expectedType",
        {
          expectedType: AnnotationQueueType.CONVERSATIONS,
        },
      );
      expect(mockQueryBuilder.getExists).toHaveBeenCalled();
      expect(result).toBe(true);
    });

    it("should throw BadRequestException when queueId is missing", async () => {
      const params = {};
      const context = createMockContext(params);

      const promise = guard.canActivate(context);
      await expect(promise).rejects.toThrow(BadRequestException);
      await expect(promise).rejects.toThrow("Queue ID is required");
      expect(mockRepository.createQueryBuilder).not.toHaveBeenCalled();
    });

    it("should throw BadRequestException when queue is not a conversations queue", async () => {
      const params = { queueId: "queue-1" };
      const context = createMockContext(params);
      mockQueryBuilder.getExists.mockResolvedValue(false);

      const promise = guard.canActivate(context);
      await expect(promise).rejects.toThrow(BadRequestException);
      await expect(promise).rejects.toThrow(
        "This queue is not a conversations queue",
      );
      expect(mockRepository.createQueryBuilder).toHaveBeenCalled();
    });
  });
});
