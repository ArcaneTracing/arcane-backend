import { ClickHouseResponseMapper } from "../../../../src/traces/backends/clickhouse/clickhouse.response.mapper";

describe("ClickHouseResponseMapper", () => {
  describe("toTempoSearchResponse", () => {
    it("should transform ClickHouse rows to Tempo search response format", () => {
      const rows = [
        {
          TraceId: "trace-1",
          ServiceName: "service-1",
          SpanName: "span-1",
          Timestamp: "2024-01-01T00:00:00Z",
          Duration: 1000000,
        },
        {
          TraceId: "trace-2",
          ServiceName: "service-2",
          SpanName: "span-2",
          Timestamp: "2024-01-01T01:00:00Z",
          Duration: 2000000,
        },
      ];

      const result = ClickHouseResponseMapper.toTempoSearchResponse(rows);

      expect(result).toHaveProperty("traces");
      expect(result.traces).toHaveLength(2);
      expect(result.traces[0]).toHaveProperty("traceID", "trace-1");
      expect(result.traces[0]).toHaveProperty("rootServiceName", "service-1");
      expect(result.traces[0]).toHaveProperty("rootTraceName", "span-1");
      expect(result.traces[0]).toHaveProperty("startTimeUnixNano");
      expect(result.traces[0]).toHaveProperty("durationMs", 1);
    });

    it("should use MinTimestamp if Timestamp is not available", () => {
      const rows = [
        {
          TraceId: "trace-1",
          ServiceName: "service-1",
          SpanName: "span-1",
          MinTimestamp: "2024-01-01T00:00:00Z",
          Duration: 1000000,
        },
      ];

      const result = ClickHouseResponseMapper.toTempoSearchResponse(rows);

      expect(result.traces[0]).toHaveProperty("startTimeUnixNano");
    });

    it("should handle numeric timestamp", () => {
      const rows = [
        {
          TraceId: "trace-1",
          ServiceName: "service-1",
          SpanName: "span-1",
          Timestamp: 1704067200,
          Duration: 1000000,
        },
      ];

      const result = ClickHouseResponseMapper.toTempoSearchResponse(rows);

      expect(result.traces[0]).toHaveProperty("startTimeUnixNano");
    });

    it("should throw error for missing timestamp", () => {
      const rows = [
        {
          TraceId: "trace-1",
          ServiceName: "service-1",
          SpanName: "span-1",
          Duration: 1000000,
        },
      ];

      expect(() =>
        ClickHouseResponseMapper.toTempoSearchResponse(rows),
      ).toThrow("Invalid query result: missing timestamp");
    });

    it("should throw error for invalid timestamp string", () => {
      const rows = [
        {
          TraceId: "trace-1",
          ServiceName: "service-1",
          SpanName: "span-1",
          Timestamp: "invalid-date",
          Duration: 1000000,
        },
      ];

      expect(() =>
        ClickHouseResponseMapper.toTempoSearchResponse(rows),
      ).toThrow("Invalid timestamp value: invalid-date");
    });

    it("should handle empty rows array", () => {
      const rows: Array<Record<string, any>> = [];

      const result = ClickHouseResponseMapper.toTempoSearchResponse(rows);

      expect(result).toHaveProperty("traces");
      expect(result.traces).toHaveLength(0);
    });

    it("should handle missing optional fields", () => {
      const rows = [
        {
          TraceId: "trace-1",
          Timestamp: "2024-01-01T00:00:00Z",
        },
      ];

      const result = ClickHouseResponseMapper.toTempoSearchResponse(rows);

      expect(result.traces[0]).toHaveProperty("rootServiceName", "");
      expect(result.traces[0]).toHaveProperty("rootTraceName", "");
      expect(result.traces[0]).toHaveProperty("durationMs", 0);
    });
  });

  describe("toTempoTraceResponse", () => {
    const traceId = "trace-123";

    it("should transform ClickHouse rows to Tempo trace response format", () => {
      const rows = [
        {
          TraceId: traceId,
          SpanId: "span-1",
          ParentSpanId: "",
          SpanName: "span-1",
          SpanKind: "SPAN_KIND_INTERNAL",
          Timestamp: "2024-01-01T00:00:00Z",
          Duration: 1000000,
          StatusCode: "STATUS_CODE_OK",
          StatusMessage: "",
          SpanAttributes: { "service.name": "test-service" },
          ResourceAttributes: { "service.name": "test-service" },
          ScopeName: "test-scope",
          ScopeVersion: "1.0.0",
        },
      ];

      const result = ClickHouseResponseMapper.toTempoTraceResponse(
        rows,
        traceId,
      );

      expect(result).toHaveProperty("traceID", traceId);
      expect(result).toHaveProperty("batches");
      expect(result.batches).toHaveLength(1);
      expect(result.batches[0]).toHaveProperty("resource");
      expect(result.batches[0]).toHaveProperty("scopeSpans");
      expect(result.batches[0].scopeSpans[0]).toHaveProperty("spans");
      expect(result.batches[0].scopeSpans[0].spans).toHaveLength(1);
    });

    it("should throw error for empty rows", () => {
      const rows: Array<Record<string, any>> = [];

      expect(() =>
        ClickHouseResponseMapper.toTempoTraceResponse(rows, traceId),
      ).toThrow(`Trace not found: ${traceId}`);
    });

    it("should throw error when no valid spans can be transformed", () => {
      const rows = [
        {
          TraceId: traceId,
          SpanId: "span-1",
          Timestamp: "invalid-date",
        },
      ];

      expect(() =>
        ClickHouseResponseMapper.toTempoTraceResponse(rows, traceId),
      ).toThrow(
        `Trace found but no valid spans could be transformed: ${traceId}`,
      );
    });

    it("should skip invalid spans and continue with valid ones", () => {
      const rows = [
        {
          TraceId: traceId,
          SpanId: "span-1",
          Timestamp: "invalid-date",
        },
        {
          TraceId: traceId,
          SpanId: "span-2",
          ParentSpanId: "",
          SpanName: "span-2",
          SpanKind: "SPAN_KIND_INTERNAL",
          Timestamp: "2024-01-01T00:00:00Z",
          Duration: 1000000,
          StatusCode: "STATUS_CODE_OK",
          StatusMessage: "",
          SpanAttributes: {},
          ResourceAttributes: {},
          ScopeName: "test-scope",
          ScopeVersion: "1.0.0",
        },
      ];

      const result = ClickHouseResponseMapper.toTempoTraceResponse(
        rows,
        traceId,
      );

      expect(result.batches[0].scopeSpans[0].spans).toHaveLength(1);
      expect(result.batches[0].scopeSpans[0].spans[0]).toHaveProperty(
        "spanId",
        "span-2",
      );
    });
  });

  describe("transformSpanToTempoFormat", () => {
    it("should transform span row to Tempo format", () => {
      const row = {
        TraceId: "trace-1",
        SpanId: "span-1",
        ParentSpanId: "parent-1",
        SpanName: "test-span",
        SpanKind: "SPAN_KIND_INTERNAL",
        Timestamp: "2024-01-01T00:00:00Z",
        Duration: 1000000,
        StatusCode: "STATUS_CODE_OK",
        StatusMessage: "OK",
        SpanAttributes: { key: "value" },
      };

      const result = ClickHouseResponseMapper.transformSpanToTempoFormat(row);

      expect(result).toHaveProperty("traceId", "trace-1");
      expect(result).toHaveProperty("spanId", "span-1");
      expect(result).toHaveProperty("parentSpanId", "parent-1");
      expect(result).toHaveProperty("name", "test-span");
      expect(result).toHaveProperty("kind");
      expect(result).toHaveProperty("startTimeUnixNano");
      expect(result).toHaveProperty("endTimeUnixNano");
      expect(result).toHaveProperty("attributes");
      expect(result).toHaveProperty("status");
    });

    it("should handle null parentSpanId", () => {
      const row = {
        TraceId: "trace-1",
        SpanId: "span-1",
        ParentSpanId: "",
        SpanName: "test-span",
        SpanKind: "SPAN_KIND_INTERNAL",
        Timestamp: "2024-01-01T00:00:00Z",
        Duration: 1000000,
        StatusCode: "STATUS_CODE_OK",
        StatusMessage: "",
        SpanAttributes: {},
      };

      const result = ClickHouseResponseMapper.transformSpanToTempoFormat(row);

      expect(result.parentSpanId).toBeNull();
    });
  });

  describe("parseTimestamp", () => {
    it("should parse ISO string timestamp", () => {
      const timestamp = "2024-01-01T00:00:00Z";
      const result = (ClickHouseResponseMapper as any).parseTimestamp(
        timestamp,
      );

      expect(typeof result).toBe("number");
      expect(result).toBeGreaterThan(0);
    });

    it("should parse numeric timestamp", () => {
      const timestamp = 1704067200;
      const result = (ClickHouseResponseMapper as any).parseTimestamp(
        timestamp,
      );

      expect(result).toBe(1704067200);
    });

    it("should throw error for invalid timestamp", () => {
      expect(() =>
        (ClickHouseResponseMapper as any).parseTimestamp("invalid"),
      ).toThrow();
    });
  });

  describe("mapSpanKind", () => {
    it("should map SPAN_KIND_INTERNAL", () => {
      const result = (ClickHouseResponseMapper as any).mapSpanKind(
        "SPAN_KIND_INTERNAL",
      );
      expect(result).toBe(1);
    });

    it("should map SPAN_KIND_SERVER", () => {
      const result = (ClickHouseResponseMapper as any).mapSpanKind(
        "SPAN_KIND_SERVER",
      );
      expect(result).toBe(2);
    });

    it("should map SPAN_KIND_CLIENT", () => {
      const result = (ClickHouseResponseMapper as any).mapSpanKind(
        "SPAN_KIND_CLIENT",
      );
      expect(result).toBe(3);
    });

    it("should default to SPAN_KIND_UNSPECIFIED for unknown", () => {
      const result = (ClickHouseResponseMapper as any).mapSpanKind("UNKNOWN");
      expect(result).toBe(0);
    });
  });

  describe("mapStatusCode", () => {
    it("should map STATUS_CODE_OK", () => {
      const result = (ClickHouseResponseMapper as any).mapStatusCode(
        "STATUS_CODE_OK",
      );
      expect(result).toBe(1);
    });

    it("should map STATUS_CODE_ERROR", () => {
      const result = (ClickHouseResponseMapper as any).mapStatusCode(
        "STATUS_CODE_ERROR",
      );
      expect(result).toBe(2);
    });

    it("should default to STATUS_CODE_UNSET for unknown", () => {
      const result = (ClickHouseResponseMapper as any).mapStatusCode("UNKNOWN");
      expect(result).toBe(0);
    });
  });

  describe("mapAttributes", () => {
    it("should map object attributes to Tempo format", () => {
      const attributes = {
        "service.name": "test-service",
        "http.method": "GET",
      };

      const result = (ClickHouseResponseMapper as any).mapAttributes(
        attributes,
      );

      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(2);
      expect(result[0]).toHaveProperty("key", "service.name");
      expect(result[0]).toHaveProperty("value");
      expect(result[0].value).toHaveProperty("stringValue", "test-service");
    });

    it("should handle Map attributes", () => {
      const attributes = new Map([
        ["key1", "value1"],
        ["key2", "value2"],
      ]);

      const result = (ClickHouseResponseMapper as any).mapAttributes(
        attributes,
      );

      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(2);
    });

    it("should handle empty attributes", () => {
      const result = (ClickHouseResponseMapper as any).mapAttributes({});
      expect(result).toEqual([]);
    });

    it("should convert all attribute values to strings", () => {
      const attributes = {
        count: 42,
        enabled: true,
      };

      const result = (ClickHouseResponseMapper as any).mapAttributes(
        attributes,
      );

      expect(result[0].value).toHaveProperty("stringValue", "42");
      expect(result[1].value).toHaveProperty("stringValue", "true");
    });

    it("should handle null attributes", () => {
      const result = (ClickHouseResponseMapper as any).mapAttributes(null);
      expect(result).toEqual([]);
    });

    it("should handle undefined attributes", () => {
      const result = (ClickHouseResponseMapper as any).mapAttributes(undefined);
      expect(result).toEqual([]);
    });
  });

  describe("mapEvents", () => {
    it("should map events from row data", () => {
      const row = {
        "Events.Timestamp": ["2024-01-01T00:00:00Z", "2024-01-01T00:00:01Z"],
        "Events.Name": ["event-1", "event-2"],
        "Events.Attributes": [{ key1: "value1" }, { key2: "value2" }],
      };

      const result = (ClickHouseResponseMapper as any).mapEvents(row);

      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(2);
      expect(result[0]).toHaveProperty("timeUnixNano");
      expect(result[0]).toHaveProperty("name", "event-1");
      expect(result[0]).toHaveProperty("attributes");
      expect(result[1]).toHaveProperty("name", "event-2");
    });

    it("should handle empty events arrays", () => {
      const row = {
        "Events.Timestamp": [],
        "Events.Name": [],
        "Events.Attributes": [],
      };

      const result = (ClickHouseResponseMapper as any).mapEvents(row);

      expect(result).toEqual([]);
    });

    it("should handle missing events fields", () => {
      const row = {};

      const result = (ClickHouseResponseMapper as any).mapEvents(row);

      expect(result).toEqual([]);
    });

    it("should skip events with invalid timestamps", () => {
      const row = {
        "Events.Timestamp": ["invalid-date", "2024-01-01T00:00:00Z"],
        "Events.Name": ["event-1", "event-2"],
        "Events.Attributes": [{}, {}],
      };

      const result = (ClickHouseResponseMapper as any).mapEvents(row);

      expect(result).toHaveLength(1);
      expect(result[0]).toHaveProperty("name", "event-2");
    });

    it("should handle missing event names", () => {
      const row = {
        "Events.Timestamp": ["2024-01-01T00:00:00Z"],
        "Events.Name": [undefined],
        "Events.Attributes": [{}],
      };

      const result = (ClickHouseResponseMapper as any).mapEvents(row);

      expect(result).toHaveLength(1);
      expect(result[0]).toHaveProperty("name", "");
    });

    it("should handle mismatched array lengths", () => {
      const row = {
        "Events.Timestamp": ["2024-01-01T00:00:00Z"],
        "Events.Name": ["event-1", "event-2"],
        "Events.Attributes": [{}],
      };

      const result = (ClickHouseResponseMapper as any).mapEvents(row);

      expect(result).toHaveLength(1);
    });
  });

  describe("mapLinks", () => {
    it("should map links from row data", () => {
      const row = {
        "Links.TraceId": ["trace-1", "trace-2"],
        "Links.SpanId": ["span-1", "span-2"],
        "Links.TraceState": ["state-1", "state-2"],
        "Links.Attributes": [{ key1: "value1" }, { key2: "value2" }],
      };

      const result = (ClickHouseResponseMapper as any).mapLinks(row);

      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(2);
      expect(result[0]).toHaveProperty("traceId", "trace-1");
      expect(result[0]).toHaveProperty("spanId", "span-1");
      expect(result[0]).toHaveProperty("traceState", "state-1");
      expect(result[0]).toHaveProperty("attributes");
      expect(result[1]).toHaveProperty("traceId", "trace-2");
    });

    it("should handle empty links arrays", () => {
      const row = {
        "Links.TraceId": [],
        "Links.SpanId": [],
        "Links.TraceState": [],
        "Links.Attributes": [],
      };

      const result = (ClickHouseResponseMapper as any).mapLinks(row);

      expect(result).toEqual([]);
    });

    it("should handle missing links fields", () => {
      const row = {};

      const result = (ClickHouseResponseMapper as any).mapLinks(row);

      expect(result).toEqual([]);
    });

    it("should handle missing traceState", () => {
      const row = {
        "Links.TraceId": ["trace-1"],
        "Links.SpanId": ["span-1"],
        "Links.TraceState": [undefined],
        "Links.Attributes": [{}],
      };

      const result = (ClickHouseResponseMapper as any).mapLinks(row);

      expect(result).toHaveLength(1);
      expect(result[0]).toHaveProperty("traceState", "");
    });

    it("should handle mismatched array lengths", () => {
      const row = {
        "Links.TraceId": ["trace-1"],
        "Links.SpanId": ["span-1", "span-2"],
        "Links.TraceState": [],
        "Links.Attributes": [{}],
      };

      const result = (ClickHouseResponseMapper as any).mapLinks(row);

      expect(result).toHaveLength(1);
    });
  });

  describe("transformSpanToTempoFormat edge cases", () => {
    it("should handle missing optional fields gracefully", () => {
      const row = {
        TraceId: "trace-1",
        SpanId: "span-1",
        Timestamp: "2024-01-01T00:00:00Z",
      };

      const result = ClickHouseResponseMapper.transformSpanToTempoFormat(row);

      expect(result).toHaveProperty("name", "");
      expect(result).toHaveProperty("kind", 0);
      expect(result).toHaveProperty("status");
      expect(result.status).toHaveProperty("code", 0);
      expect(result.status).toHaveProperty("message", "");
    });

    it("should handle zero duration", () => {
      const row = {
        TraceId: "trace-1",
        SpanId: "span-1",
        Timestamp: "2024-01-01T00:00:00Z",
        Duration: 0,
      };

      const result = ClickHouseResponseMapper.transformSpanToTempoFormat(row);

      expect(result.startTimeUnixNano).toBe(result.endTimeUnixNano);
    });

    it("should handle all span kinds", () => {
      const spanKinds = [
        "SPAN_KIND_UNSPECIFIED",
        "SPAN_KIND_INTERNAL",
        "SPAN_KIND_SERVER",
        "SPAN_KIND_CLIENT",
        "SPAN_KIND_PRODUCER",
        "SPAN_KIND_CONSUMER",
      ];

      spanKinds.forEach((kind) => {
        const row = {
          TraceId: "trace-1",
          SpanId: "span-1",
          Timestamp: "2024-01-01T00:00:00Z",
          SpanKind: kind,
        };

        const result = ClickHouseResponseMapper.transformSpanToTempoFormat(row);
        expect(result).toHaveProperty("kind");
      });
    });

    it("should handle all status codes", () => {
      const statusCodes = [
        "STATUS_CODE_UNSET",
        "STATUS_CODE_OK",
        "STATUS_CODE_ERROR",
      ];

      statusCodes.forEach((code) => {
        const row = {
          TraceId: "trace-1",
          SpanId: "span-1",
          Timestamp: "2024-01-01T00:00:00Z",
          StatusCode: code,
        };

        const result = ClickHouseResponseMapper.transformSpanToTempoFormat(row);
        expect(result).toHaveProperty("status");
        expect(result.status).toHaveProperty("code");
      });
    });

    it("should throw error for missing timestamp", () => {
      const row = {
        TraceId: "trace-1",
        SpanId: "span-1",
      };

      expect(() =>
        ClickHouseResponseMapper.transformSpanToTempoFormat(row),
      ).toThrow();
    });

    it("should throw error for invalid timestamp type", () => {
      const row = {
        TraceId: "trace-1",
        SpanId: "span-1",
        Timestamp: {},
      };

      expect(() =>
        ClickHouseResponseMapper.transformSpanToTempoFormat(row),
      ).toThrow();
    });
  });

  describe("parseTimestamp edge cases", () => {
    it("should throw error for null timestamp", () => {
      expect(() =>
        (ClickHouseResponseMapper as any).parseTimestamp(null),
      ).toThrow("Missing timestamp value");
    });

    it("should throw error for undefined timestamp", () => {
      expect(() =>
        (ClickHouseResponseMapper as any).parseTimestamp(undefined),
      ).toThrow("Missing timestamp value");
    });

    it("should throw error for invalid timestamp type", () => {
      expect(() =>
        (ClickHouseResponseMapper as any).parseTimestamp({}),
      ).toThrow();
    });

    it("should handle zero timestamp", () => {
      const result = (ClickHouseResponseMapper as any).parseTimestamp(0);
      expect(result).toBe(0);
    });

    it("should handle negative timestamp", () => {
      const result = (ClickHouseResponseMapper as any).parseTimestamp(-1000);
      expect(result).toBe(-1000);
    });
  });
});
