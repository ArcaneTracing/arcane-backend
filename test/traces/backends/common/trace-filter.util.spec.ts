import { Test, TestingModule } from "@nestjs/testing";
import { TraceFilterUtil } from "../../../../src/traces/backends/common/trace-filter.util";
import { ProjectTraceFilter } from "../../../../src/traces/backends/trace-repository.interface";
import type {
  TempoTraceSummary,
  TempoTraceResponse,
} from "../../../../src/traces/backends/tempo/tempo.types";

describe("TraceFilterUtil", () => {
  let util: TraceFilterUtil;

  let module: TestingModule;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      providers: [TraceFilterUtil],
    }).compile();

    util = module.get<TraceFilterUtil>(TraceFilterUtil);
  });

  afterAll(async () => {
    await module.close();
  });

  describe("filterTraceSummaries", () => {
    const projectTraceFilter: ProjectTraceFilter = {
      attributeName: "project.id",
      attributeValue: "project-123",
    };

    it("should filter traces that match project filter in spanSet attributes", () => {
      const traces: TempoTraceSummary[] = [
        {
          traceID: "trace-1",
          spanSet: {
            spans: [
              {
                attributes: [
                  { key: "project.id", value: "project-123" },
                  { key: "service.name", value: "api" },
                ],
              },
            ],
          },
        },
        {
          traceID: "trace-2",
          spanSet: {
            spans: [
              {
                attributes: [{ key: "project.id", value: "project-456" }],
              },
            ],
          },
        },
        {
          traceID: "trace-3",
          spanSet: {
            spans: [
              {
                attributes: [{ key: "project.id", value: "project-123" }],
              },
            ],
          },
        },
      ];

      const result = util.filterTraceSummaries(traces, projectTraceFilter);

      expect(result.length).toBe(2);
      expect(result.map((t) => t.traceID)).toEqual(["trace-1", "trace-3"]);
    });

    it("should include trace if ANY span has matching attribute (checks all spans)", () => {
      const traces: TempoTraceSummary[] = [
        {
          traceID: "trace-1",
          spanSet: {
            spans: [
              {
                attributes: [
                  { key: "service.name", value: "api" },
                  { key: "other.attr", value: "value" },
                ],
              },
              {
                attributes: [
                  { key: "project.id", value: "project-123" },
                  { key: "another.attr", value: "value2" },
                ],
              },
              {
                attributes: [{ key: "yet.another.attr", value: "value3" }],
              },
            ],
          },
        },
        {
          traceID: "trace-2",
          spanSet: {
            spans: [
              {
                attributes: [{ key: "service.name", value: "api" }],
              },
              {
                attributes: [{ key: "project.id", value: "project-456" }],
              },
            ],
          },
        },
      ];

      const result = util.filterTraceSummaries(traces, projectTraceFilter);
      expect(result.length).toBe(1);
      expect(result[0].traceID).toBe("trace-1");

      expect(result[0].spanSet?.spans?.length).toBe(3);
    });

    it("should return empty array when no traces match", () => {
      const traces: TempoTraceSummary[] = [
        {
          traceID: "trace-1",
          spanSet: {
            spans: [
              {
                attributes: [{ key: "project.id", value: "project-456" }],
              },
            ],
          },
        },
      ];

      const result = util.filterTraceSummaries(traces, projectTraceFilter);

      expect(result).toEqual([]);
    });

    it("should exclude traces without spanSet", () => {
      const traces: TempoTraceSummary[] = [
        {
          traceID: "trace-1",
        },
        {
          traceID: "trace-2",
          spanSet: {
            spans: [
              {
                attributes: [{ key: "project.id", value: "project-123" }],
              },
            ],
          },
        },
      ];

      const result = util.filterTraceSummaries(traces, projectTraceFilter);

      expect(result.length).toBe(1);
      expect(result[0].traceID).toBe("trace-2");
    });

    it("should exclude traces with empty spanSet", () => {
      const traces: TempoTraceSummary[] = [
        {
          traceID: "trace-1",
          spanSet: {
            spans: [],
          },
        },
      ];

      const result = util.filterTraceSummaries(traces, projectTraceFilter);

      expect(result).toEqual([]);
    });

    it("should handle numeric attribute values", () => {
      const traces: TempoTraceSummary[] = [
        {
          traceID: "trace-1",
          spanSet: {
            spans: [
              {
                attributes: [{ key: "project.id", value: 123 }],
              },
            ],
          },
        },
        {
          traceID: "trace-2",
          spanSet: {
            spans: [
              {
                attributes: [{ key: "project.id", value: "123" }],
              },
            ],
          },
        },
      ];

      const filter: ProjectTraceFilter = {
        attributeName: "project.id",
        attributeValue: "123",
      };

      const result = util.filterTraceSummaries(traces, filter);

      expect(result.length).toBe(2);
    });

    it("should handle boolean attribute values", () => {
      const traces: TempoTraceSummary[] = [
        {
          traceID: "trace-1",
          spanSet: {
            spans: [
              {
                attributes: [{ key: "enabled", value: true }],
              },
            ],
          },
        },
      ];

      const filter: ProjectTraceFilter = {
        attributeName: "enabled",
        attributeValue: "true",
      };

      const result = util.filterTraceSummaries(traces, filter);

      expect(result.length).toBe(1);
    });

    it("should check multiple spans in spanSet", () => {
      const traces: TempoTraceSummary[] = [
        {
          traceID: "trace-1",
          spanSet: {
            spans: [
              {
                attributes: [{ key: "service.name", value: "api" }],
              },
              {
                attributes: [{ key: "project.id", value: "project-123" }],
              },
            ],
          },
        },
      ];

      const result = util.filterTraceSummaries(traces, projectTraceFilter);

      expect(result.length).toBe(1);
    });

    it("should exclude traces with null or undefined attribute values", () => {
      const traces: TempoTraceSummary[] = [
        {
          traceID: "trace-1",
          spanSet: {
            spans: [
              {
                attributes: [{ key: "project.id", value: null }],
              },
            ],
          },
        },
        {
          traceID: "trace-2",
          spanSet: {
            spans: [
              {
                attributes: [{ key: "project.id", value: undefined }],
              },
            ],
          },
        },
      ];

      const result = util.filterTraceSummaries(traces, projectTraceFilter);

      expect(result).toEqual([]);
    });
  });

  describe("filterFullTrace", () => {
    const projectTraceFilter: ProjectTraceFilter = {
      attributeName: "project.id",
      attributeValue: "project-123",
    };

    it("should return true when trace matches project filter in resource attributes", () => {
      const trace: TempoTraceResponse = {
        traceID: "trace-1",
        batches: [
          {
            resource: {
              attributes: [
                { key: "project.id", value: "project-123" },
                { key: "service.name", value: "api" },
              ],
            },
            scopeSpans: [],
          },
        ],
      };

      const result = util.filterFullTrace(trace, projectTraceFilter);

      expect(result).toBe(true);
    });

    it("should return true when trace matches project filter in span attributes", () => {
      const trace: TempoTraceResponse = {
        traceID: "trace-1",
        batches: [
          {
            resource: {
              attributes: [{ key: "service.name", value: "api" }],
            },
            scopeSpans: [
              {
                spans: [
                  {
                    attributes: [{ key: "project.id", value: "project-123" }],
                  },
                ],
              },
            ],
          },
        ],
      };

      const result = util.filterFullTrace(trace, projectTraceFilter);

      expect(result).toBe(true);
    });

    it("should return false when trace does not match project filter", () => {
      const trace: TempoTraceResponse = {
        traceID: "trace-1",
        batches: [
          {
            resource: {
              attributes: [{ key: "project.id", value: "project-456" }],
            },
            scopeSpans: [
              {
                spans: [
                  {
                    attributes: [{ key: "service.name", value: "api" }],
                  },
                ],
              },
            ],
          },
        ],
      };

      const result = util.filterFullTrace(trace, projectTraceFilter);

      expect(result).toBe(false);
    });

    it("should return false when trace has no batches", () => {
      const trace: TempoTraceResponse = {
        traceID: "trace-1",
        batches: [],
      };

      const result = util.filterFullTrace(trace, projectTraceFilter);

      expect(result).toBe(false);
    });

    it("should return false when trace has no attributes", () => {
      const trace: TempoTraceResponse = {
        traceID: "trace-1",
        batches: [
          {
            resource: {},
            scopeSpans: [
              {
                spans: [{}],
              },
            ],
          },
        ],
      };

      const result = util.filterFullTrace(trace, projectTraceFilter);

      expect(result).toBe(false);
    });

    it("should check multiple batches", () => {
      const trace: TempoTraceResponse = {
        traceID: "trace-1",
        batches: [
          {
            resource: {
              attributes: [{ key: "service.name", value: "api" }],
            },
            scopeSpans: [],
          },
          {
            resource: {
              attributes: [{ key: "project.id", value: "project-123" }],
            },
            scopeSpans: [],
          },
        ],
      };

      const result = util.filterFullTrace(trace, projectTraceFilter);

      expect(result).toBe(true);
    });

    it("should check multiple scopeSpans", () => {
      const trace: TempoTraceResponse = {
        traceID: "trace-1",
        batches: [
          {
            resource: {
              attributes: [],
            },
            scopeSpans: [
              {
                spans: [
                  {
                    attributes: [{ key: "service.name", value: "api" }],
                  },
                ],
              },
              {
                spans: [
                  {
                    attributes: [{ key: "project.id", value: "project-123" }],
                  },
                ],
              },
            ],
          },
        ],
      };

      const result = util.filterFullTrace(trace, projectTraceFilter);

      expect(result).toBe(true);
    });

    it("should check multiple spans", () => {
      const trace: TempoTraceResponse = {
        traceID: "trace-1",
        batches: [
          {
            resource: {
              attributes: [],
            },
            scopeSpans: [
              {
                spans: [
                  {
                    attributes: [{ key: "service.name", value: "api" }],
                  },
                  {
                    attributes: [{ key: "project.id", value: "project-123" }],
                  },
                ],
              },
            ],
          },
        ],
      };

      const result = util.filterFullTrace(trace, projectTraceFilter);

      expect(result).toBe(true);
    });

    it("should handle numeric attribute values", () => {
      const trace: TempoTraceResponse = {
        traceID: "trace-1",
        batches: [
          {
            resource: {
              attributes: [{ key: "project.id", value: 123 }],
            },
            scopeSpans: [],
          },
        ],
      };

      const filter: ProjectTraceFilter = {
        attributeName: "project.id",
        attributeValue: "123",
      };

      const result = util.filterFullTrace(trace, filter);

      expect(result).toBe(true);
    });

    it("should handle boolean attribute values", () => {
      const trace: TempoTraceResponse = {
        traceID: "trace-1",
        batches: [
          {
            resource: {
              attributes: [{ key: "enabled", value: true }],
            },
            scopeSpans: [],
          },
        ],
      };

      const filter: ProjectTraceFilter = {
        attributeName: "enabled",
        attributeValue: "true",
      };

      const result = util.filterFullTrace(trace, filter);

      expect(result).toBe(true);
    });

    it("should exclude traces with null or undefined attribute values", () => {
      const trace: TempoTraceResponse = {
        traceID: "trace-1",
        batches: [
          {
            resource: {
              attributes: [{ key: "project.id", value: null }],
            },
            scopeSpans: [],
          },
        ],
      };

      const result = util.filterFullTrace(trace, projectTraceFilter);

      expect(result).toBe(false);
    });

    it("should exclude traces with complex object attribute values", () => {
      const trace: TempoTraceResponse = {
        traceID: "trace-1",
        batches: [
          {
            resource: {
              attributes: [{ key: "project.id", value: { nested: "value" } }],
            },
            scopeSpans: [],
          },
        ],
      };

      const result = util.filterFullTrace(trace, projectTraceFilter);

      expect(result).toBe(false);
    });

    it("should handle OTLP-wrapped stringValue format from ClickHouse mapper", () => {
      const trace: TempoTraceResponse = {
        traceID: "trace-1",
        batches: [
          {
            resource: {
              attributes: [
                { key: "project.id", value: { stringValue: "project-123" } },
              ],
            },
            scopeSpans: [],
          },
        ],
      };

      const result = util.filterFullTrace(trace, projectTraceFilter);

      expect(result).toBe(true);
    });

    it("should handle OTLP-wrapped intValue format", () => {
      const trace: TempoTraceResponse = {
        traceID: "trace-1",
        batches: [
          {
            resource: {
              attributes: [{ key: "project.id", value: { intValue: 123 } }],
            },
            scopeSpans: [],
          },
        ],
      };

      const filter: ProjectTraceFilter = {
        attributeName: "project.id",
        attributeValue: "123",
      };

      const result = util.filterFullTrace(trace, filter);

      expect(result).toBe(true);
    });

    it("should handle OTLP-wrapped intValue as string from JSON", () => {
      const trace: TempoTraceResponse = {
        traceID: "trace-1",
        batches: [
          {
            resource: {
              attributes: [{ key: "project.id", value: { intValue: "123" } }],
            },
            scopeSpans: [],
          },
        ],
      };

      const filter: ProjectTraceFilter = {
        attributeName: "project.id",
        attributeValue: "123",
      };

      const result = util.filterFullTrace(trace, filter);

      expect(result).toBe(true);
    });

    it("should handle OTLP-wrapped boolValue format", () => {
      const trace: TempoTraceResponse = {
        traceID: "trace-1",
        batches: [
          {
            resource: {
              attributes: [{ key: "enabled", value: { boolValue: true } }],
            },
            scopeSpans: [],
          },
        ],
      };

      const filter: ProjectTraceFilter = {
        attributeName: "enabled",
        attributeValue: "true",
      };

      const result = util.filterFullTrace(trace, filter);

      expect(result).toBe(true);
    });

    it("should handle OTLP-wrapped doubleValue format", () => {
      const trace: TempoTraceResponse = {
        traceID: "trace-1",
        batches: [
          {
            resource: {
              attributes: [{ key: "score", value: { doubleValue: 0.95 } }],
            },
            scopeSpans: [],
          },
        ],
      };

      const filter: ProjectTraceFilter = {
        attributeName: "score",
        attributeValue: "0.95",
      };

      const result = util.filterFullTrace(trace, filter);

      expect(result).toBe(true);
    });

    it("should handle OTLP-wrapped values in span attributes", () => {
      const trace: TempoTraceResponse = {
        traceID: "trace-1",
        batches: [
          {
            resource: {
              attributes: [],
            },
            scopeSpans: [
              {
                spans: [
                  {
                    attributes: [
                      {
                        key: "project.id",
                        value: { stringValue: "project-123" },
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      };

      const result = util.filterFullTrace(trace, projectTraceFilter);

      expect(result).toBe(true);
    });
  });

  describe("filterFullTraces", () => {
    const projectTraceFilter: ProjectTraceFilter = {
      attributeName: "project.id",
      attributeValue: "project-123",
    };

    it("should filter multiple traces", () => {
      const traces: TempoTraceResponse[] = [
        {
          traceID: "trace-1",
          batches: [
            {
              resource: {
                attributes: [{ key: "project.id", value: "project-123" }],
              },
              scopeSpans: [],
            },
          ],
        },
        {
          traceID: "trace-2",
          batches: [
            {
              resource: {
                attributes: [{ key: "project.id", value: "project-456" }],
              },
              scopeSpans: [],
            },
          ],
        },
        {
          traceID: "trace-3",
          batches: [
            {
              resource: {
                attributes: [{ key: "project.id", value: "project-123" }],
              },
              scopeSpans: [],
            },
          ],
        },
      ];

      const result = util.filterFullTraces(traces, projectTraceFilter);

      expect(result.length).toBe(2);
      expect(result.map((t) => t.traceID)).toEqual(["trace-1", "trace-3"]);
    });

    it("should return empty array when no traces match", () => {
      const traces: TempoTraceResponse[] = [
        {
          traceID: "trace-1",
          batches: [
            {
              resource: {
                attributes: [{ key: "project.id", value: "project-456" }],
              },
              scopeSpans: [],
            },
          ],
        },
      ];

      const result = util.filterFullTraces(traces, projectTraceFilter);

      expect(result).toEqual([]);
    });
  });
});
