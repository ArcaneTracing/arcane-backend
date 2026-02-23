import { Test, TestingModule } from "@nestjs/testing";
import { HttpService } from "@nestjs/axios";
import {
  InternalServerErrorException,
  NotFoundException,
} from "@nestjs/common";
import { of, throwError } from "rxjs";
import { TempoTraceRepository } from "../../../../src/traces/backends/tempo/tempo.trace.repository";
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

const tempoTraceJson = require("../../resources/tempo/trace.json");
const tempoTraceListJson = require("../../resources/tempo/trace-list.json");
const tempoTagsJson = require("../../resources/tempo/tags.json");
const tempoTagValuesJson = require("../../resources/tempo/tag-values.json");

global.fetch = jest.fn();

describe("TempoTraceRepository", () => {
  let repository: TempoTraceRepository;
  let httpService: HttpService;

  const mockHttpService = {
    get: jest.fn(),
  };

  const mockTraceFilterUtil = {
    filterFullTrace: jest.fn(),
  };

  const mockDatasourceAuthService = {
    buildAuthHeaders: jest.fn().mockReturnValue({}),
  };

  const mockDatasource: Datasource = {
    id: "datasource-1",
    name: "Tempo Datasource",
    url: "https://tempo.example.com",
    type: "traces" as any,
    source: DatasourceSource.TEMPO,
    organisationId: "org-1",
    createdAt: new Date(),
    updatedAt: new Date(),
    createdById: "user-1",
    projectId: "project-1",
  } as unknown as Datasource;

  let module: TestingModule;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      providers: [
        TempoTraceRepository,
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

    repository = module.get<TempoTraceRepository>(TempoTraceRepository);
    httpService = module.get<HttpService>(HttpService);
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
    (global.fetch as jest.Mock).mockClear();

    mockTraceFilterUtil.filterFullTrace.mockReturnValue(true);
  });

  describe("search", () => {
    const searchParams: SearchTracesRequestDto = {
      limit: 10,
      q: 'service.name="test"',
      start: "2024-01-01T00:00:00Z",
      end: "2024-01-02T00:00:00Z",
    };

    it("should return Tempo response as-is without transformation", async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue(tempoTraceListJson),
      });

      const result = await repository.search(mockDatasource, searchParams);

      expect(result).toHaveProperty("traces");
      expect(Array.isArray(result.traces)).toBe(true);

      expect(result.traces).toEqual(tempoTraceListJson.traces);

      if (result.traces.length > 0) {
        const firstTrace = result.traces[0];
        expect(firstTrace).toHaveProperty("traceID");
        expect(firstTrace).toHaveProperty("rootServiceName");
        expect(firstTrace).toHaveProperty("rootTraceName");
        expect(typeof firstTrace.traceID).toBe("string");
      }

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/search"),
        expect.objectContaining({
          method: "GET",
          headers: expect.objectContaining({
            "Content-Type": "application/json",
          }),
        }),
      );
    });

    it("should handle empty Tempo response", async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({ traces: [] }),
      });

      const result = await repository.search(mockDatasource, searchParams);

      expect(result).toHaveProperty("traces");
      expect(result.traces).toEqual([]);
    });

    it("should throw error for non-OK response", async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 500,
        statusText: "Internal Server Error",
        text: jest.fn().mockResolvedValue("Server error"),
      });

      const promise = repository.search(mockDatasource, searchParams);
      await expect(promise).rejects.toThrow(InternalServerErrorException);
      await expect(promise).rejects.toThrow(
        formatError(ERROR_MESSAGES.TEMPO_SERVICE_ERROR, 500),
      );
    });

    it("should throw error if datasource URL is missing", async () => {
      const datasourceWithoutUrl = {
        ...mockDatasource,
        url: null,
      } as unknown as Datasource;

      const promise = repository.search(datasourceWithoutUrl, searchParams);
      await expect(promise).rejects.toThrow(InternalServerErrorException);
      await expect(promise).rejects.toThrow(
        formatError(ERROR_MESSAGES.TRACE_SEARCH_FAILED),
      );
    });

    it("should build correct query parameters", async () => {
      const searchParamsWithAllFields: SearchTracesRequestDto = {
        limit: 20,
        q: 'service.name="test"',
        start: "2024-01-01T00:00:00Z",
        end: "2024-01-02T00:00:00Z",
        minDuration: 1000000000,
        maxDuration: 10000000000,
        attributes: "key=value",
        serviceName: "test-service",
        operationName: "test-operation",
      };

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue(tempoTraceListJson),
      });

      await repository.search(mockDatasource, searchParamsWithAllFields);

      expect(global.fetch).toHaveBeenCalled();
      const fetchCall = (global.fetch as jest.Mock).mock.calls[0][0];
      expect(fetchCall).toContain("/api/search");
      expect(fetchCall).toContain("limit=20");
    });

    it("should merge project filter into TraceQL q when both provided (Tempo rejects tags+q)", async () => {
      const paramsWithQ: SearchTracesRequestDto = {
        limit: 10000,
        q: '{ span."session.id" != nil && span."session.id" != "" }',
        start: "2024-01-01T00:00:00Z",
        end: "2024-01-02T00:00:00Z",
      };
      const projectTraceFilter = {
        attributeName: "project.id",
        attributeValue: "123",
      };

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({ traces: [] }),
      });

      await repository.search(mockDatasource, paramsWithQ, projectTraceFilter);

      expect(global.fetch).toHaveBeenCalled();
      const fetchUrl = (global.fetch as jest.Mock).mock.calls[0][0];

      expect(fetchUrl).not.toMatch(/[?&]tags=/);

      expect(fetchUrl).toContain("q=");
      expect(fetchUrl).toContain("session.id");
      expect(fetchUrl).toContain("project.id");
      expect(fetchUrl).toContain("123");
    });
  });

  describe("searchByTraceId", () => {
    const traceId = "fa6471d32539061bd70f55719bf53bc";

    it("should return Tempo trace response as-is without transformation", async () => {
      mockHttpService.get.mockReturnValue(
        of({
          data: tempoTraceJson,
        }),
      );

      const result = await repository.searchByTraceId(mockDatasource, traceId);

      expect(result).toHaveProperty("batches");
      expect(Array.isArray(result.batches)).toBe(true);

      expect(result.batches).toEqual(tempoTraceJson.batches);

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
        expect.stringContaining(`/api/traces/${traceId}`),
        expect.objectContaining({
          headers: expect.objectContaining({
            "Content-Type": "application/json",
          }),
        }),
      );
    });

    it("should handle time range parameters", async () => {
      mockHttpService.get.mockReturnValue(
        of({
          data: tempoTraceJson,
        }),
      );

      const timeRange = {
        start: "2024-01-01T00:00:00Z",
        end: "2024-01-02T00:00:00Z",
      };

      await repository.searchByTraceId(mockDatasource, traceId, timeRange);

      expect(mockHttpService.get).toHaveBeenCalled();
      const getCall = mockHttpService.get.mock.calls[0][0];
      expect(getCall).toContain(`/api/traces/${traceId}`);
      expect(getCall).toContain("start=");
      expect(getCall).toContain("end=");
    });

    it("should throw structured error for 404 trace not found", async () => {
      const error = {
        response: {
          status: 404,
          statusText: "Not Found",
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
      await expect(promise).rejects.toThrow("Tempo URL is required");
    });

    it("should throw structured error for 5xx service errors", async () => {
      const error = {
        response: {
          status: 500,
          statusText: "Internal Server Error",
        },
      };
      mockHttpService.get.mockReturnValue(throwError(() => error));

      const promise = repository.searchByTraceId(mockDatasource, traceId);
      await expect(promise).rejects.toThrow(InternalServerErrorException);
      await expect(promise).rejects.toThrow(
        formatError(ERROR_MESSAGES.TEMPO_SERVICE_ERROR, 500),
      );
    });

    it("should throw structured error for 401 authentication errors", async () => {
      const error = {
        response: {
          status: 401,
          statusText: "Unauthorized",
        },
      };
      mockHttpService.get.mockReturnValue(throwError(() => error));

      const promise = repository.searchByTraceId(mockDatasource, traceId);
      await expect(promise).rejects.toThrow(InternalServerErrorException);
      await expect(promise).rejects.toThrow(
        formatError(ERROR_MESSAGES.TEMPO_SERVICE_ERROR, 401),
      );
    });

    it("should throw structured error for 403 forbidden errors", async () => {
      const error = {
        response: {
          status: 403,
          statusText: "Forbidden",
        },
      };
      mockHttpService.get.mockReturnValue(throwError(() => error));

      const promise = repository.searchByTraceId(mockDatasource, traceId);
      await expect(promise).rejects.toThrow(InternalServerErrorException);
      await expect(promise).rejects.toThrow(
        formatError(ERROR_MESSAGES.TEMPO_SERVICE_ERROR, 403),
      );
    });

    it("should throw structured error for 4xx API errors", async () => {
      const error = {
        response: {
          status: 400,
          statusText: "Bad Request",
        },
      };
      mockHttpService.get.mockReturnValue(throwError(() => error));

      const promise = repository.searchByTraceId(mockDatasource, traceId);
      await expect(promise).rejects.toThrow(InternalServerErrorException);
      await expect(promise).rejects.toThrow(
        formatError(ERROR_MESSAGES.TEMPO_SERVICE_ERROR, 400),
      );
    });

    it("should throw structured error for connection refused", async () => {
      const error = {
        request: {},
        code: "ECONNREFUSED",
        message: "Connection refused",
      };
      mockHttpService.get.mockReturnValue(throwError(() => error));

      const promise = repository.searchByTraceId(mockDatasource, traceId);
      await expect(promise).rejects.toThrow(InternalServerErrorException);
      await expect(promise).rejects.toThrow(
        formatError(ERROR_MESSAGES.TEMPO_CONNECTION_ERROR, mockDatasource.url),
      );
    });

    it("should throw structured error for host not found", async () => {
      const error = {
        request: {},
        code: "ENOTFOUND",
        message: "getaddrinfo ENOTFOUND tempo.example.com",
      };
      mockHttpService.get.mockReturnValue(throwError(() => error));

      const promise = repository.searchByTraceId(mockDatasource, traceId);
      await expect(promise).rejects.toThrow(InternalServerErrorException);
      await expect(promise).rejects.toThrow(
        formatError(ERROR_MESSAGES.TEMPO_CONNECTION_ERROR, mockDatasource.url),
      );
    });

    it("should throw structured error for timeout", async () => {
      const error = {
        request: {},
        code: "ETIMEDOUT",
        message: "Timeout",
      };
      mockHttpService.get.mockReturnValue(throwError(() => error));

      const promise = repository.searchByTraceId(mockDatasource, traceId);
      await expect(promise).rejects.toThrow(InternalServerErrorException);
      await expect(promise).rejects.toThrow(
        formatError(ERROR_MESSAGES.TEMPO_TIMEOUT_ERROR, mockDatasource.url),
      );
    });

    it("should throw structured error for request timeout (message-based)", async () => {
      const error = {
        request: {},
        message: "timeout of 5000ms exceeded",
      };
      mockHttpService.get.mockReturnValue(throwError(() => error));

      const promise = repository.searchByTraceId(mockDatasource, traceId);
      await expect(promise).rejects.toThrow(InternalServerErrorException);
      await expect(promise).rejects.toThrow(
        formatError(ERROR_MESSAGES.TEMPO_TIMEOUT_ERROR, mockDatasource.url),
      );
    });

    it("should throw structured error for other network errors", async () => {
      const error = {
        request: {},
        code: "ECONNRESET",
        message: "Connection reset",
      };
      mockHttpService.get.mockReturnValue(throwError(() => error));

      const promise = repository.searchByTraceId(mockDatasource, traceId);
      await expect(promise).rejects.toThrow(InternalServerErrorException);
      await expect(promise).rejects.toThrow(
        formatError(ERROR_MESSAGES.TEMPO_CONNECTION_ERROR, mockDatasource.url),
      );
    });

    it("should throw NotFoundException when trace does not match project filter", async () => {
      const projectTraceFilter = {
        attributeName: "project.id",
        attributeValue: "project-123",
      };

      mockHttpService.get.mockReturnValue(
        of({
          data: tempoTraceJson,
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
          data: tempoTraceJson,
        }),
      );
      mockTraceFilterUtil.filterFullTrace.mockReturnValue(true);

      const result = await repository.searchByTraceId(
        mockDatasource,
        traceId,
        undefined,
        projectTraceFilter,
      );

      expect(result).toHaveProperty("batches");
      expect(mockTraceFilterUtil.filterFullTrace).toHaveBeenCalledWith(
        expect.any(Object),
        projectTraceFilter,
      );
    });

    it("should not filter when project filter is not provided", async () => {
      mockHttpService.get.mockReturnValue(
        of({
          data: tempoTraceJson,
        }),
      );

      const result = await repository.searchByTraceId(mockDatasource, traceId);

      expect(mockTraceFilterUtil.filterFullTrace).not.toHaveBeenCalled();
      expect(result).toHaveProperty("batches");
    });

    it("should merge project filter into search params attributes", async () => {
      const projectTraceFilter = {
        attributeName: "project.id",
        attributeValue: "project-123",
      };

      const searchParamsWithAttributes: SearchTracesRequestDto = {
        limit: 10,
        start: "2024-01-01T00:00:00Z",
        end: "2024-01-02T00:00:00Z",
        attributes: "service.name=api",
      };

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue(tempoTraceListJson),
      });

      await repository.search(
        mockDatasource,
        searchParamsWithAttributes,
        projectTraceFilter,
      );

      const fetchCall = (global.fetch as jest.Mock).mock.calls[0][0];
      expect(fetchCall).toContain("project.id=project-123");
      expect(fetchCall).toContain("service.name=api");
    });
  });

  describe("getAttributeNames", () => {
    it("should return tags from Tempo API", async () => {
      const mockTags = tempoTagsJson.tagNames || [];

      mockHttpService.get.mockReturnValue(
        of({
          data: tempoTagsJson,
        }),
      );

      const result = await repository.getAttributeNames(mockDatasource);

      expect(Array.isArray(result)).toBe(true);
      expect(result).toEqual(mockTags);
      expect(mockHttpService.get).toHaveBeenCalledWith(
        expect.stringContaining("/api/search/tags"),
        expect.objectContaining({
          headers: expect.objectContaining({
            "Content-Type": "application/json",
          }),
        }),
      );
    });

    it("should throw structured error for API errors", async () => {
      const error = {
        response: {
          status: 500,
          statusText: "Internal Server Error",
        },
      };
      mockHttpService.get.mockReturnValue(throwError(() => error));

      const promise = repository.getAttributeNames(mockDatasource);
      await expect(promise).rejects.toThrow(InternalServerErrorException);
      await expect(promise).rejects.toThrow(
        formatError(ERROR_MESSAGES.TEMPO_SERVICE_ERROR, 500),
      );
    });

    it("should throw structured error for connection errors", async () => {
      const error = {
        request: {},
        code: "ECONNREFUSED",
        message: "Connection refused",
      };
      mockHttpService.get.mockReturnValue(throwError(() => error));

      const promise = repository.getAttributeNames(mockDatasource);
      await expect(promise).rejects.toThrow(InternalServerErrorException);
      await expect(promise).rejects.toThrow(
        formatError(ERROR_MESSAGES.TEMPO_CONNECTION_ERROR, mockDatasource.url),
      );
    });
  });

  describe("getAttributeValues", () => {
    const tagName = "service.name";

    it("should return tag values from Tempo API", async () => {
      const mockValues = tempoTagValuesJson.tagValues || [];

      mockHttpService.get.mockReturnValue(
        of({
          data: tempoTagValuesJson,
        }),
      );

      const result = await repository.getAttributeValues(
        mockDatasource,
        tagName,
      );

      expect(Array.isArray(result)).toBe(true);
      expect(result).toEqual(mockValues);
      expect(mockHttpService.get).toHaveBeenCalledWith(
        expect.stringContaining(
          `/api/search/tag/${encodeURIComponent(tagName)}/values`,
        ),
        expect.objectContaining({
          headers: expect.objectContaining({
            "Content-Type": "application/json",
          }),
        }),
      );
    });

    it("should URL encode tag name", async () => {
      const specialTagName = "service.name with spaces";
      mockHttpService.get.mockReturnValue(
        of({
          data: { tagValues: [], metrics: {} },
        }),
      );

      await repository.getAttributeValues(mockDatasource, specialTagName);

      expect(mockHttpService.get).toHaveBeenCalledWith(
        expect.stringContaining(
          `/api/search/tag/${encodeURIComponent(specialTagName)}/values`,
        ),
        expect.anything(),
      );
    });

    it("should throw structured error for API errors", async () => {
      const error = {
        response: {
          status: 500,
          statusText: "Internal Server Error",
        },
      };
      mockHttpService.get.mockReturnValue(throwError(() => error));

      const promise = repository.getAttributeValues(mockDatasource, tagName);
      await expect(promise).rejects.toThrow(InternalServerErrorException);
      await expect(promise).rejects.toThrow(
        formatError(ERROR_MESSAGES.TEMPO_SERVICE_ERROR, 500),
      );
    });

    it("should throw structured error for connection errors", async () => {
      const error = {
        request: {},
        code: "ECONNREFUSED",
        message: "Connection refused",
      };
      mockHttpService.get.mockReturnValue(throwError(() => error));

      const promise = repository.getAttributeValues(mockDatasource, tagName);
      await expect(promise).rejects.toThrow(InternalServerErrorException);
      await expect(promise).rejects.toThrow(
        formatError(ERROR_MESSAGES.TEMPO_CONNECTION_ERROR, mockDatasource.url),
      );
    });
  });
});
