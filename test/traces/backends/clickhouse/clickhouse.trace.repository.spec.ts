import { Test, TestingModule } from "@nestjs/testing";
import {
  InternalServerErrorException,
  NotFoundException,
} from "@nestjs/common";
import { ClickHouseTraceRepository } from "../../../../src/traces/backends/clickhouse/clickhouse.trace.repository";
import { TraceFilterUtil } from "../../../../src/traces/backends/common/trace-filter.util";
import { DatasourceConfigEncryptionService } from "../../../../src/datasources/services/datasource-config-encryption.service";
import {
  Datasource,
  DatasourceSource,
} from "../../../../src/datasources/entities/datasource.entity";
import { SearchTracesRequestDto } from "../../../../src/traces/dto/request/search-traces-request.dto";
import { createClient, ClickHouseClient } from "@clickhouse/client";
import {
  ERROR_MESSAGES,
  formatError,
} from "../../../../src/common/constants/error-messages.constants";

const clickhouseTraceJson = require("../../resources/clickhouse/trace.json");
const clickhouseTraceListJson = require("../../resources/clickhouse/trace-list.json");
const tempoTraceJson = require("../../resources/tempo/trace.json");
const tempoTraceListJson = require("../../resources/tempo/trace-list.json");

jest.mock("@clickhouse/client", () => ({
  createClient: jest.fn(),
}));

