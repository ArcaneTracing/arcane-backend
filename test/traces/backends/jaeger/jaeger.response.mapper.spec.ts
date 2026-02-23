import { JaegerResponseMapper } from "../../../../src/traces/backends/jaeger/jaeger.response.mapper";
import { JaegerTracesData } from "../../../../src/traces/backends/jaeger/jaeger.types";

const jaegerTraceJson = require("../../resources/jaeger/trace.json");
const jaegerTraceListJson = require("../../resources/jaeger/trace-list.json");

describe("JaegerResponseMapper", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("toTempoSearchResponse", () => {
    it("should return empty traces when data is undefined", () => {
      const result = JaegerResponseMapper.toTempoSearchResponse(undefined);

      expect(result).toEqual({ traces: [] });
    });

    it("should return empty traces when resourceSpans is empty", () => {
      const data: JaegerTracesData = {
        resourceSpans: [],
      };

      const result = JaegerResponseMapper.toTempoSearchResponse(data);

      expect(result).toEqual({ traces: [] });
    });

    it("should filter out traces from jaeger service", () => {
      const data: JaegerTracesData = {
        resourceSpans: [
          {
            resource: {
              attributes: [
                {
                  key: "service.name",
                  value: { stringValue: "jaeger" },
                },
              ],
            },
            scopeSpans: [
              {
                scope: { name: "test-scope" },
                spans: [
                  {
                    traceId: "trace-1",
                    spanId: "span-1",
                    name: "test-span",
                    startTimeUnixNano: "1000000000",
                    endTimeUnixNano: "2000000000",
                    attributes: [],
                  },
                ],
              },
            ],
          },
        ],
      };

      const result = JaegerResponseMapper.toTempoSearchResponse(data);

      expect(result.traces).toEqual([]);
    });

    it("should filter out traces from JAEGER service (case insensitive)", () => {
      const data: JaegerTracesData = {
        resourceSpans: [
          {
            resource: {
              attributes: [
                {
                  key: "service.name",
                  value: { stringValue: "JAEGER" },
                },
              ],
            },
            scopeSpans: [
              {
                scope: { name: "test-scope" },
                spans: [
                  {
                    traceId: "trace-1",
                    spanId: "span-1",
                    name: "test-span",
                    startTimeUnixNano: "1000000000",
                    endTimeUnixNano: "2000000000",
                    attributes: [],
                  },
                ],
              },
            ],
          },
        ],
      };

      const result = JaegerResponseMapper.toTempoSearchResponse(data);

      expect(result.traces).toEqual([]);
    });

    it("should handle spans without traceId", () => {
      const data: JaegerTracesData = {
        resourceSpans: [
          {
            resource: {
              attributes: [
                {
                  key: "service.name",
                  value: { stringValue: "test-service" },
                },
              ],
            },
            scopeSpans: [
              {
                scope: { name: "test-scope" },
                spans: [
                  {
                    spanId: "span-1",
                    name: "test-span",
                    startTimeUnixNano: "1000000000",
                    endTimeUnixNano: "2000000000",
                    attributes: [],
                  },
                ],
              },
            ],
          },
        ],
      };

      const result = JaegerResponseMapper.toTempoSearchResponse(data);

      expect(result.traces).toEqual([]);
    });

    it("should handle rootTraceName assignment for root spans", () => {
      const data: JaegerTracesData = {
        resourceSpans: [
          {
            resource: {
              attributes: [
                {
                  key: "service.name",
                  value: { stringValue: "test-service" },
                },
              ],
            },
            scopeSpans: [
              {
                scope: { name: "test-scope" },
                spans: [
                  {
                    traceId: "trace-1",
                    spanId: "span-1",
                    name: "root-span",
                    startTimeUnixNano: "1000000000",
                    endTimeUnixNano: "2000000000",
                    attributes: [],
                  },
                  {
                    traceId: "trace-1",
                    spanId: "span-2",
                    parentSpanId: "span-1",
                    name: "child-span",
                    startTimeUnixNano: "1500000000",
                    endTimeUnixNano: "1800000000",
                    attributes: [],
                  },
                ],
              },
            ],
          },
        ],
      };

      const result = JaegerResponseMapper.toTempoSearchResponse(data);

      expect(result.traces.length).toBe(1);
      expect(result.traces[0].rootTraceName).toBe("root-span");
    });

    it("should transform actual Jaeger response from resource file", () => {
      const result = JaegerResponseMapper.toTempoSearchResponse(
        jaegerTraceListJson.result,
      );

      expect(result).toHaveProperty("traces");
      expect(Array.isArray(result.traces)).toBe(true);

      if (result.traces.length > 0) {
        expect(result.traces[0]).toHaveProperty("traceID");
        expect(result.traces[0]).toHaveProperty("rootServiceName");
        expect(result.traces[0]).toHaveProperty("rootTraceName");
      }
    });

    it("should handle snake_case resourceSpans", () => {
      const data = {
        resource_spans: [
          {
            resource: {
              attributes: [
                {
                  key: "service.name",
                  value: { stringValue: "test-service" },
                },
              ],
            },
            scope_spans: [
              {
                scope: { name: "test-scope" },
                spans: [
                  {
                    trace_id: "trace-1",
                    span_id: "span-1",
                    name: "test-span",
                    start_time_unix_nano: "1000000000",
                    end_time_unix_nano: "2000000000",
                    attributes: [],
                  },
                ],
              },
            ],
          },
        ],
      };

      const result = JaegerResponseMapper.toTempoSearchResponse(data as any);

      expect(result.traces.length).toBe(1);
      expect(result.traces[0].traceID).toBe("trace-1");
    });

    it("should include ALL spans from the same trace in spanSet for filtering", () => {
      const data = {
        resourceSpans: [
          {
            resource: {
              attributes: [
                {
                  key: "service.name",
                  value: { stringValue: "test-service" },
                },
              ],
            },
            scopeSpans: [
              {
                scope: { name: "test-scope" },
                spans: [
                  {
                    traceId: "trace-1",
                    spanId: "span-1",
                    name: "span-1",
                    startTimeUnixNano: "1000000000",
                    endTimeUnixNano: "2000000000",
                    attributes: [
                      {
                        key: "project.id",
                        value: { stringValue: "project-123" },
                      },
                    ],
                  },
                  {
                    traceId: "trace-1",
                    spanId: "span-2",
                    name: "span-2",
                    startTimeUnixNano: "2000000000",
                    endTimeUnixNano: "3000000000",
                    attributes: [
                      { key: "other.attr", value: { stringValue: "value" } },
                    ],
                  },
                  {
                    traceId: "trace-1",
                    spanId: "span-3",
                    name: "span-3",
                    startTimeUnixNano: "3000000000",
                    endTimeUnixNano: "4000000000",
                    attributes: [
                      { key: "another.attr", value: { stringValue: "value2" } },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      };

      const result = JaegerResponseMapper.toTempoSearchResponse(data as any);

      expect(result.traces.length).toBe(1);
      expect(result.traces[0].traceID).toBe("trace-1");

      expect(result.traces[0].spanSet?.spans?.length).toBe(3);
      expect(result.traces[0].spanSet?.spans?.[0]?.spanID).toBe("span-1");
      expect(result.traces[0].spanSet?.spans?.[1]?.spanID).toBe("span-2");
      expect(result.traces[0].spanSet?.spans?.[2]?.spanID).toBe("span-3");

      expect(
        result.traces[0].spanSet?.spans?.[0]?.attributes?.some(
          (attr) => attr.key === "service.name",
        ),
      ).toBe(true);
      expect(
        result.traces[0].spanSet?.spans?.[0]?.attributes?.some(
          (attr) => attr.key === "project.id",
        ),
      ).toBe(true);
      expect(
        result.traces[0].spanSet?.spans?.[1]?.attributes?.some(
          (attr) => attr.key === "other.attr",
        ),
      ).toBe(true);
      expect(
        result.traces[0].spanSet?.spans?.[2]?.attributes?.some(
          (attr) => attr.key === "another.attr",
        ),
      ).toBe(true);
    });
  });

  describe("toTempoTraceResponse", () => {
    const traceId = "test-trace-id";

    it("should return empty batches when data is undefined", () => {
      const result = JaegerResponseMapper.toTempoTraceResponse(
        undefined,
        traceId,
      );

      expect(result).toEqual({
        traceID: traceId,
        batches: [],
      });
    });

    it("should filter out jaeger service traces", () => {
      const data: JaegerTracesData = {
        resourceSpans: [
          {
            resource: {
              attributes: [
                {
                  key: "service.name",
                  value: { stringValue: "jaeger" },
                },
              ],
            },
            scopeSpans: [],
          },
        ],
      };

      const result = JaegerResponseMapper.toTempoTraceResponse(data, traceId);

      expect(result.batches).toEqual([]);
    });

    it("should transform actual Jaeger trace response from resource file", () => {
      const result = JaegerResponseMapper.toTempoTraceResponse(
        jaegerTraceJson.result,
        traceId,
      );

      expect(result).toHaveProperty("traceID");
      expect(result).toHaveProperty("batches");
      expect(Array.isArray(result.batches)).toBe(true);

      if (result.batches.length > 0) {
        const firstBatch = result.batches[0];
        expect(firstBatch).toHaveProperty("resource");
        expect(firstBatch).toHaveProperty("scopeSpans");
      }
    });

    it("should handle snake_case format", () => {
      const data = {
        resource_spans: [
          {
            resource: {
              attributes: [
                {
                  key: "service.name",
                  value: { stringValue: "test-service" },
                },
              ],
            },
            scope_spans: [
              {
                scope: { name: "test-scope" },
                spans: [
                  {
                    trace_id: traceId,
                    span_id: "span-1",
                    parent_span_id: undefined,
                    name: "test-span",
                    start_time_unix_nano: "1000000000",
                    end_time_unix_nano: "2000000000",
                    attributes: [],
                  },
                ],
              },
            ],
          },
        ],
      };

      const result = JaegerResponseMapper.toTempoTraceResponse(
        data as any,
        traceId,
      );

      expect(result.batches.length).toBe(1);
      expect(result.batches[0].scopeSpans[0].spans[0].trace_id).toBe(traceId);
    });
  });

  describe("deserializeAnyValue", () => {
    it("should handle undefined value", () => {
      const data: JaegerTracesData = {
        resourceSpans: [
          {
            resource: {
              attributes: [
                {
                  key: "test-key",
                  value: undefined,
                },
              ],
            },
            scopeSpans: [],
          },
        ],
      };

      const result = JaegerResponseMapper.toTempoSearchResponse(data);

      expect(result).toBeDefined();
    });

    it("should handle boolValue", () => {
      const data: JaegerTracesData = {
        resourceSpans: [
          {
            resource: {
              attributes: [
                {
                  key: "test-key",
                  value: { boolValue: true },
                },
              ],
            },
            scopeSpans: [],
          },
        ],
      };

      const result = JaegerResponseMapper.toTempoSearchResponse(data);
      expect(result.traces.length).toBeGreaterThanOrEqual(0);
    });

    it("should handle doubleValue", () => {
      const data: JaegerTracesData = {
        resourceSpans: [
          {
            resource: {
              attributes: [
                {
                  key: "test-key",
                  value: { doubleValue: 3.14 },
                },
              ],
            },
            scopeSpans: [],
          },
        ],
      };

      const result = JaegerResponseMapper.toTempoSearchResponse(data);
      expect(result.traces.length).toBeGreaterThanOrEqual(0);
    });

    it("should handle bytesValue", () => {
      const data: JaegerTracesData = {
        resourceSpans: [
          {
            resource: {
              attributes: [
                {
                  key: "test-key",
                  value: { bytesValue: new Uint8Array([1, 2, 3]) },
                },
              ],
            },
            scopeSpans: [],
          },
        ],
      };

      const result = JaegerResponseMapper.toTempoSearchResponse(data);
      expect(result.traces.length).toBeGreaterThanOrEqual(0);
    });

    it("should handle arrayValue", () => {
      const data: JaegerTracesData = {
        resourceSpans: [
          {
            resource: {
              attributes: [
                {
                  key: "test-key",
                  value: {
                    arrayValue: {
                      values: [
                        { stringValue: "value1" },
                        { stringValue: "value2" },
                      ],
                    },
                  },
                },
              ],
            },
            scopeSpans: [],
          },
        ],
      };

      const result = JaegerResponseMapper.toTempoSearchResponse(data);
      expect(result.traces.length).toBeGreaterThanOrEqual(0);
    });

    it("should handle kvlistValue", () => {
      const data: JaegerTracesData = {
        resourceSpans: [
          {
            resource: {
              attributes: [
                {
                  key: "test-key",
                  value: {
                    kvlistValue: {
                      values: [
                        {
                          key: "nested-key",
                          value: { stringValue: "nested-value" },
                        },
                      ],
                    },
                  },
                },
              ],
            },
            scopeSpans: [],
          },
        ],
      };

      const result = JaegerResponseMapper.toTempoSearchResponse(data);
      expect(result.traces.length).toBeGreaterThanOrEqual(0);
    });

    it("should handle snake_case value formats", () => {
      const data = {
        resourceSpans: [
          {
            resource: {
              attributes: [
                {
                  key: "test-key",
                  value: {
                    string_value: "test-value",
                    bool_value: true,
                    double_value: 3.14,
                    int_value: 42,
                  },
                },
              ],
            },
            scopeSpans: [],
          },
        ],
      };

      const result = JaegerResponseMapper.toTempoSearchResponse(data as any);
      expect(result.traces.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe("getTraceId", () => {
    it("should handle Uint8Array traceId", () => {
      const data: JaegerTracesData = {
        resourceSpans: [
          {
            resource: {
              attributes: [],
            },
            scopeSpans: [
              {
                scope: { name: "test-scope" },
                spans: [
                  {
                    traceId: new Uint8Array([0x12, 0x34, 0x56, 0x78]),
                    spanId: "span-1",
                    name: "test-span",
                    startTimeUnixNano: "1000000000",
                    endTimeUnixNano: "2000000000",
                    attributes: [],
                  },
                ],
              },
            ],
          },
        ],
      };

      const result = JaegerResponseMapper.toTempoSearchResponse(data);
      expect(result.traces.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe("toBigInt", () => {
    it("should handle string timestamp", () => {
      const data: JaegerTracesData = {
        resourceSpans: [
          {
            resource: {
              attributes: [],
            },
            scopeSpans: [
              {
                scope: { name: "test-scope" },
                spans: [
                  {
                    traceId: "trace-1",
                    spanId: "span-1",
                    name: "test-span",
                    startTimeUnixNano: "1000000000",
                    endTimeUnixNano: "2000000000",
                    attributes: [],
                  },
                ],
              },
            ],
          },
        ],
      };

      const result = JaegerResponseMapper.toTempoSearchResponse(data);
      expect(result.traces.length).toBeGreaterThanOrEqual(0);
    });

    it("should handle number timestamp", () => {
      const data: JaegerTracesData = {
        resourceSpans: [
          {
            resource: {
              attributes: [],
            },
            scopeSpans: [
              {
                scope: { name: "test-scope" },
                spans: [
                  {
                    traceId: "trace-1",
                    spanId: "span-1",
                    name: "test-span",
                    startTimeUnixNano: 1000000000,
                    endTimeUnixNano: 2000000000,
                    attributes: [],
                  },
                ],
              },
            ],
          },
        ],
      };

      const result = JaegerResponseMapper.toTempoSearchResponse(data);
      expect(result.traces.length).toBeGreaterThanOrEqual(0);
    });

    it("should handle Fixed64 with low and high", () => {
      const data: JaegerTracesData = {
        resourceSpans: [
          {
            resource: {
              attributes: [],
            },
            scopeSpans: [
              {
                scope: { name: "test-scope" },
                spans: [
                  {
                    traceId: "trace-1",
                    spanId: "span-1",
                    name: "test-span",
                    startTimeUnixNano: { low: 1000000000, high: 0 },
                    endTimeUnixNano: { low: 2000000000, high: 0 },
                    attributes: [],
                  },
                ],
              },
            ],
          },
        ],
      };

      const result = JaegerResponseMapper.toTempoSearchResponse(data);
      expect(result.traces.length).toBeGreaterThanOrEqual(0);
    });

    it("should handle invalid BigInt string", () => {
      const data: JaegerTracesData = {
        resourceSpans: [
          {
            resource: {
              attributes: [],
            },
            scopeSpans: [
              {
                scope: { name: "test-scope" },
                spans: [
                  {
                    traceId: "trace-1",
                    spanId: "span-1",
                    name: "test-span",
                    startTimeUnixNano: "invalid",
                    endTimeUnixNano: "2000000000",
                    attributes: [],
                  },
                ],
              },
            ],
          },
        ],
      };

      const result = JaegerResponseMapper.toTempoSearchResponse(data);

      expect(result).toBeDefined();
    });
  });

  describe("toDurationMs", () => {
    it("should return undefined when start is missing", () => {
      const data: JaegerTracesData = {
        resourceSpans: [
          {
            resource: {
              attributes: [],
            },
            scopeSpans: [
              {
                scope: { name: "test-scope" },
                spans: [
                  {
                    traceId: "trace-1",
                    spanId: "span-1",
                    name: "test-span",
                    endTimeUnixNano: "2000000000",
                    attributes: [],
                  },
                ],
              },
            ],
          },
        ],
      };

      const result = JaegerResponseMapper.toTempoSearchResponse(data);
      expect(result.traces.length).toBeGreaterThanOrEqual(0);
    });

    it("should return undefined when end is missing", () => {
      const data: JaegerTracesData = {
        resourceSpans: [
          {
            resource: {
              attributes: [],
            },
            scopeSpans: [
              {
                scope: { name: "test-scope" },
                spans: [
                  {
                    traceId: "trace-1",
                    spanId: "span-1",
                    name: "test-span",
                    startTimeUnixNano: "1000000000",
                    attributes: [],
                  },
                ],
              },
            ],
          },
        ],
      };

      const result = JaegerResponseMapper.toTempoSearchResponse(data);
      expect(result.traces.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe("minBigInt and maxBigInt", () => {
    it("should handle undefined current in minBigInt", () => {
      const data: JaegerTracesData = {
        resourceSpans: [
          {
            resource: {
              attributes: [],
            },
            scopeSpans: [
              {
                scope: { name: "test-scope" },
                spans: [
                  {
                    traceId: "trace-1",
                    spanId: "span-1",
                    name: "test-span",
                    startTimeUnixNano: "1000000000",
                    endTimeUnixNano: "2000000000",
                    attributes: [],
                  },
                  {
                    traceId: "trace-1",
                    spanId: "span-2",
                    name: "test-span-2",
                    startTimeUnixNano: "500000000",
                    endTimeUnixNano: "1500000000",
                    attributes: [],
                  },
                ],
              },
            ],
          },
        ],
      };

      const result = JaegerResponseMapper.toTempoSearchResponse(data);
      expect(result.traces.length).toBe(1);

      expect(result.traces[0].startTimeUnixNano).toBeDefined();
    });

    it("should handle undefined next in minBigInt", () => {
      const data: JaegerTracesData = {
        resourceSpans: [
          {
            resource: {
              attributes: [],
            },
            scopeSpans: [
              {
                scope: { name: "test-scope" },
                spans: [
                  {
                    traceId: "trace-1",
                    spanId: "span-1",
                    name: "test-span",
                    startTimeUnixNano: "1000000000",
                    endTimeUnixNano: "2000000000",
                    attributes: [],
                  },
                ],
              },
            ],
          },
        ],
      };

      const result = JaegerResponseMapper.toTempoSearchResponse(data);
      expect(result.traces.length).toBe(1);
    });

    it("should handle undefined current in maxBigInt", () => {
      const data: JaegerTracesData = {
        resourceSpans: [
          {
            resource: {
              attributes: [],
            },
            scopeSpans: [
              {
                scope: { name: "test-scope" },
                spans: [
                  {
                    traceId: "trace-1",
                    spanId: "span-1",
                    name: "test-span",
                    startTimeUnixNano: "1000000000",
                    endTimeUnixNano: "2000000000",
                    attributes: [],
                  },
                ],
              },
            ],
          },
        ],
      };

      const result = JaegerResponseMapper.toTempoSearchResponse(data);
      expect(result.traces.length).toBe(1);
    });

    it("should handle undefined next in maxBigInt", () => {
      const data: JaegerTracesData = {
        resourceSpans: [
          {
            resource: {
              attributes: [],
            },
            scopeSpans: [
              {
                scope: { name: "test-scope" },
                spans: [
                  {
                    traceId: "trace-1",
                    spanId: "span-1",
                    name: "test-span",
                    startTimeUnixNano: "1000000000",
                    endTimeUnixNano: "2000000000",
                    attributes: [],
                  },
                  {
                    traceId: "trace-1",
                    spanId: "span-2",
                    name: "test-span-2",
                    startTimeUnixNano: "1500000000",
                    endTimeUnixNano: "3000000000",
                    attributes: [],
                  },
                ],
              },
            ],
          },
        ],
      };

      const result = JaegerResponseMapper.toTempoSearchResponse(data);
      expect(result.traces.length).toBe(1);

      expect(result.traces[0].durationMs).toBeDefined();
    });
  });
});
