import { QueuedTraceMapper } from "../../../src/annotation-queue/mappers/queued-trace.mapper";
import { QueuedTrace } from "../../../src/annotation-queue/entities/queued-trace.entity";

describe("QueuedTraceMapper", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2024-01-01T12:00:00Z"));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe("toDto", () => {
    it("should map queued trace to response dto", () => {
      const trace = new QueuedTrace();
      trace.id = "trace-1";
      trace.otelTraceId = "otel-1";
      trace.datasourceId = "datasource-1";
      trace.startDate = new Date("2024-01-01T00:00:00Z");
      trace.endDate = new Date("2024-01-02T00:00:00Z");

      const result = QueuedTraceMapper.toDto(trace);

      expect(result).toEqual({
        id: "trace-1",
        otelTraceId: "otel-1",
        datasourceId: "datasource-1",
        startDate: new Date("2024-01-01T00:00:00Z"),
        endDate: new Date("2024-01-02T00:00:00Z"),
      });
    });
  });

  describe("toEntity", () => {
    it("should map dto to queued trace entity payload", () => {
      const dto = {
        otelTraceId: "otel-1",
        datasourceId: "datasource-1",
        startDate: "2024-01-01T00:00:00Z",
        endDate: "2024-01-02T00:00:00Z",
      };

      const result = QueuedTraceMapper.toEntity(dto, "queue-1", "user-1");

      expect(result).toEqual({
        otelTraceId: "otel-1",
        datasourceId: "datasource-1",
        queueId: "queue-1",
        createdById: "user-1",
        createdAt: new Date("2024-01-01T12:00:00Z"),
        startDate: new Date("2024-01-01T00:00:00Z"),
        endDate: new Date("2024-01-02T00:00:00Z"),
      });
    });

    it("should omit dates when not provided", () => {
      const dto = {
        otelTraceId: "otel-1",
        datasourceId: "datasource-1",
      };

      const result = QueuedTraceMapper.toEntity(dto, "queue-1", "user-1");

      expect(result.startDate).toBeUndefined();
      expect(result.endDate).toBeUndefined();
    });
  });

  describe("toEntityFromBulk", () => {
    it("should map bulk params to queued trace entity payload", () => {
      const result = QueuedTraceMapper.toEntityFromBulk(
        "otel-1",
        "datasource-1",
        "queue-1",
        "user-1",
        "2024-01-01T00:00:00Z",
        "2024-01-02T00:00:00Z",
      );

      expect(result).toEqual({
        otelTraceId: "otel-1",
        datasourceId: "datasource-1",
        queueId: "queue-1",
        createdById: "user-1",
        createdAt: new Date("2024-01-01T12:00:00Z"),
        startDate: new Date("2024-01-01T00:00:00Z"),
        endDate: new Date("2024-01-02T00:00:00Z"),
      });
    });
  });

  describe("toBulkResponseDto", () => {
    it("should map bulk response metadata", () => {
      const trace = new QueuedTrace();
      trace.id = "trace-1";
      trace.otelTraceId = "otel-1";
      trace.datasourceId = "datasource-1";

      const result = QueuedTraceMapper.toBulkResponseDto(
        [trace],
        ["skip-1"],
        2,
      );

      expect(result).toEqual({
        added: [
          {
            id: "trace-1",
            otelTraceId: "otel-1",
            datasourceId: "datasource-1",
            startDate: undefined,
            endDate: undefined,
          },
        ],
        skipped: ["skip-1"],
        total: 2,
        addedCount: 1,
        skippedCount: 1,
      });
    });
  });

  describe("toMessageResponse", () => {
    it("should map message to response dto", () => {
      expect(QueuedTraceMapper.toMessageResponse("ok")).toEqual({
        message: "ok",
      });
    });
  });
});
