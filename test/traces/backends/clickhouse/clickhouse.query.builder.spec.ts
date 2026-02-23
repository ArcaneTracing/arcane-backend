import { ClickHouseQueryBuilder } from "../../../../src/traces/backends/clickhouse/clickhouse.query.builder";
import { SearchTracesRequestDto } from "../../../../src/traces/dto/request/search-traces-request.dto";

describe("ClickHouseQueryBuilder", () => {
  const tableName = "traces";

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("buildSearchQuery", () => {
    it("should build query with time range", () => {
      const searchParams: SearchTracesRequestDto = {
        start: "2024-01-01T00:00:00Z",
        end: "2024-01-02T00:00:00Z",
        limit: 10,
      };

      const query = ClickHouseQueryBuilder.buildSearchQuery(
        searchParams,
        tableName,
      );

      expect(query).toContain("WHERE");
      expect(query).toContain("Timestamp >=");
      expect(query).toContain("Timestamp <=");
      expect(query).toContain("LIMIT 10");
      expect(query).toContain("`traces`");
    });

    it("should use default time range when start and end are not provided", () => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date("2024-01-01T12:00:00Z"));

      const searchParams: SearchTracesRequestDto = {
        limit: 10,
      };

      const query = ClickHouseQueryBuilder.buildSearchQuery(
        searchParams,
        tableName,
      );

      expect(query).toContain("WHERE");
      expect(query).toContain("Timestamp >=");
      expect(query).toContain("Timestamp <=");

      jest.useRealTimers();
    });

    it("should include service name filter", () => {
      const searchParams: SearchTracesRequestDto = {
        start: "2024-01-01T00:00:00Z",
        end: "2024-01-02T00:00:00Z",
        serviceName: "test-service",
      };

      const query = ClickHouseQueryBuilder.buildSearchQuery(
        searchParams,
        tableName,
      );

      expect(query).toContain("ServiceName = 'test-service'");
    });

    it("should escape single quotes in service name", () => {
      const searchParams: SearchTracesRequestDto = {
        start: "2024-01-01T00:00:00Z",
        end: "2024-01-02T00:00:00Z",
        serviceName: "test'service",
      };

      const query = ClickHouseQueryBuilder.buildSearchQuery(
        searchParams,
        tableName,
      );

      expect(query).toContain("ServiceName = 'test''service'");
    });

    it("should include operation name filter", () => {
      const searchParams: SearchTracesRequestDto = {
        start: "2024-01-01T00:00:00Z",
        end: "2024-01-02T00:00:00Z",
        operationName: "test-operation",
      };

      const query = ClickHouseQueryBuilder.buildSearchQuery(
        searchParams,
        tableName,
      );

      expect(query).toContain("SpanName = 'test-operation'");
    });

    it("should include duration filters", () => {
      const searchParams: SearchTracesRequestDto = {
        start: "2024-01-01T00:00:00Z",
        end: "2024-01-02T00:00:00Z",
        minDuration: 1000000,
        maxDuration: 10000000,
      };

      const query = ClickHouseQueryBuilder.buildSearchQuery(
        searchParams,
        tableName,
      );

      expect(query).toContain("Duration >= 1000000");
      expect(query).toContain("Duration <= 10000000");
    });

    it("should include attributes filter", () => {
      const searchParams: SearchTracesRequestDto = {
        start: "2024-01-01T00:00:00Z",
        end: "2024-01-02T00:00:00Z",
        attributes: 'key=value key2="value with spaces"',
      };

      const query = ClickHouseQueryBuilder.buildSearchQuery(
        searchParams,
        tableName,
      );

      expect(query).toContain("mapContains(SpanAttributes");
      expect(query).toContain("mapContains(ResourceAttributes");
    });

    it("should wrap attribute filter OR expression in parentheses for correct operator precedence", () => {
      const searchParams: SearchTracesRequestDto = {
        start: "2024-01-01T00:00:00Z",
        end: "2024-01-02T00:00:00Z",
        attributes: "project.id=123",
      };

      const query = ClickHouseQueryBuilder.buildSearchQuery(
        searchParams,
        tableName,
      );

      const whereMatch = query.match(/WHERE\s+(.+?)\s+GROUP BY/i);
      expect(whereMatch).toBeTruthy();
      const whereClause = whereMatch![1];
      expect(whereClause).toMatch(/AND\s+\(\(/);

      const attributePattern =
        /\(\(.*mapContains\(SpanAttributes[^)]+\).*\)\s+OR\s+\(.*mapContains\(ResourceAttributes[^)]+\).*\)\)/;
      expect(whereClause).toMatch(attributePattern);
    });

    it("should properly parenthesize multiple attribute filters", () => {
      const searchParams: SearchTracesRequestDto = {
        start: "2024-01-01T00:00:00Z",
        end: "2024-01-02T00:00:00Z",
        attributes: "project.id=123 service.name=api",
      };

      const query = ClickHouseQueryBuilder.buildSearchQuery(
        searchParams,
        tableName,
      );

      const whereMatch = query.match(/WHERE\s+(.+?)\s+GROUP BY/i);
      expect(whereMatch).toBeTruthy();
      const whereClause = whereMatch![1];
      const attributePattern =
        /\(\(.*?mapContains\(SpanAttributes[^)]+\).*?\)\s+OR\s+\(.*?mapContains\(ResourceAttributes[^)]+\).*?\)\)/g;
      const attributeMatches = whereClause.match(attributePattern);
      expect(attributeMatches).toBeTruthy();
      expect(attributeMatches!.length).toBe(2);

      expect(whereClause).toContain("'project.id'");
      expect(whereClause).toContain("'123'");

      expect(whereClause).toContain("'service.name'");
      expect(whereClause).toContain("'api'");
    });

    it("should maintain correct precedence when combining attribute filter with service name", () => {
      const searchParams: SearchTracesRequestDto = {
        start: "2024-01-01T00:00:00Z",
        end: "2024-01-02T00:00:00Z",
        serviceName: "test-service",
        attributes: "project.id=123",
      };

      const query = ClickHouseQueryBuilder.buildSearchQuery(
        searchParams,
        tableName,
      );

      const whereMatch = query.match(/WHERE\s+(.+?)\s+GROUP BY/i);
      expect(whereMatch).toBeTruthy();
      const whereClause = whereMatch![1];
      expect(whereClause).toMatch(
        /AND\s+\(\(.*mapContains\(SpanAttributes[^)]+\).*\)\s+OR\s+\(.*mapContains\(ResourceAttributes[^)]+\).*\)\)/,
      );

      const serviceNameIndex = whereClause.indexOf(
        "ServiceName = 'test-service'",
      );
      const attributeIndex = whereClause.indexOf(
        "((mapContains(SpanAttributes",
      );
      expect(serviceNameIndex).toBeLessThan(attributeIndex);
    });

    it("should maintain correct precedence when combining attribute filter with operation name and duration", () => {
      const searchParams: SearchTracesRequestDto = {
        start: "2024-01-01T00:00:00Z",
        end: "2024-01-02T00:00:00Z",
        operationName: "test-operation",
        minDuration: 1000000,
        maxDuration: 10000000,
        attributes: "project.id=123",
      };

      const query = ClickHouseQueryBuilder.buildSearchQuery(
        searchParams,
        tableName,
      );

      const whereMatch = query.match(/WHERE\s+(.+?)\s+GROUP BY/i);
      expect(whereMatch).toBeTruthy();
      const whereClause = whereMatch![1];

      expect(whereClause).toContain("Timestamp >=");
      expect(whereClause).toContain("Timestamp <=");
      expect(whereClause).toContain("SpanName = 'test-operation'");
      expect(whereClause).toContain("Duration >= 1000000");
      expect(whereClause).toContain("Duration <= 10000000");

      expect(whereClause).toMatch(
        /AND\s+\(\(.*mapContains\(SpanAttributes[^)]+\).*\)\s+OR\s+\(.*mapContains\(ResourceAttributes[^)]+\).*\)\)/,
      );
    });

    it("should ensure attribute filter requires both time range AND attribute match", () => {
      const searchParams: SearchTracesRequestDto = {
        start: "2024-01-01T00:00:00Z",
        end: "2024-01-02T00:00:00Z",
        attributes: "project.id=123",
      };

      const query = ClickHouseQueryBuilder.buildSearchQuery(
        searchParams,
        tableName,
      );

      const whereMatch = query.match(/WHERE\s+(.+?)\s+GROUP BY/i);
      expect(whereMatch).toBeTruthy();
      const whereClause = whereMatch![1];

      const attributeStart = whereClause.indexOf(
        "((mapContains(SpanAttributes",
      );
      expect(attributeStart).toBeGreaterThan(-1);

      const beforeAttribute = whereClause.substring(0, attributeStart);
      expect(beforeAttribute).toMatch(/AND\s+$/);

      const attributeEnd = whereClause.indexOf("))", attributeStart);
      expect(attributeEnd).toBeGreaterThan(attributeStart);
    });

    it("should handle attribute names with dots", () => {
      const searchParams: SearchTracesRequestDto = {
        start: "2024-01-01T00:00:00Z",
        end: "2024-01-02T00:00:00Z",
        attributes: "input.mime_type=application/json",
      };

      const query = ClickHouseQueryBuilder.buildSearchQuery(
        searchParams,
        tableName,
      );

      expect(query).toContain("'input.mime_type'");
      expect(query).toContain("'application/json'");
      expect(query).toContain("mapContains(SpanAttributes");
      expect(query).toContain("mapContains(ResourceAttributes");
    });

    it("should handle unterminated quoted attribute values", () => {
      const searchParams: SearchTracesRequestDto = {
        start: "2024-01-01T00:00:00Z",
        end: "2024-01-02T00:00:00Z",
        attributes: 'key=value key2="value with spaces" key3="unterminated',
      };

      const query = ClickHouseQueryBuilder.buildSearchQuery(
        searchParams,
        tableName,
      );

      expect(query).toContain("'key'");
      expect(query).toContain("'key2'");
      expect(query).toContain("'key3'");
    });

    it("should include TraceQL query filter", () => {
      const searchParams: SearchTracesRequestDto = {
        start: "2024-01-01T00:00:00Z",
        end: "2024-01-02T00:00:00Z",
        q: '{service="test"}',
      };

      const query = ClickHouseQueryBuilder.buildSearchQuery(
        searchParams,
        tableName,
      );

      expect(query).toBeDefined();
    });

    it("should handle TraceQL query with dot notation", () => {
      const searchParams: SearchTracesRequestDto = {
        start: "2024-01-01T00:00:00Z",
        end: "2024-01-02T00:00:00Z",
        q: '{.service="test"}',
      };

      const query = ClickHouseQueryBuilder.buildSearchQuery(
        searchParams,
        tableName,
      );

      expect(query).toBeDefined();
    });

    it("should use default limit of 20 when not provided", () => {
      const searchParams: SearchTracesRequestDto = {
        start: "2024-01-01T00:00:00Z",
        end: "2024-01-02T00:00:00Z",
      };

      const query = ClickHouseQueryBuilder.buildSearchQuery(
        searchParams,
        tableName,
      );

      expect(query).toContain("LIMIT 20");
    });

    it("should escape table name with backticks", () => {
      const searchParams: SearchTracesRequestDto = {
        start: "2024-01-01T00:00:00Z",
        end: "2024-01-02T00:00:00Z",
      };

      const query = ClickHouseQueryBuilder.buildSearchQuery(
        searchParams,
        tableName,
      );

      expect(query).toContain("`traces`");
    });

    it("should escape backticks in table name", () => {
      const searchParams: SearchTracesRequestDto = {
        start: "2024-01-01T00:00:00Z",
        end: "2024-01-02T00:00:00Z",
      };

      const query = ClickHouseQueryBuilder.buildSearchQuery(
        searchParams,
        "table`name",
      );

      expect(query).toContain("`table``name`");
    });

    it("should throw for invalid date format in start or end", () => {
      const searchParams: SearchTracesRequestDto = {
        start: "invalid-date",
        end: "2024-01-02T00:00:00Z",
        limit: 10,
      };

      expect(() =>
        ClickHouseQueryBuilder.buildSearchQuery(searchParams, tableName),
      ).toThrow("Invalid date format in start or end parameters");
    });

    it("should throw when start date is after end date", () => {
      const searchParams: SearchTracesRequestDto = {
        start: "2024-01-02T00:00:00Z",
        end: "2024-01-01T00:00:00Z",
        limit: 10,
      };

      expect(() =>
        ClickHouseQueryBuilder.buildSearchQuery(searchParams, tableName),
      ).toThrow("Start date must be before end date");
    });

    it("should build query with all parameters", () => {
      const searchParams: SearchTracesRequestDto = {
        start: "2024-01-01T00:00:00Z",
        end: "2024-01-02T00:00:00Z",
        limit: 50,
        serviceName: "test-service",
        operationName: "test-operation",
        minDuration: 1000000,
        maxDuration: 10000000,
        attributes: "key=value",
        q: '{.service.name="test"}',
      };

      const query = ClickHouseQueryBuilder.buildSearchQuery(
        searchParams,
        tableName,
      );

      expect(query).toContain("LIMIT 50");
      expect(query).toContain("ServiceName = 'test-service'");
      expect(query).toContain("SpanName = 'test-operation'");
      expect(query).toContain("Duration >= 1000000");
      expect(query).toContain("Duration <= 10000000");
    });
  });

  describe("buildTraceIdQuery", () => {
    const traceId = "test-trace-id";

    it("should build query with trace ID only", () => {
      const query = ClickHouseQueryBuilder.buildTraceIdQuery(
        traceId,
        tableName,
      );

      expect(query).toContain(`TraceId = '${traceId}'`);
      expect(query).toContain("ORDER BY Timestamp ASC");
      expect(query).toContain("`traces`");
    });

    it("should escape single quotes in trace ID", () => {
      const query = ClickHouseQueryBuilder.buildTraceIdQuery(
        "test'trace",
        tableName,
      );

      expect(query).toContain("TraceId = 'test''trace'");
    });

    it("should include time range with start and end", () => {
      const timeRange = {
        start: "2024-01-01T00:00:00Z",
        end: "2024-01-02T00:00:00Z",
      };

      const query = ClickHouseQueryBuilder.buildTraceIdQuery(
        traceId,
        tableName,
        timeRange,
      );

      expect(query).toContain("Timestamp >=");
      expect(query).toContain("Timestamp <=");
    });

    it("should escape table name with backticks", () => {
      const query = ClickHouseQueryBuilder.buildTraceIdQuery(
        traceId,
        tableName,
      );

      expect(query).toContain("`traces`");
    });

    it("should NOT include project trace filter in WHERE clause (fetches all spans for client-side filtering)", () => {
      const projectTraceFilter = {
        attributeName: "project.id",
        attributeValue: "project-123",
      };
      const query = ClickHouseQueryBuilder.buildTraceIdQuery(
        traceId,
        tableName,
      );

      expect(query).toContain(`TraceId = '${traceId}'`);
      expect(query).not.toContain("'project.id'");
      expect(query).not.toContain("'project-123'");
      expect(query).not.toContain("mapContains(SpanAttributes");
      expect(query).not.toContain("mapContains(ResourceAttributes");
    });
  });
});