describe("ClickHouseTraceRepository", () => {
  let repository: ClickHouseTraceRepository;
  let mockClickHouseClient: jest.Mocked<ClickHouseClient>;

  const mockQuery = jest.fn();
  const mockClient = {
    query: mockQuery,
  };

  const mockTraceFilterUtil = {
    filterFullTrace: jest.fn(),
  };

  const mockDatasourceConfigEncryptionService = {
    decryptConfig: jest.fn((_source: unknown, config: unknown) => config ?? {}),
  };

  const mockDatasource: Datasource = {
    id: "datasource-1",
    name: "ClickHouse Datasource",
    url: "http://localhost:8123/default?table=traces",
    type: "traces" as any,
    source: DatasourceSource.CLICKHOUSE,
    organisationId: "org-1",
    createdAt: new Date(),
    updatedAt: new Date(),
    createdById: "user-1",
    projectId: "project-1",
  } as unknown as Datasource;

  let module: TestingModule;

  beforeAll(async () => {
    (createClient as jest.Mock).mockReturnValue(mockClient);
    mockClickHouseClient =
      mockClient as unknown as jest.Mocked<ClickHouseClient>;

    module = await Test.createTestingModule({
      providers: [
        ClickHouseTraceRepository,
        {
          provide: TraceFilterUtil,
          useValue: mockTraceFilterUtil,
        },
        {
          provide: DatasourceConfigEncryptionService,
          useValue: mockDatasourceConfigEncryptionService,
        },
      ],
    }).compile();

    repository = module.get<ClickHouseTraceRepository>(
      ClickHouseTraceRepository,
    );
  });

  afterAll(async () => {
    try {
      await module.close();
    } catch {
      // Ignore teardown errors (e.g. ClickHouse client handles)
    }
  });

  beforeEach(() => {
    jest.clearAllMocks();

    mockTraceFilterUtil.filterFullTrace.mockReturnValue(true);
  });

  describe("search", () => {
    const searchParams: SearchTracesRequestDto = {
      limit: 10,
      q: 'service.name="test"',
    };

    it("should transform ClickHouse response to Tempo format and preserve data", async () => {
      const mockRows = clickhouseTraceListJson.data || [];
      const mockResult = {
        json: jest.fn().mockResolvedValue(mockRows),
      };
      mockQuery.mockResolvedValue(mockResult);

      const result = await repository.search(mockDatasource, searchParams);

      expect(result).toHaveProperty("traces");
      expect(Array.isArray(result.traces)).toBe(true);

      expect(clickhouseTraceListJson).toHaveProperty("data");
      expect(Array.isArray(clickhouseTraceListJson.data)).toBe(true);

      if (clickhouseTraceListJson.data.length > 0) {
        const firstRow = clickhouseTraceListJson.data[0];
        expect(firstRow).toHaveProperty("TraceId");
        expect(firstRow).toHaveProperty("ServiceName");
        expect(firstRow).toHaveProperty("SpanName");
        expect(firstRow).toHaveProperty("Timestamp");
        expect(firstRow).toHaveProperty("Duration");
      }

      if (result.traces.length > 0) {
        const firstTrace = result.traces[0];
        expect(firstTrace).toHaveProperty("traceID");
        expect(firstTrace).toHaveProperty("rootServiceName");
        expect(firstTrace).toHaveProperty("rootTraceName");
        expect(firstTrace).toHaveProperty("startTimeUnixNano");
        expect(firstTrace).toHaveProperty("durationMs");

        if (clickhouseTraceListJson.data.length > 0) {
          const originalTraceId = clickhouseTraceListJson.data[0].TraceId;
          expect(firstTrace.traceID).toBe(String(originalTraceId));
        }
      }

      expect(mockQuery).toHaveBeenCalled();
    });

    it("should handle empty ClickHouse response", async () => {
      const mockResult = {
        json: jest.fn().mockResolvedValue([]),
      };
      mockQuery.mockResolvedValue(mockResult);

      const result = await repository.search(mockDatasource, searchParams);

      expect(result).toHaveProperty("traces");
      expect(result.traces).toEqual([]);
    });

    it("should handle timestamp as string", async () => {
      const mockRows = [
        {
          TraceId: "test-trace-id",
          ServiceName: "test-service",
          SpanName: "test-span",
          Timestamp: "2026-01-21 07:41:12.381",
          Duration: 1000000,
        },
      ];

      const mockResult = {
        json: jest.fn().mockResolvedValue(mockRows),
      };
      mockQuery.mockResolvedValue(mockResult);

      const result = await repository.search(mockDatasource, searchParams);

      expect(result.traces.length).toBe(1);
      expect(result.traces[0].traceID).toBe("test-trace-id");
      expect(result.traces[0].rootServiceName).toBe("test-service");
      expect(result.traces[0].rootTraceName).toBe("test-span");
      expect(result.traces[0].durationMs).toBe(1);
    });

    it("should handle timestamp as number", async () => {
      const timestampSeconds = Math.floor(
        new Date("2026-01-21T07:41:12.381Z").getTime() / 1000,
      );
      const mockRows = [
        {
          TraceId: "test-trace-id",
          ServiceName: "test-service",
          SpanName: "test-span",
          Timestamp: timestampSeconds,
          Duration: 2000000,
        },
      ];

      const mockResult = {
        json: jest.fn().mockResolvedValue(mockRows),
      };
      mockQuery.mockResolvedValue(mockResult);

      const result = await repository.search(mockDatasource, searchParams);

      expect(result.traces.length).toBe(1);
      expect(result.traces[0].traceID).toBe("test-trace-id");
      expect(result.traces[0].durationMs).toBe(2);
    });

    it("should throw error if timestamp is missing", async () => {
      const mockRows = [
        {
          TraceId: "test-trace-id",
          ServiceName: "test-service",
          SpanName: "test-span",
          Duration: 1000000,
        },
      ];

      const mockResult = {
        json: jest.fn().mockResolvedValue(mockRows),
      };
      mockQuery.mockResolvedValue(mockResult);

      const promise = repository.search(mockDatasource, searchParams);
      await expect(promise).rejects.toThrow(InternalServerErrorException);
      await expect(promise).rejects.toThrow(
        formatError(ERROR_MESSAGES.TRACE_SEARCH_FAILED),
      );
    });

    it("should throw error if datasource config is missing", async () => {
      const datasourceWithoutConfig = {
        ...mockDatasource,
        url: null,
        config: null,
      } as unknown as Datasource;

      const promise = repository.search(datasourceWithoutConfig, searchParams);
      await expect(promise).rejects.toThrow(
        "ClickHouse config or URL is required",
      );
    });
  });

  describe("searchByTraceId", () => {
    const traceId = "fa6471d32539061bd70f55719bf53bc";

    it("should transform ClickHouse trace response to Tempo format and preserve all attributes", async () => {
      const mockRows = Array.isArray(clickhouseTraceJson)
        ? clickhouseTraceJson
        : [];

      const transformedRows = mockRows.map((row: any) => ({
        TraceId: row.TraceId,
        SpanId: row.SpanId,
        ParentSpanId: row.ParentSpanId || "",
        SpanName: row.SpanName,
        SpanKind: "SPAN_KIND_INTERNAL",
        Timestamp: row.Timestamp,
        Duration: row.Duration,
        StatusCode: "STATUS_CODE_OK",
        StatusMessage: "",
        SpanAttributes: row.Attributes || {},
        ResourceAttributes: row.ResourceAttributes || {},
        ScopeName: "test-scope",
        ScopeVersion: "1.0.0",
      }));

      const mockResult = {
        json: jest.fn().mockResolvedValue(transformedRows),
      };
      mockQuery.mockResolvedValue(mockResult);

      const result = await repository.searchByTraceId(mockDatasource, traceId);

      expect(result).toHaveProperty("traceID");
      expect(result).toHaveProperty("batches");
      expect(Array.isArray(result.batches)).toBe(true);

      expect(clickhouseTraceJson).toBeDefined();
      expect(Array.isArray(clickhouseTraceJson)).toBe(true);
      if (clickhouseTraceJson.length > 0) {
        const firstRow = clickhouseTraceJson[0];
        expect(firstRow).toHaveProperty("TraceId");
        expect(firstRow).toHaveProperty("Attributes");
        expect(firstRow).toHaveProperty("ResourceAttributes");

        if (firstRow.Attributes) {
          expect(firstRow.Attributes["llm.model"]).toBeDefined();
          expect(firstRow.Attributes["input.mime_type"]).toBeDefined();
        }
      }

      if (result.batches && result.batches.length > 0) {
        const firstBatch = result.batches[0];
        expect(firstBatch).toHaveProperty("resource");
        expect(firstBatch).toHaveProperty("scopeSpans");

        if (firstBatch.resource && firstBatch.resource.attributes) {
          expect(Array.isArray(firstBatch.resource.attributes)).toBe(true);
        }

        if (firstBatch.scopeSpans && firstBatch.scopeSpans.length > 0) {
          const spans = firstBatch.scopeSpans[0].spans || [];
          if (spans.length > 0) {
            const firstSpan = spans[0];
            expect(firstSpan).toHaveProperty("attributes");
            if (firstSpan.attributes) {
              expect(Array.isArray(firstSpan.attributes)).toBe(true);

              firstSpan.attributes.forEach((attr: any) => {
                expect(attr).toHaveProperty("key");
                expect(attr).toHaveProperty("value");
                expect(attr.value).toHaveProperty("stringValue");
              });
            }

            expect(firstSpan).toHaveProperty("traceId");
            expect(firstSpan).toHaveProperty("spanId");
            expect(firstSpan).toHaveProperty("name");
            expect(firstSpan).toHaveProperty("startTimeUnixNano");
            expect(firstSpan).toHaveProperty("endTimeUnixNano");
          }
        }
      }

      expect(mockQuery).toHaveBeenCalled();
    });

    it("should handle time range parameters", async () => {
      const mockRows = [
        {
          TraceId: traceId,
          SpanId: "span-1",
          ParentSpanId: "",
          SpanName: "test-span",
          SpanKind: "SPAN_KIND_INTERNAL",
          Timestamp: "2026-01-21 07:41:12.381",
          Duration: 1000000,
          StatusCode: "STATUS_CODE_OK",
          StatusMessage: "",
          SpanAttributes: { "service.name": "test-service" },
          ResourceAttributes: { "service.name": "test-service" },
          ScopeName: "test-scope",
          ScopeVersion: "1.0.0",
        },
      ];

      const mockResult = {
        json: jest.fn().mockResolvedValue(mockRows),
      };
      mockQuery.mockResolvedValue(mockResult);

      const timeRange = {
        start: "2024-01-01T00:00:00Z",
        end: "2024-01-02T00:00:00Z",
      };

      await repository.searchByTraceId(mockDatasource, traceId, timeRange);

      expect(mockQuery).toHaveBeenCalled();
      const queryCall = mockQuery.mock.calls[0][0];
      expect(queryCall.query).toContain(traceId);
    });

    it("should throw error if trace not found", async () => {
      const mockResult = {
        json: jest.fn().mockResolvedValue([]),
      };
      mockQuery.mockResolvedValue(mockResult);

      const promise = repository.searchByTraceId(mockDatasource, traceId);
      await expect(promise).rejects.toThrow(`TRACE_NOT_FOUND:${traceId}`);
    });

    it("should preserve attributes from ClickHouse Map format", async () => {
      const mockRows = [
        {
          TraceId: traceId,
          SpanId: "span-1",
          ParentSpanId: "",
          SpanName: "test-span",
          SpanKind: "SPAN_KIND_INTERNAL",
          Timestamp: "2026-01-21 07:41:12.381",
          Duration: 1000000,
          StatusCode: "STATUS_CODE_OK",
          StatusMessage: "",
          SpanAttributes: {
            "llm.model_name": "gpt-4",
            "input.mime_type": "application/json",
            "output.mime_type": "application/json",
            "service.name": "test-service",
          },
          ResourceAttributes: {
            "service.name": "test-service",
            "telemetry.sdk.language": "python",
          },
          ScopeName: "test-scope",
          ScopeVersion: "1.0.0",
        },
      ];

      const mockResult = {
        json: jest.fn().mockResolvedValue(mockRows),
      };
      mockQuery.mockResolvedValue(mockResult);

      const result = await repository.searchByTraceId(mockDatasource, traceId);

      if (result.batches && result.batches.length > 0) {
        const firstBatch = result.batches[0];
        if (firstBatch.scopeSpans && firstBatch.scopeSpans.length > 0) {
          const spans = firstBatch.scopeSpans[0].spans || [];
          if (spans.length > 0) {
            const firstSpan = spans[0];
            if (firstSpan.attributes) {
              const attributeKeys = firstSpan.attributes.map(
                (attr: any) => attr.key,
              );
              expect(attributeKeys).toContain("llm.model_name");
              expect(attributeKeys).toContain("input.mime_type");
              expect(attributeKeys).toContain("output.mime_type");
              expect(attributeKeys).toContain("service.name");
            }
          }
        }

        if (firstBatch.resource && firstBatch.resource.attributes) {
          const resourceAttrKeys = firstBatch.resource.attributes.map(
            (attr: any) => attr.key,
          );
          expect(resourceAttrKeys).toContain("service.name");
          expect(resourceAttrKeys).toContain("telemetry.sdk.language");
        }
      }
    });

    it("should throw NotFoundException when trace does not match project filter (client-side filtering)", async () => {
      const projectTraceFilter = {
        attributeName: "project.id",
        attributeValue: "project-123",
      };

      const mockRows = [
        {
          TraceId: traceId,
          SpanId: "span-1",
          ParentSpanId: "",
          SpanName: "test-span-1",
          SpanKind: "SPAN_KIND_INTERNAL",
          Timestamp: "2026-01-21 07:41:12.381",
          Duration: 1000000,
          StatusCode: "STATUS_CODE_OK",
          StatusMessage: "",
          SpanAttributes: { "project.id": "project-456" },
          ResourceAttributes: { "service.name": "test-service" },
          ScopeName: "test-scope",
          ScopeVersion: "1.0.0",
        },
        {
          TraceId: traceId,
          SpanId: "span-2",
          ParentSpanId: "",
          SpanName: "test-span-2",
          SpanKind: "SPAN_KIND_INTERNAL",
          Timestamp: "2026-01-21 07:41:13.381",
          Duration: 2000000,
          StatusCode: "STATUS_CODE_OK",
          StatusMessage: "",
          SpanAttributes: { "service.name": "api" },
          ResourceAttributes: { "service.name": "test-service" },
          ScopeName: "test-scope",
          ScopeVersion: "1.0.0",
        },
      ];

      const mockResult = {
        json: jest.fn().mockResolvedValue(mockRows),
      };
      mockQuery.mockResolvedValue(mockResult);
      mockTraceFilterUtil.filterFullTrace.mockReturnValue(false);

      const promise = repository.searchByTraceId(
        mockDatasource,
        traceId,
        undefined,
        projectTraceFilter,
      );

      await expect(promise).rejects.toThrow(NotFoundException);
      await expect(promise).rejects.toThrow(
        formatError(ERROR_MESSAGES.TRACE_NOT_FOUND, traceId),
      );

      expect(mockQuery).toHaveBeenCalled();
      const queryCall = mockQuery.mock.calls[0][0].query;
      expect(queryCall).not.toContain("mapContains(SpanAttributes");
      expect(queryCall).not.toContain("mapContains(ResourceAttributes");
      expect(queryCall).toContain(`TraceId = '${traceId}'`);

      expect(mockTraceFilterUtil.filterFullTrace).toHaveBeenCalledWith(
        expect.any(Object),
        projectTraceFilter,
      );
    });

    it("should return ALL spans when trace matches project filter (client-side filtering)", async () => {
      const projectTraceFilter = {
        attributeName: "project.id",
        attributeValue: "project-123",
      };

      const mockRows = [
        {
          TraceId: traceId,
          SpanId: "span-1",
          ParentSpanId: "",
          SpanName: "test-span-1",
          SpanKind: "SPAN_KIND_INTERNAL",
          Timestamp: "2026-01-21 07:41:12.381",
          Duration: 1000000,
          StatusCode: "STATUS_CODE_OK",
          StatusMessage: "",
          SpanAttributes: { "project.id": "project-123" },
          ResourceAttributes: { "service.name": "test-service" },
          ScopeName: "test-scope",
          ScopeVersion: "1.0.0",
        },
        {
          TraceId: traceId,
          SpanId: "span-2",
          ParentSpanId: "span-1",
          SpanName: "test-span-2",
          SpanKind: "SPAN_KIND_INTERNAL",
          Timestamp: "2026-01-21 07:41:13.381",
          Duration: 2000000,
          StatusCode: "STATUS_CODE_OK",
          StatusMessage: "",
          SpanAttributes: { "service.name": "api" },
          ResourceAttributes: { "service.name": "test-service" },
          ScopeName: "test-scope",
          ScopeVersion: "1.0.0",
        },
        {
          TraceId: traceId,
          SpanId: "span-3",
          ParentSpanId: "span-1",
          SpanName: "test-span-3",
          SpanKind: "SPAN_KIND_INTERNAL",
          Timestamp: "2026-01-21 07:41:14.381",
          Duration: 3000000,
          StatusCode: "STATUS_CODE_OK",
          StatusMessage: "",
          SpanAttributes: { "other.attr": "value" },
          ResourceAttributes: { "service.name": "test-service" },
          ScopeName: "test-scope",
          ScopeVersion: "1.0.0",
        },
      ];

      const mockResult = {
        json: jest.fn().mockResolvedValue(mockRows),
      };
      mockQuery.mockResolvedValue(mockResult);
      mockTraceFilterUtil.filterFullTrace.mockReturnValue(true);

      const result = await repository.searchByTraceId(
        mockDatasource,
        traceId,
        undefined,
        projectTraceFilter,
      );

      expect(result).toHaveProperty("traceID");
      expect(result).toHaveProperty("batches");

      expect(mockQuery).toHaveBeenCalled();
      const queryCall = mockQuery.mock.calls[0][0].query;
      expect(queryCall).not.toContain("mapContains(SpanAttributes");
      expect(queryCall).not.toContain("mapContains(ResourceAttributes");
      expect(queryCall).toContain(`TraceId = '${traceId}'`);

      expect(mockTraceFilterUtil.filterFullTrace).toHaveBeenCalledWith(
        expect.any(Object),
        projectTraceFilter,
      );
      expect(result.batches[0].scopeSpans[0].spans.length).toBe(3);
    });

    it("should not filter when project filter is not provided", async () => {
      const mockRows = [
        {
          TraceId: traceId,
          SpanId: "span-1",
          ParentSpanId: "",
          SpanName: "test-span",
          SpanKind: "SPAN_KIND_INTERNAL",
          Timestamp: "2026-01-21 07:41:12.381",
          Duration: 1000000,
          StatusCode: "STATUS_CODE_OK",
          StatusMessage: "",
          SpanAttributes: {},
          ResourceAttributes: {},
          ScopeName: "test-scope",
          ScopeVersion: "1.0.0",
        },
      ];

      const mockResult = {
        json: jest.fn().mockResolvedValue(mockRows),
      };
      mockQuery.mockResolvedValue(mockResult);

      const result = await repository.searchByTraceId(mockDatasource, traceId);

      expect(result).toHaveProperty("traceID");

      expect(mockQuery).toHaveBeenCalled();
      const queryCall = mockQuery.mock.calls[0][0].query;
      expect(queryCall).not.toContain("mapContains(SpanAttributes");
      expect(queryCall).not.toContain("mapContains(ResourceAttributes");
      expect(queryCall).toContain(`TraceId = '${traceId}'`);

      expect(mockTraceFilterUtil.filterFullTrace).not.toHaveBeenCalled();
    });
  });

  describe("getAttributeNames", () => {
    it("should return distinct tag keys from SpanAttributes and ResourceAttributes", async () => {
      const mockRows = [
        { key: "service.name" },
        { key: "llm.model_name" },
        { key: "input.mime_type" },
      ];

      const mockResult = {
        json: jest.fn().mockResolvedValue(mockRows),
      };
      mockQuery.mockResolvedValue(mockResult);

      const result = await repository.getAttributeNames(mockDatasource);

      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(3);
      expect(result).toContain("service.name");
      expect(result).toContain("llm.model_name");
      expect(result).toContain("input.mime_type");
      expect(mockQuery).toHaveBeenCalled();
    });
  });

  describe("getAttributeValues", () => {
    const tagName = "service.name";

    it("should return distinct values for a specific tag", async () => {
      const mockRows = [
        { value: "service-1" },
        { value: "service-2" },
        { value: "service-1" },
      ];

      const mockResult = {
        json: jest.fn().mockResolvedValue(mockRows),
      };
      mockQuery.mockResolvedValue(mockResult);

      const result = await repository.getAttributeValues(
        mockDatasource,
        tagName,
      );

      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);
      expect(mockQuery).toHaveBeenCalled();
    });
  });

  describe("getClickHouseConfig", () => {
    it("should use config field when available", () => {
      const datasourceWithConfig: Datasource = {
        ...mockDatasource,
        url: null,
        config: {
          clickhouse: {
            host: "localhost",
            port: 8123,
            database: "test_db",
            tableName: "test_table",
          },
        },
      } as unknown as Datasource;

      const mockResult = {
        json: jest.fn().mockResolvedValue([]),
      };
      mockQuery.mockResolvedValue(mockResult);

      const searchParams: SearchTracesRequestDto = {
        start: "2024-01-01T00:00:00Z",
        end: "2024-01-02T00:00:00Z",
      };

      const promise = repository.search(datasourceWithConfig, searchParams);
      expect(promise).resolves.toBeDefined();
    });

    it("should throw error if config is missing required fields", async () => {
      const datasourceWithInvalidConfig: Datasource = {
        ...mockDatasource,
        url: null,
        config: {
          clickhouse: {
            host: "localhost",
          },
        },
      } as unknown as Datasource;

      const searchParams: SearchTracesRequestDto = {
        start: "2024-01-01T00:00:00Z",
        end: "2024-01-02T00:00:00Z",
      };

      const promise = repository.search(
        datasourceWithInvalidConfig,
        searchParams,
      );
      await expect(promise).rejects.toThrow(InternalServerErrorException);
      await expect(promise).rejects.toThrow(
        formatError(
          ERROR_MESSAGES.CLICKHOUSE_CONNECTION_ERROR,
          "unknown",
          "Missing required configuration: host, database, or tableName",
        ),
      );
    });
  });

  describe("transformSpanToTempoFormat edge cases", () => {
    const traceId = "test-trace-id";

    it("should handle invalid timestamp format in searchByTraceId", async () => {
      const mockRows = [
        {
          TraceId: traceId,
          SpanId: "span-1",
          ParentSpanId: "",
          SpanName: "test-span",
          SpanKind: "SPAN_KIND_INTERNAL",
          Timestamp: "invalid-timestamp",
          Duration: 1000000,
          StatusCode: "STATUS_CODE_OK",
          StatusMessage: "",
          SpanAttributes: {},
          ResourceAttributes: {},
          ScopeName: "test-scope",
          ScopeVersion: "1.0.0",
        },
      ];

      const mockResult = {
        json: jest.fn().mockResolvedValue(mockRows),
      };
      mockQuery.mockResolvedValue(mockResult);
      const promise = repository.searchByTraceId(mockDatasource, traceId);
      await expect(promise).rejects.toThrow(InternalServerErrorException);
      await expect(promise).rejects.toThrow(
        formatError(ERROR_MESSAGES.TRACE_QUERY_FAILED),
      );
    });

    it("should handle span transformation errors gracefully", async () => {
      const mockRows = [
        {
          TraceId: traceId,
          SpanId: "span-1",
          ParentSpanId: "",
          SpanName: "test-span",
          SpanKind: "SPAN_KIND_INTERNAL",
          Timestamp: null,
          Duration: 1000000,
          StatusCode: "STATUS_CODE_OK",
          StatusMessage: "",
          SpanAttributes: {},
          ResourceAttributes: {},
          ScopeName: "test-scope",
          ScopeVersion: "1.0.0",
        },
        {
          TraceId: traceId,
          SpanId: "span-2",
          ParentSpanId: "",
          SpanName: "test-span-2",
          SpanKind: "SPAN_KIND_INTERNAL",
          Timestamp: "2026-01-21 07:41:12.381",
          Duration: 1000000,
          StatusCode: "STATUS_CODE_OK",
          StatusMessage: "",
          SpanAttributes: {},
          ResourceAttributes: {},
          ScopeName: "test-scope",
          ScopeVersion: "1.0.0",
        },
      ];

      const mockResult = {
        json: jest.fn().mockResolvedValue(mockRows),
      };
      mockQuery.mockResolvedValue(mockResult);

      const result = await repository.searchByTraceId(mockDatasource, traceId);
      expect(result.batches.length).toBeGreaterThan(0);
    });

    it("should throw error when no valid spans after transformation", async () => {
      const mockRows = [
        {
          TraceId: traceId,
          SpanId: "span-1",
          ParentSpanId: "",
          SpanName: "test-span",
          SpanKind: "SPAN_KIND_INTERNAL",
          Timestamp: null,
          Duration: 1000000,
          StatusCode: "STATUS_CODE_OK",
          StatusMessage: "",
          SpanAttributes: {},
          ResourceAttributes: {},
          ScopeName: "test-scope",
          ScopeVersion: "1.0.0",
        },
      ];

      const mockResult = {
        json: jest.fn().mockResolvedValue(mockRows),
      };
      mockQuery.mockResolvedValue(mockResult);

      const promise = repository.searchByTraceId(mockDatasource, traceId);
      await expect(promise).rejects.toThrow(InternalServerErrorException);
      await expect(promise).rejects.toThrow(
        formatError(ERROR_MESSAGES.TRACE_QUERY_FAILED),
      );
    });

    it("should handle different span kinds", async () => {
      const spanKinds = [
        "SPAN_KIND_UNSPECIFIED",
        "SPAN_KIND_INTERNAL",
        "SPAN_KIND_SERVER",
        "SPAN_KIND_CLIENT",
        "SPAN_KIND_PRODUCER",
        "SPAN_KIND_CONSUMER",
      ];

      for (const spanKind of spanKinds) {
        const mockRows = [
          {
            TraceId: traceId,
            SpanId: "span-1",
            ParentSpanId: "",
            SpanName: "test-span",
            SpanKind: spanKind,
            Timestamp: "2026-01-21 07:41:12.381",
            Duration: 1000000,
            StatusCode: "STATUS_CODE_OK",
            StatusMessage: "",
            SpanAttributes: {},
            ResourceAttributes: {},
            ScopeName: "test-scope",
            ScopeVersion: "1.0.0",
          },
        ];

        const mockResult = {
          json: jest.fn().mockResolvedValue(mockRows),
        };
        mockQuery.mockResolvedValue(mockResult);

        const result = await repository.searchByTraceId(
          mockDatasource,
          traceId,
        );
        expect(result.batches.length).toBeGreaterThan(0);
      }
    });

    it("should handle unknown span kind", async () => {
      const mockRows = [
        {
          TraceId: traceId,
          SpanId: "span-1",
          ParentSpanId: "",
          SpanName: "test-span",
          SpanKind: "UNKNOWN_KIND",
          Timestamp: "2026-01-21 07:41:12.381",
          Duration: 1000000,
          StatusCode: "STATUS_CODE_OK",
          StatusMessage: "",
          SpanAttributes: {},
          ResourceAttributes: {},
          ScopeName: "test-scope",
          ScopeVersion: "1.0.0",
        },
      ];

      const mockResult = {
        json: jest.fn().mockResolvedValue(mockRows),
      };
      mockQuery.mockResolvedValue(mockResult);

      const result = await repository.searchByTraceId(mockDatasource, traceId);
      expect(result.batches.length).toBeGreaterThan(0);

      expect(result.batches[0].scopeSpans[0].spans[0].kind).toBe(0);
    });

    it("should handle different status codes", async () => {
      const statusCodes = [
        "STATUS_CODE_UNSET",
        "STATUS_CODE_OK",
        "STATUS_CODE_ERROR",
      ];

      for (const statusCode of statusCodes) {
        const mockRows = [
          {
            TraceId: traceId,
            SpanId: "span-1",
            ParentSpanId: "",
            SpanName: "test-span",
            SpanKind: "SPAN_KIND_INTERNAL",
            Timestamp: "2026-01-21 07:41:12.381",
            Duration: 1000000,
            StatusCode: statusCode,
            StatusMessage: "",
            SpanAttributes: {},
            ResourceAttributes: {},
            ScopeName: "test-scope",
            ScopeVersion: "1.0.0",
          },
        ];

        const mockResult = {
          json: jest.fn().mockResolvedValue(mockRows),
        };
        mockQuery.mockResolvedValue(mockResult);

        const result = await repository.searchByTraceId(
          mockDatasource,
          traceId,
        );
        expect(result.batches.length).toBeGreaterThan(0);
      }
    });

    it("should handle unknown status code", async () => {
      const mockRows = [
        {
          TraceId: traceId,
          SpanId: "span-1",
          ParentSpanId: "",
          SpanName: "test-span",
          SpanKind: "SPAN_KIND_INTERNAL",
          Timestamp: "2026-01-21 07:41:12.381",
          Duration: 1000000,
          StatusCode: "UNKNOWN_STATUS",
          StatusMessage: "",
          SpanAttributes: {},
          ResourceAttributes: {},
          ScopeName: "test-scope",
          ScopeVersion: "1.0.0",
        },
      ];

      const mockResult = {
        json: jest.fn().mockResolvedValue(mockRows),
      };
      mockQuery.mockResolvedValue(mockResult);

      const result = await repository.searchByTraceId(mockDatasource, traceId);
      expect(result.batches.length).toBeGreaterThan(0);

      expect(result.batches[0].scopeSpans[0].spans[0].status.code).toBe(0);
    });

    it("should handle Map attributes format", async () => {
      const mockRows = [
        {
          TraceId: traceId,
          SpanId: "span-1",
          ParentSpanId: "",
          SpanName: "test-span",
          SpanKind: "SPAN_KIND_INTERNAL",
          Timestamp: "2026-01-21 07:41:12.381",
          Duration: 1000000,
          StatusCode: "STATUS_CODE_OK",
          StatusMessage: "",
          SpanAttributes: new Map([
            ["key1", "value1"],
            ["key2", "value2"],
          ]),
          ResourceAttributes: new Map([["resource-key", "resource-value"]]),
          ScopeName: "test-scope",
          ScopeVersion: "1.0.0",
        },
      ];

      const mockResult = {
        json: jest.fn().mockResolvedValue(mockRows),
      };
      mockQuery.mockResolvedValue(mockResult);

      const result = await repository.searchByTraceId(mockDatasource, traceId);
      expect(result.batches.length).toBeGreaterThan(0);
      if (result.batches[0].scopeSpans[0].spans[0].attributes) {
        expect(
          result.batches[0].scopeSpans[0].spans[0].attributes.length,
        ).toBeGreaterThan(0);
      }
    });

    it("should handle events in spans", async () => {
      const mockRows = [
        {
          TraceId: traceId,
          SpanId: "span-1",
          ParentSpanId: "",
          SpanName: "test-span",
          SpanKind: "SPAN_KIND_INTERNAL",
          Timestamp: "2026-01-21 07:41:12.381",
          Duration: 1000000,
          StatusCode: "STATUS_CODE_OK",
          StatusMessage: "",
          SpanAttributes: {},
          ResourceAttributes: {},
          ScopeName: "test-scope",
          ScopeVersion: "1.0.0",
          "Events.Timestamp": ["2026-01-21 07:41:12.500"],
          "Events.Name": ["event-1"],
          "Events.Attributes": [{}],
        },
      ];

      const mockResult = {
        json: jest.fn().mockResolvedValue(mockRows),
      };
      mockQuery.mockResolvedValue(mockResult);

      const result = await repository.searchByTraceId(mockDatasource, traceId);
      expect(result.batches.length).toBeGreaterThan(0);
      const span = result.batches[0].scopeSpans[0].spans[0];
      expect(span).toHaveProperty("events");
      if (span.events) {
        expect(Array.isArray(span.events)).toBe(true);
      }
    });

    it("should handle links in spans", async () => {
      const mockRows = [
        {
          TraceId: traceId,
          SpanId: "span-1",
          ParentSpanId: "",
          SpanName: "test-span",
          SpanKind: "SPAN_KIND_INTERNAL",
          Timestamp: "2026-01-21 07:41:12.381",
          Duration: 1000000,
          StatusCode: "STATUS_CODE_OK",
          StatusMessage: "",
          SpanAttributes: {},
          ResourceAttributes: {},
          ScopeName: "test-scope",
          ScopeVersion: "1.0.0",
          "Links.TraceId": ["linked-trace-id"],
          "Links.SpanId": ["linked-span-id"],
          "Links.TraceState": ["state"],
          "Links.Attributes": [{}],
        },
      ];

      const mockResult = {
        json: jest.fn().mockResolvedValue(mockRows),
      };
      mockQuery.mockResolvedValue(mockResult);

      const result = await repository.searchByTraceId(mockDatasource, traceId);
      expect(result.batches.length).toBeGreaterThan(0);
      const span = result.batches[0].scopeSpans[0].spans[0];
      expect(span).toHaveProperty("links");
      if (span.links) {
        expect(Array.isArray(span.links)).toBe(true);
      }
    });

    it("should handle error in getAllTags", async () => {
      mockQuery.mockRejectedValue(new Error("ClickHouse error"));

      const promise = repository.getAttributeNames(mockDatasource);
      await expect(promise).rejects.toThrow(InternalServerErrorException);
      await expect(promise).rejects.toThrow(
        formatError(ERROR_MESSAGES.TRACE_QUERY_FAILED),
      );
    });

    it("should handle error in getTagValues", async () => {
      mockQuery.mockRejectedValue(new Error("ClickHouse error"));

      const promise = repository.getAttributeValues(
        mockDatasource,
        "service.name",
      );
      await expect(promise).rejects.toThrow(InternalServerErrorException);
      await expect(promise).rejects.toThrow(
        formatError(ERROR_MESSAGES.TRACE_QUERY_FAILED),
      );
    });
  });
});
