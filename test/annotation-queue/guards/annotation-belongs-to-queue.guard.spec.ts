import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import {
  ExecutionContext,
  ForbiddenException,
  NotFoundException,
} from "@nestjs/common";
import { Repository } from "typeorm";
import { AnnotationBelongsToQueueGuard } from "../../../src/annotation-queue/guards/annotation-belongs-to-queue.guard";
import { Annotation } from "../../../src/annotation-queue/entities/annotation.entity";

describe("AnnotationBelongsToQueueGuard", () => {
  let guard: AnnotationBelongsToQueueGuard;
  let repository: Repository<Annotation>;

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
        AnnotationBelongsToQueueGuard,
        {
          provide: getRepositoryToken(Annotation),
          useValue: mockRepository,
        },
      ],
    }).compile();

    guard = module.get<AnnotationBelongsToQueueGuard>(
      AnnotationBelongsToQueueGuard,
    );
    repository = module.get<Repository<Annotation>>(
      getRepositoryToken(Annotation),
    );
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);
  });

  describe("canActivate", () => {
    it("should return true when annotation belongs to queue via queueTrace", async () => {
      const params = { queueId: "queue-1", annotationId: "annotation-1" };
      const context = createMockContext(params);
      mockQueryBuilder.getExists.mockResolvedValue(true);

      const result = await guard.canActivate(context);

      expect(mockRepository.createQueryBuilder).toHaveBeenCalledWith("a");
      expect(mockQueryBuilder.where).toHaveBeenCalledWith(
        "a.id = :annotationId",
        {
          annotationId: "annotation-1",
        },
      );
      expect(mockQueryBuilder.andWhere).toHaveBeenCalled();
      expect(mockQueryBuilder.getExists).toHaveBeenCalled();
      expect(result).toBe(true);
    });

    it("should return true when annotation belongs to queue via conversation", async () => {
      const params = { queueId: "queue-1", annotationId: "annotation-1" };
      const context = createMockContext(params);
      mockQueryBuilder.getExists.mockResolvedValue(true);

      const result = await guard.canActivate(context);

      expect(mockRepository.createQueryBuilder).toHaveBeenCalledWith("a");
      expect(mockQueryBuilder.where).toHaveBeenCalledWith(
        "a.id = :annotationId",
        {
          annotationId: "annotation-1",
        },
      );
      expect(mockQueryBuilder.andWhere).toHaveBeenCalled();
      expect(mockQueryBuilder.getExists).toHaveBeenCalled();
      expect(result).toBe(true);
    });

    it("should throw ForbiddenException when queueId is missing", async () => {
      const params = { annotationId: "annotation-1" };
      const context = createMockContext(params);

      const promise = guard.canActivate(context);
      await expect(promise).rejects.toThrow(ForbiddenException);
      await expect(promise).rejects.toThrow(
        "Queue ID and Annotation ID are required",
      );
      expect(mockRepository.createQueryBuilder).not.toHaveBeenCalled();
    });

    it("should throw ForbiddenException when annotationId is missing", async () => {
      const params = { queueId: "queue-1" };
      const context = createMockContext(params);

      await expect(guard.canActivate(context)).rejects.toThrow(
        ForbiddenException,
      );
      await expect(guard.canActivate(context)).rejects.toThrow(
        "Queue ID and Annotation ID are required",
      );
      expect(mockRepository.createQueryBuilder).not.toHaveBeenCalled();
    });

    it("should throw NotFoundException when annotation does not belong to queue", async () => {
      const params = { queueId: "queue-1", annotationId: "annotation-1" };
      const context = createMockContext(params);
      mockQueryBuilder.getExists.mockResolvedValue(false);

      const promise = guard.canActivate(context);
      await expect(promise).rejects.toThrow(NotFoundException);
      await expect(promise).rejects.toThrow("Annotation not found");
      expect(mockRepository.createQueryBuilder).toHaveBeenCalled();
      expect(mockQueryBuilder.getExists).toHaveBeenCalled();
    });
  });
});
