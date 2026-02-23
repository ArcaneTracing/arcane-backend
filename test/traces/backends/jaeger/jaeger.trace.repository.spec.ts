import { Test, TestingModule } from "@nestjs/testing";
import { HttpService } from "@nestjs/axios";
import {
  BadRequestException,
  InternalServerErrorException,
  NotFoundException,
} from "@nestjs/common";
import { of, throwError } from "rxjs";
import { JaegerTraceRepository } from "../../../../src/traces/backends/jaeger/jaeger.trace.repository";
import { JaegerResponseMapper } from "../../../../src/traces/backends/jaeger/jaeger.response.mapper";
import { TraceFilterUtil } from "../../../../src/traces/backends/common/trace-filter.util";
import { DatasourceAuthService } from "../../../../src/datasources/services/datasource-auth.service";
import {
  Datasource,
  DatasourceSource,
} from "../../../../src/datasources/entities/datasource.entity";
import { SearchTracesRequestDto } from "../../../../src/traces/dto/request/search-traces-request.dto";
import {
  ERROR_MESSAGES,
  formatError,
} from "../../../../src/common/constants/error-messages.constants";

const jaegerTraceJson = require("../../resources/jaeger/trace.json");
const jaegerTraceListJson = require("../../resources/jaeger/trace-list.json");
const tempoTraceJson = require("../../resources/tempo/trace.json");
const tempoTraceListJson = require("../../resources/tempo/trace-list.json");

