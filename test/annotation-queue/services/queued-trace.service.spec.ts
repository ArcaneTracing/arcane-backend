import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { NotFoundException, BadRequestException } from "@nestjs/common";
import { Repository } from "typeorm";
import { QueuedTraceService } from "../../../src/annotation-queue/services/queued-trace.service";
import { QueuedTrace } from "../../../src/annotation-queue/entities/queued-trace.entity";
import { QueuedTraceMapper } from "../../../src/annotation-queue/mappers/queued-trace.mapper";
import { EnqueueTraceRequestDto } from "../../../src/annotation-queue/dto/request/enqueue-trace-request.dto";
import { EnqueueTraceBulkRequestDto } from "../../../src/annotation-queue/dto/request/enqueue-trace-bulk-request.dto";

jest.mock("../../../src/annotation-queue/mappers/queued-trace.mapper");

describe("QueuedTraceService", () => {
  let service: QueuedTraceService;
  let repository: Repository<QueuedTrace>;

  const mockRepository = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    find: jest.fn(),
    remove: jest.fn(),
    existsBy: jest.fn(),
  };

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        QueuedTraceService,
        {
          provide: getRepositoryToken(QueuedTrace),
          useValue: mockRepository,
        },
      ],
    }).compile();

    service = module.get<QueuedTraceService>(QueuedTraceService);
    repository = module.get<Repository<QueuedTrace>>(
      getRepositoryToken(QueuedTrace),
    );
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("addTraceToQueue", () => {
    it("should add a trace to the queue", async () => {
      const queueId = "queue-1";
      const userId = "user-1";
      const createDto: EnqueueTraceRequestDto = {
        otelTraceId: "trace-1",
        datasourceId: "datasource-1",
        startDate: "2024-01-01T00:00:00Z",
        endDate: "2024-01-02T00:00:00Z",
      };

      const mockEntity = {
        id: "trace-1",
        ...createDto,
      } as Partial<QueuedTrace>;
      const mockSavedEntity = { id: "trace-1", ...createDto } as QueuedTrace;
      const mockResponseDto = {
        id: "trace-1",
        otelTraceId: "trace-1",
        datasourceId: "datasource-1",
        startDate: "2024-01-01T00:00:00Z",
        endDate: "2024-01-02T00:00:00Z",
      };

      mockRepository.existsBy.mockResolvedValue(false);
      (QueuedTraceMapper.toEntity as jest.Mock).mockReturnValue(mockEntity);
      mockRepository.create.mockReturnValue(mockEntity);
      mockRepository.save.mockResolvedValue(mockSavedEntity);
      (QueuedTraceMapper.toDto as jest.Mock).mockReturnValue(mockResponseDto);

      const result = await service.addTraceToQueue(queueId, userId, createDto);

      expect(mockRepository.existsBy).toHaveBeenCalledWith({
        otelTraceId: "trace-1",
        datasourceId: "datasource-1",
        queueId: "queue-1",
      });
      expect(QueuedTraceMapper.toEntity).toHaveBeenCalledWith(
        createDto,
        queueId,
        userId,
      );
      expect(mockRepository.create).toHaveBeenCalledWith(mockEntity);
      expect(mockRepository.save).toHaveBeenCalledWith(mockEntity);
      expect(QueuedTraceMapper.toDto).toHaveBeenCalledWith(mockSavedEntity);
      expect(result).toEqual(mockResponseDto);
    });

    it("should throw BadRequestException when trace already exists", async () => {
      const queueId = "queue-1";
      const userId = "user-1";
      const createDto: EnqueueTraceRequestDto = {
        otelTraceId: "trace-1",
        datasourceId: "datasource-1",
      };

      mockRepository.existsBy.mockResolvedValue(true);

      const promise = service.addTraceToQueue(queueId, userId, createDto);
      await expect(promise).rejects.toThrow(BadRequestException);
      await expect(promise).rejects.toThrow(
        "Trace already exists in this queue",
      );
      expect(mockRepository.save).not.toHaveBeenCalled();
    });
  });

  describe("removeTraceFromQueueByOtelTraceId", () => {
    it("should remove a trace from the queue by otelTraceId", async () => {
      const queueId = "queue-1";
      const otelTraceId = "trace-1";
      const mockTrace = {
        id: "trace-1",
        otelTraceId,
        queueId,
      } as QueuedTrace;

      mockRepository.findOne.mockResolvedValue(mockTrace);
      mockRepository.remove.mockResolvedValue(mockTrace);
      (QueuedTraceMapper.toMessageResponse as jest.Mock).mockReturnValue({
        message: "Trace removed from queue successfully",
      });

      const result = await service.removeTraceFromQueueByOtelTraceId(
        queueId,
        otelTraceId,
      );

      expect(mockRepository.findOne).toHaveBeenCalledWith({
        where: { otelTraceId, queueId },
      });
      expect(mockRepository.remove).toHaveBeenCalledWith(mockTrace);
      expect(QueuedTraceMapper.toMessageResponse).toHaveBeenCalledWith(
        "Trace removed from queue successfully",
      );
      expect(result).toEqual({
        message: "Trace removed from queue successfully",
      });
    });

    it("should throw NotFoundException when trace does not exist", async () => {
      const queueId = "queue-1";
      const otelTraceId = "trace-1";

      mockRepository.findOne.mockResolvedValue(null);

      await expect(
        service.removeTraceFromQueueByOtelTraceId(queueId, otelTraceId),
      ).rejects.toThrow(NotFoundException);
      await expect(
        service.removeTraceFromQueueByOtelTraceId(queueId, otelTraceId),
      ).rejects.toThrow(
        `Trace from otel with id ${otelTraceId} not found in queue ${queueId}`,
      );
      expect(mockRepository.remove).not.toHaveBeenCalled();
    });
  });

  describe("removeTraceFromQueue", () => {
    it("should remove a trace from the queue by id", async () => {
      const queueId = "queue-1";
      const id = "trace-1";
      const mockTrace = {
        id,
        queueId,
      } as QueuedTrace;

      mockRepository.findOne.mockResolvedValue(mockTrace);
      mockRepository.remove.mockResolvedValue(mockTrace);
      (QueuedTraceMapper.toMessageResponse as jest.Mock).mockReturnValue({
        message: "Trace removed from queue successfully",
      });

      const result = await service.removeTraceFromQueue(queueId, id);

      expect(mockRepository.findOne).toHaveBeenCalledWith({
        where: { id, queueId },
      });
      expect(mockRepository.remove).toHaveBeenCalledWith(mockTrace);
      expect(result).toEqual({
        message: "Trace removed from queue successfully",
      });
    });

    it("should throw NotFoundException when trace does not exist", async () => {
      const queueId = "queue-1";
      const id = "trace-1";

      mockRepository.findOne.mockResolvedValue(null);

      const promise = service.removeTraceFromQueue(queueId, id);
      await expect(promise).rejects.toThrow(NotFoundException);
      await expect(promise).rejects.toThrow(
        `Queue trace with ID ${id} not found in queue ${queueId}`,
      );
      expect(mockRepository.remove).not.toHaveBeenCalled();
    });
  });

  describe("addTracesToQueueBulk", () => {
    it("should add multiple traces to the queue", async () => {
      const queueId = "queue-1";
      const userId = "user-1";
      const createDto: EnqueueTraceBulkRequestDto = {
        otelTraceIds: ["trace-1", "trace-2", "trace-3"],
        datasourceId: "datasource-1",
        startDate: "2024-01-01T00:00:00Z",
        endDate: "2024-01-02T00:00:00Z",
      };

      const existingTraces: QueuedTrace[] = [];
      const mockSavedTraces = [
        { id: "qt-1", otelTraceId: "trace-1" } as QueuedTrace,
        { id: "qt-2", otelTraceId: "trace-2" } as QueuedTrace,
        { id: "qt-3", otelTraceId: "trace-3" } as QueuedTrace,
      ];

      mockRepository.find.mockResolvedValue(existingTraces);
      (QueuedTraceMapper.toEntityFromBulk as jest.Mock)
        .mockReturnValueOnce({ id: "qt-1" } as Partial<QueuedTrace>)
        .mockReturnValueOnce({ id: "qt-2" } as Partial<QueuedTrace>)
        .mockReturnValueOnce({ id: "qt-3" } as Partial<QueuedTrace>);
      mockRepository.create.mockImplementation((entity) => entity);
      mockRepository.save.mockResolvedValue(mockSavedTraces);
      (QueuedTraceMapper.toBulkResponseDto as jest.Mock).mockReturnValue({
        added: mockSavedTraces.map((qt) => ({
          id: qt.id,
          otelTraceId: qt.otelTraceId,
        })),
        skipped: [],
        total: 3,
        addedCount: 3,
        skippedCount: 0,
      });

      const result = await service.addTracesToQueueBulk(
        queueId,
        userId,
        createDto,
      );

      expect(mockRepository.find).toHaveBeenCalledWith({
        where: {
          queueId,
          datasourceId: "datasource-1",
        },
      });
      expect(QueuedTraceMapper.toEntityFromBulk).toHaveBeenCalledTimes(3);
      expect(mockRepository.save).toHaveBeenCalledWith(
        expect.arrayContaining([]),
      );
      expect(result.addedCount).toBe(3);
      expect(result.skippedCount).toBe(0);
    });

    it("should skip duplicate traces", async () => {
      const queueId = "queue-1";
      const userId = "user-1";
      const createDto: EnqueueTraceBulkRequestDto = {
        otelTraceIds: ["trace-1", "trace-2", "trace-3"],
        datasourceId: "datasource-1",
      };

      const existingTraces = [
        { id: "qt-1", otelTraceId: "trace-1" } as QueuedTrace,
        { id: "qt-2", otelTraceId: "trace-2" } as QueuedTrace,
      ];

      const mockSavedTraces = [
        { id: "qt-3", otelTraceId: "trace-3" } as QueuedTrace,
      ];

      mockRepository.find.mockResolvedValue(existingTraces);
      (QueuedTraceMapper.toEntityFromBulk as jest.Mock).mockReturnValue({
        id: "qt-3",
      } as Partial<QueuedTrace>);
      mockRepository.create.mockImplementation((entity) => entity);
      mockRepository.save.mockResolvedValue(mockSavedTraces);
      (QueuedTraceMapper.toBulkResponseDto as jest.Mock).mockReturnValue({
        added: [{ id: "qt-3", otelTraceId: "trace-3" }],
        skipped: ["trace-1", "trace-2"],
        total: 3,
        addedCount: 1,
        skippedCount: 2,
      });

      const result = await service.addTracesToQueueBulk(
        queueId,
        userId,
        createDto,
      );

      expect(result.addedCount).toBe(1);
      expect(result.skippedCount).toBe(2);
      expect(result.skipped).toEqual(["trace-1", "trace-2"]);
    });

    it("should handle empty trace IDs array", async () => {
      const queueId = "queue-1";
      const userId = "user-1";
      const createDto: EnqueueTraceBulkRequestDto = {
        otelTraceIds: [],
        datasourceId: "datasource-1",
      };

      mockRepository.find.mockResolvedValue([]);
      mockRepository.save.mockResolvedValue([]);
      (QueuedTraceMapper.toBulkResponseDto as jest.Mock).mockReturnValue({
        added: [],
        skipped: [],
        total: 0,
        addedCount: 0,
        skippedCount: 0,
      });

      const result = await service.addTracesToQueueBulk(
        queueId,
        userId,
        createDto,
      );

      expect(result.addedCount).toBe(0);
      expect(result.skippedCount).toBe(0);
      expect(mockRepository.save).toHaveBeenCalledWith([]);
    });
  });
});