describe("JaegerTraceRepository", () => {
  let repository: JaegerTraceRepository;
  let httpService: HttpService;

  const mockHttpService = {
    get: jest.fn(),
  };

  const mockDatasource: Datasource = {
    id: "datasource-1",
    name: "Jaeger Datasource",
    url: "https://jaeger.example.com",
    type: "traces" as any,
    source: DatasourceSource.JAEGER,
    organisationId: "org-1",
    createdAt: new Date(),
    updatedAt: new Date(),
    createdById: "user-1",
    projectId: "project-1",
  } as unknown as Datasource;
  const baseUrl = mockDatasource.url;

  let module: TestingModule;

  let traceFilterUtil: TraceFilterUtil;

  const mockTraceFilterUtil = {
    filterTraceSummaries: jest.fn(),
    filterFullTrace: jest.fn(),
    filterFullTraces: jest.fn(),
  };

  const mockDatasourceAuthService = {
    buildAuthHeaders: jest.fn().mockReturnValue({}),
  };

  beforeAll(async () => {
    module = await Test.createTestingModule({
      providers: [
        JaegerTraceRepository,
        {
          provide: HttpService,
          useValue: mockHttpService,
        },
        {
          provide: TraceFilterUtil,
          useValue: mockTraceFilterUtil,
        },
        {
          provide: DatasourceAuthService,
          useValue: mockDatasourceAuthService,
        },
      ],
    }).compile();

    repository = module.get<JaegerTraceRepository>(JaegerTraceRepository);
    httpService = module.get<HttpService>(HttpService);
    traceFilterUtil = module.get<TraceFilterUtil>(TraceFilterUtil);
  });

  afterAll(async () => {
    try {
      await module.close();
    } catch {
      // Ignore teardown errors (e.g. HttpService handles)
    }
  });

  beforeEach(() => {
    jest.clearAllMocks();

    mockTraceFilterUtil.filterTraceSummaries.mockImplementation(
      (traces) => traces,
    );
    mockTraceFilterUtil.filterFullTrace.mockReturnValue(true);
  });

  describe("search", () => {
    const searchParams: SearchTracesRequestDto = {
      limit: 10,
      q: 'service.name="test"',
      start: "2024-01-01T00:00:00Z",
      end: "2024-01-02T00:00:00Z",
    };

    it("should transform Jaeger response to Tempo format and preserve all attributes", async () => {
      mockHttpService.get.mockReturnValue(
        of({
          data: jaegerTraceListJson,
        }),
      );

      const result = await repository.search(mockDatasource, searchParams);

      expect(result).toHaveProperty("traces");
      expect(Array.isArray(result.traces)).toBe(true);

      expect(jaegerTraceListJson).toHaveProperty("result");
      expect(jaegerTraceListJson.result).toHaveProperty("resourceSpans");

      if (result.traces.length > 0) {
        const firstTrace = result.traces[0];
        expect(firstTrace).toHaveProperty("traceID");
        expect(firstTrace).toHaveProperty("rootServiceName");
        expect(firstTrace).toHaveProperty("rootTraceName");
        expect(typeof firstTrace.traceID).toBe("string");
        expect(firstTrace.traceID.length).toBeGreaterThan(0);

        if (firstTrace.tags) {
          expect(typeof firstTrace.tags).toBe("object");

          const tagKeys = Object.keys(firstTrace.tags);
          const hasImportantAttributes = tagKeys.some(
            (key) =>
              key.startsWith("llm.") ||
              key.startsWith("input.") ||
              key.startsWith("output.") ||
              key === "service.name" ||
              key === "openinference.span.kind",
          );

          expect(hasImportantAttributes || tagKeys.length === 0).toBe(true);
        }
      }

      expect(mockHttpService.get).toHaveBeenCalledWith(
        expect.stringContaining("/api/v3/traces"),
        expect.objectContaining({
          headers: expect.objectContaining({
            "Content-Type": "application/json",
            Accept: "application/json",
          }),
        }),
      );
    });

    it("should handle empty Jaeger response", async () => {
      mockHttpService.get.mockReturnValue(
        of({
          data: { result: { resourceSpans: [] } },
        }),
      );

      const result = await repository.search(mockDatasource, searchParams);

      expect(result).toHaveProperty("traces");
      expect(result.traces).toEqual([]);
    });

    it('should handle 404 with "No traces found" message as empty result', async () => {
      const error = {
        response: {
          status: 404,
          statusText: "Not Found",
          data: {
            error: {
              message: "No traces found",
            },
          },
        },
      };
      mockHttpService.get.mockReturnValue(throwError(() => error));

      const result = await repository.search(mockDatasource, searchParams);

      expect(result).toHaveProperty("traces");
      expect(result.traces).toEqual([]);
    });

    it("should throw error for other 404 responses", async () => {
      const error = {
        response: {
          status: 404,
          statusText: "Not Found",
          data: {
            error: {
              message: "Resource not found",
            },
          },
        },
      };
      mockHttpService.get.mockReturnValue(throwError(() => error));

      const promise = repository.search(mockDatasource, searchParams);
      await expect(promise).rejects.toThrow();
    });

    it("should throw error if datasource URL is missing", async () => {
      const datasourceWithoutUrl = {
        ...mockDatasource,
        url: null,
      } as unknown as Datasource;

      const promise = repository.search(datasourceWithoutUrl, searchParams);
      await expect(promise).rejects.toThrow("Jaeger URL is required");
    });

    it("should handle error response from Jaeger API", async () => {
      mockHttpService.get.mockReturnValue(
        of({
          data: {
            error: {
              message: "API error",
            },
          },
        }),
      );

      const promise = repository.search(mockDatasource, searchParams);
      await expect(promise).rejects.toThrow("API error");
    });

    it("should throw BadRequestException when attributes are provided", async () => {
      const searchParamsWithAttributes: SearchTracesRequestDto = {
        ...searchParams,
        attributes: "key=value",
      };

      const promise = repository.search(
        mockDatasource,
        searchParamsWithAttributes,
      );
      await expect(promise).rejects.toThrow(BadRequestException);
      await expect(promise).rejects.toThrow(
        formatError(
          ERROR_MESSAGES.SEARCH_BY_ATTRIBUTES_NOT_SUPPORTED,
          DatasourceSource.JAEGER,
        ),
      );
    });

    it("should handle error response without message", async () => {
      mockHttpService.get.mockReturnValue(
        of({
          data: {
            error: {},
          },
        }),
      );

      const promise = repository.search(mockDatasource, searchParams);
      await expect(promise).rejects.toThrow(InternalServerErrorException);
    });

    it("should handle search_depth error message", async () => {
      const error = {
        response: {
          status: 400,
          statusText: "Bad Request",
          data: {
            error: {
              message: "search depth exceeded",
              httpCode: 400,
            },
          },
        },
      };
      mockHttpService.get.mockReturnValue(throwError(() => error));

      const promise = repository.search(mockDatasource, searchParams);
      await expect(promise).rejects.toThrow(InternalServerErrorException);
    });

    it("should handle num_traces error message", async () => {
      const error = {
        response: {
          status: 400,
          statusText: "Bad Request",
          data: {
            error: {
              message: "num_traces limit exceeded",
              httpCode: 400,
            },
          },
        },
      };
      mockHttpService.get.mockReturnValue(throwError(() => error));

      const promise = repository.search(mockDatasource, searchParams);
      await expect(promise).rejects.toThrow(InternalServerErrorException);
    });

    it("should handle string response data", async () => {
      const error = {
        response: {
          status: 500,
          statusText: "Internal Server Error",
          data: "Server error string",
        },
      };
      mockHttpService.get.mockReturnValue(throwError(() => error));

      const promise = repository.search(mockDatasource, searchParams);
      await expect(promise).rejects.toThrow(InternalServerErrorException);
      await expect(promise).rejects.toThrow(
        formatError(
          ERROR_MESSAGES.JAEGER_API_ERROR,
          500,
          "Server error string",
        ),
      );
    });

    it("should handle request error (no response)", async () => {
      const error = {
        request: {},
        message: "Network error",
      };
      mockHttpService.get.mockReturnValue(throwError(() => error));

      const promise = repository.search(mockDatasource, searchParams);
      await expect(promise).rejects.toThrow(InternalServerErrorException);
      await expect(promise).rejects.toThrow(
        formatError(
          ERROR_MESSAGES.JAEGER_CONNECTION_ERROR,
          baseUrl,
          "Network error",
        ),
      );
    });

    it("should handle error with code instead of httpCode", async () => {
      const error = {
        response: {
          status: 500,
          statusText: "Internal Server Error",
          data: {
            error: {
              message: "Server error",
              code: 500,
            },
          },
        },
      };
      mockHttpService.get.mockReturnValue(throwError(() => error));

      const promise = repository.search(mockDatasource, searchParams);
      await expect(promise).rejects.toThrow(InternalServerErrorException);
    });

    it("should filter traces by project filter client-side when project filter is provided", async () => {
      const projectTraceFilter = {
        attributeName: "project.id",
        attributeValue: "project-123",
      };

      const mockTraces = [
        {
          traceID: "trace-1",
          spanSet: {
            spans: [
              { attributes: [{ key: "project.id", value: "project-123" }] },
            ],
          },
        },
        {
          traceID: "trace-2",
          spanSet: {
            spans: [
              { attributes: [{ key: "project.id", value: "project-456" }] },
            ],
          },
        },
        {
          traceID: "trace-3",
          spanSet: {
            spans: [
              { attributes: [{ key: "project.id", value: "project-123" }] },
            ],
          },
        },
      ];

      mockHttpService.get.mockReturnValue(
        of({
          data: jaegerTraceListJson,
        }),
      );
      mockTraceFilterUtil.filterTraceSummaries.mockReturnValue([
        mockTraces[0],
        mockTraces[2],
      ]);

      const result = await repository.search(
        mockDatasource,
        searchParams,
        projectTraceFilter,
      );

      expect(mockTraceFilterUtil.filterTraceSummaries).toHaveBeenCalledWith(
        expect.any(Array),
        projectTraceFilter,
      );
      expect(result.traces.length).toBe(2);
    });

    it("should not filter when project filter is not provided", async () => {
      mockHttpService.get.mockReturnValue(
        of({
          data: jaegerTraceListJson,
        }),
      );

      const result = await repository.search(mockDatasource, searchParams);

      expect(mockTraceFilterUtil.filterTraceSummaries).not.toHaveBeenCalled();
      expect(result).toHaveProperty("traces");
    });

    it("should return empty array when all traces are filtered out by project filter", async () => {
      const projectTraceFilter = {
        attributeName: "project.id",
        attributeValue: "project-999",
      };

      mockHttpService.get.mockReturnValue(
        of({
          data: jaegerTraceListJson,
        }),
      );
      mockTraceFilterUtil.filterTraceSummaries.mockReturnValue([]);

      const result = await repository.search(
        mockDatasource,
        searchParams,
        projectTraceFilter,
      );

      expect(result.traces).toEqual([]);
    });
  });

  describe("searchByTraceId", () => {
    const traceId = "82760187488b369976271126ff15da86";

    it("should transform Jaeger trace response to Tempo format and preserve all attributes", async () => {
      mockHttpService.get.mockReturnValue(
        of({
          data: jaegerTraceJson,
        }),
      );

      const result = await repository.searchByTraceId(mockDatasource, traceId);

      expect(result).toHaveProperty("traceID");
      expect(result).toHaveProperty("batches");
      expect(Array.isArray(result.batches)).toBe(true);

      expect(jaegerTraceJson).toHaveProperty("result");
      expect(jaegerTraceJson.result).toHaveProperty("resourceSpans");

      if (result.batches && result.batches.length > 0) {
        const firstBatch = result.batches[0];
        expect(firstBatch).toHaveProperty("resource");
        expect(firstBatch).toHaveProperty("scopeSpans");

        if (firstBatch.resource && firstBatch.resource.attributes) {
          expect(Array.isArray(firstBatch.resource.attributes)).toBe(true);
          const resourceAttrKeys = firstBatch.resource.attributes.map(
            (attr: any) => attr.key,
          );
          expect(resourceAttrKeys.length).toBeGreaterThan(0);
          expect(resourceAttrKeys).toContain("service.name");
        }

        if (firstBatch.scopeSpans && firstBatch.scopeSpans.length > 0) {
          const spans = firstBatch.scopeSpans[0].spans || [];
          if (spans.length > 0) {
            const firstSpan = spans[0];
            expect(firstSpan).toHaveProperty("attributes");
            if (firstSpan.attributes) {
              expect(Array.isArray(firstSpan.attributes)).toBe(true);

              let originalAttributeCount = 0;
              jaegerTraceJson.result.resourceSpans?.forEach(
                (resourceSpan: any) => {
                  resourceSpan.scopeSpans?.forEach((scopeSpan: any) => {
                    scopeSpan.spans?.forEach((span: any) => {
                      if (span.attributes) {
                        originalAttributeCount += span.attributes.length;
                      }
                    });
                  });
                },
              );

              let transformedAttributeCount = 0;
              result.batches.forEach((batch: any) => {
                batch.scopeSpans?.forEach((scopeSpan: any) => {
                  scopeSpan.spans?.forEach((span: any) => {
                    if (span.attributes) {
                      transformedAttributeCount += span.attributes.length;
                    }
                  });
                });
              });

              expect(transformedAttributeCount).toBeGreaterThan(0);

              const attributeKeys = firstSpan.attributes.map(
                (attr: any) => attr.key,
              );
              const hasImportantAttributes = attributeKeys.some(
                (key: string) =>
                  key.startsWith("llm.") ||
                  key.startsWith("input.") ||
                  key.startsWith("output.") ||
                  key === "service.name" ||
                  key === "openinference.span.kind",
              );
              expect(hasImportantAttributes || attributeKeys.length === 0).toBe(
                true,
              );
            }
          }
        }
      }

      expect(mockHttpService.get).toHaveBeenCalledWith(
        expect.stringContaining(`/api/v3/traces/${traceId}`),
        expect.objectContaining({
          headers: expect.objectContaining({
            "Content-Type": "application/json",
            Accept: "application/json",
          }),
        }),
      );
    });

    it("should handle time range parameters", async () => {
      mockHttpService.get.mockReturnValue(
        of({
          data: jaegerTraceJson,
        }),
      );

      const timeRange = {
        start: "2024-01-01T00:00:00Z",
        end: "2024-01-02T00:00:00Z",
      };

      await repository.searchByTraceId(mockDatasource, traceId, timeRange);

      expect(mockHttpService.get).toHaveBeenCalled();
    });

    it("should throw error for 404 trace not found", async () => {
      const error = {
        response: {
          status: 404,
          statusText: "Not Found",
          data: {
            error: {
              message: "Trace not found",
            },
          },
        },
      };
      mockHttpService.get.mockReturnValue(throwError(() => error));

      const promise = repository.searchByTraceId(mockDatasource, traceId);
      await expect(promise).rejects.toThrow(`TRACE_NOT_FOUND:${traceId}`);
    });

    it("should throw error if datasource URL is missing", async () => {
      const datasourceWithoutUrl = {
        ...mockDatasource,
        url: null,
      } as unknown as Datasource;

      const promise = repository.searchByTraceId(datasourceWithoutUrl, traceId);
      await expect(promise).rejects.toThrow("Jaeger URL is required");
    });

    it("should handle error response from Jaeger API", async () => {
      mockHttpService.get.mockReturnValue(
        of({
          data: {
            error: {
              message: "Trace not found",
            },
          },
        }),
      );

      const promise = repository.searchByTraceId(mockDatasource, traceId);
      await expect(promise).rejects.toThrow(InternalServerErrorException);
      await expect(promise).rejects.toThrow(
        formatError(
          ERROR_MESSAGES.JAEGER_API_ERROR,
          "unknown",
          "Trace not found",
        ),
      );
    });

    it("should handle request error (no response)", async () => {
      const error = {
        request: {},
        message: "Network error",
      };
      mockHttpService.get.mockReturnValue(throwError(() => error));

      const promise = repository.searchByTraceId(mockDatasource, traceId);
      await expect(promise).rejects.toThrow(InternalServerErrorException);
      await expect(promise).rejects.toThrow(
        formatError(
          ERROR_MESSAGES.JAEGER_CONNECTION_ERROR,
          baseUrl,
          "Network error",
        ),
      );
    });

    it("should handle string response data in error", async () => {
      const error = {
        response: {
          status: 500,
          statusText: "Internal Server Error",
          data: "Server error string",
        },
      };
      mockHttpService.get.mockReturnValue(throwError(() => error));

      const promise = repository.searchByTraceId(mockDatasource, traceId);
      await expect(promise).rejects.toThrow(InternalServerErrorException);
      await expect(promise).rejects.toThrow(
        formatError(
          ERROR_MESSAGES.JAEGER_API_ERROR,
          500,
          "Server error string",
        ),
      );
    });

    it("should throw NotFoundException when trace does not match project filter", async () => {
      const projectTraceFilter = {
        attributeName: "project.id",
        attributeValue: "project-123",
      };

      const mockTrace = {
        traceID: traceId,
        batches: [
          {
            resource: {
              attributes: [{ key: "project.id", value: "project-456" }],
            },
            scopeSpans: [{ spans: [{ attributes: [] }] }],
          },
        ],
      };

      mockHttpService.get.mockReturnValue(
        of({
          data: jaegerTraceJson,
        }),
      );
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
      expect(mockTraceFilterUtil.filterFullTrace).toHaveBeenCalledWith(
        expect.any(Object),
        projectTraceFilter,
      );
    });

    it("should return trace when it matches project filter", async () => {
      const projectTraceFilter = {
        attributeName: "project.id",
        attributeValue: "project-123",
      };

      mockHttpService.get.mockReturnValue(
        of({
          data: jaegerTraceJson,
        }),
      );
      mockTraceFilterUtil.filterFullTrace.mockReturnValue(true);

      const result = await repository.searchByTraceId(
        mockDatasource,
        traceId,
        undefined,
        projectTraceFilter,
      );

      expect(result).toHaveProperty("traceID");
      expect(result).toHaveProperty("batches");
      expect(mockTraceFilterUtil.filterFullTrace).toHaveBeenCalledWith(
        expect.any(Object),
        projectTraceFilter,
      );
    });

    it("should not filter when project filter is not provided", async () => {
      mockHttpService.get.mockReturnValue(
        of({
          data: jaegerTraceJson,
        }),
      );

      const result = await repository.searchByTraceId(mockDatasource, traceId);

      expect(mockTraceFilterUtil.filterFullTrace).not.toHaveBeenCalled();
      expect(result).toHaveProperty("traceID");
    });

    it("should check resource attributes for project filter match", async () => {
      const projectTraceFilter = {
        attributeName: "project.id",
        attributeValue: "project-123",
      };

      const mockTraceWithResourceAttr = {
        traceID: traceId,
        batches: [
          {
            resource: {
              attributes: [{ key: "project.id", value: "project-123" }],
            },
            scopeSpans: [{ spans: [] }],
          },
        ],
      };

      mockHttpService.get.mockReturnValue(
        of({
          data: jaegerTraceJson,
        }),
      );
      mockTraceFilterUtil.filterFullTrace.mockReturnValue(true);

      await repository.searchByTraceId(
        mockDatasource,
        traceId,
        undefined,
        projectTraceFilter,
      );

      expect(mockTraceFilterUtil.filterFullTrace).toHaveBeenCalled();
    });

    it("should check span attributes for project filter match when resource attributes do not match", async () => {
      const projectTraceFilter = {
        attributeName: "project.id",
        attributeValue: "project-123",
      };

      const mockTraceWithSpanAttr = {
        traceID: traceId,
        batches: [
          {
            resource: { attributes: [{ key: "service.name", value: "api" }] },
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

      mockHttpService.get.mockReturnValue(
        of({
          data: jaegerTraceJson,
        }),
      );
      mockTraceFilterUtil.filterFullTrace.mockReturnValue(true);

      await repository.searchByTraceId(
        mockDatasource,
        traceId,
        undefined,
        projectTraceFilter,
      );

      expect(mockTraceFilterUtil.filterFullTrace).toHaveBeenCalled();
    });
  });

  describe("getAttributeNames", () => {
    it("should throw BadRequestException", async () => {
      const promise = repository.getAttributeNames(mockDatasource);
      await expect(promise).rejects.toThrow(BadRequestException);
      await expect(promise).rejects.toThrow(
        formatError(
          ERROR_MESSAGES.GET_ATTRIBUTE_NAMES_NOT_SUPPORTED,
          DatasourceSource.JAEGER,
        ),
      );
    });
  });

  describe("getAttributeValues", () => {
    it("should throw BadRequestException", async () => {
      const attributeName = "service.name";
      const promise = repository.getAttributeValues(
        mockDatasource,
        attributeName,
      );
      await expect(promise).rejects.toThrow(BadRequestException);
      await expect(promise).rejects.toThrow(
        formatError(
          ERROR_MESSAGES.GET_ATTRIBUTE_VALUES_NOT_SUPPORTED,
          DatasourceSource.JAEGER,
        ),
      );
    });
  });
});
