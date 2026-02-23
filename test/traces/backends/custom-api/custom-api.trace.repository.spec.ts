import { Test, TestingModule } from "@nestjs/testing";
import { HttpService } from "@nestjs/axios";
import {
  BadRequestException,
  InternalServerErrorException,
  NotFoundException,
} from "@nestjs/common";
import { of, throwError } from "rxjs";
import { CustomApiTraceRepository } from "../../../../src/traces/backends/custom-api/custom-api.trace.repository";
import { TraceFilterUtil } from "../../../../src/traces/backends/common/trace-filter.util";
import { DatasourceConfigEncryptionService } from "../../../../src/datasources/services/datasource-config-encryption.service";
import {
  Datasource,
  DatasourceSource,
} from "../../../../src/datasources/entities/datasource.entity";
import { SearchTracesRequestDto } from "../../../../src/traces/dto/request/search-traces-request.dto";
import {
  ERROR_MESSAGES,
  formatError,
} from "../../../../src/common/constants/error-messages.constants";
import { CustomApiAuthenticationType } from "../../../../src/datasources/dto/custom-api-config.dto";
import { TimeRangeDto } from "../../../../src/traces/dto/time-range.dto";

describe("CustomApiTraceRepository", () => {
  let repository: CustomApiTraceRepository;
  let httpService: HttpService;

  const mockHttpService = {
    get: jest.fn(),
  };

  const mockDatasource: Datasource = {
    id: "datasource-1",
    name: "Custom API Datasource",
    url: "https://custom-api.example.com",
    type: "traces" as any,
    source: DatasourceSource.CUSTOM_API,
    organisationId: "org-1",
    createdAt: new Date(),
    updatedAt: new Date(),
    createdById: "user-1",
    projectId: "project-1",
    config: {
      customApi: {
        baseUrl: "https://custom-api.example.com",
        endpoints: {
          search: {
            path: "/api/search",
          },
          searchByTraceId: {
            path: "/api/traces/{traceId}",
          },
        },
      },
    },
  } as unknown as Datasource;

  let module: TestingModule;

  const mockTraceFilterUtil = {
    filterTraceSummaries: jest.fn(),
    filterFullTrace: jest.fn(),
  };

  const mockDatasourceConfigEncryptionService = {
    decryptConfig: jest.fn((_source: unknown, config: unknown) => config ?? {}),
  };

  beforeAll(async () => {
    module = await Test.createTestingModule({
      providers: [
        CustomApiTraceRepository,
        {
          provide: HttpService,
          useValue: mockHttpService,
        },
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

    repository = module.get<CustomApiTraceRepository>(CustomApiTraceRepository);
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
    jest.resetAllMocks();

    mockTraceFilterUtil.filterTraceSummaries.mockImplementation(
      (traces) => traces,
    );
    mockTraceFilterUtil.filterFullTrace.mockReturnValue(true);
    mockDatasourceConfigEncryptionService.decryptConfig.mockImplementation(
      (_source: unknown, config: unknown) => config ?? {},
    );
  });

  describe("search", () => {
    const searchParams: SearchTracesRequestDto = {
      start: "2024-01-01T00:00:00Z",
      end: "2024-01-02T00:00:00Z",
      limit: 10,
    };

    it("should search traces with GET method", async () => {
      const mockResponse = {
        data: {
          traces: [
            {
              traceID: "trace-1",
              rootServiceName: "service-1",
              rootTraceName: "operation-1",
            },
          ],
        },
      };
      mockHttpService.get.mockReturnValue(of(mockResponse));

      const result = await repository.search(mockDatasource, searchParams);

      expect(result).toEqual(mockResponse.data);
      expect(mockHttpService.get).toHaveBeenCalled();
      expect(mockHttpService.get).toHaveBeenCalledWith(
        expect.stringContaining("/api/search"),
        expect.objectContaining({
          headers: expect.any(Object),
          params: expect.objectContaining({
            start: expect.any(Number),
            end: expect.any(Number),
            limit: 10,
          }),
        }),
      );
    });

    it("should return raw OTLP response", async () => {
      const mockResponse = {
        data: {
          customFormat: "anything",
          traces: [{ traceID: "trace-1" }],
        },
      };
      mockHttpService.get.mockReturnValue(of(mockResponse));

      const result = await repository.search(mockDatasource, searchParams);

      expect(result).toEqual(mockResponse.data);
    });

    it("should wrap array response", async () => {
      const mockResponse = {
        data: [
          {
            traceID: "trace-1",
            rootServiceName: "service-1",
          },
        ],
      };
      mockHttpService.get.mockReturnValue(of(mockResponse));

      const result = await repository.search(mockDatasource, searchParams);

      expect(result).toEqual({ traces: mockResponse.data });
    });

    it("should throw error for invalid response format", async () => {
      const mockResponse = {
        data: "not an object",
      };
      mockHttpService.get.mockReturnValue(of(mockResponse));

      const promise = repository.search(mockDatasource, searchParams);
      await expect(promise).rejects.toThrow(
        "Invalid response format: expected { traces: [...] } or traces array",
      );
    });

    it("should throw error when response has no traces array", async () => {
      const mockResponse = {
        data: {
          otherField: "value",
        },
      };
      mockHttpService.get.mockReturnValue(of(mockResponse));

      const promise = repository.search(mockDatasource, searchParams);
      await expect(promise).rejects.toThrow(
        "Invalid response format: expected { traces: [...] } or traces array",
      );
    });

    it("should handle 404 as empty result", async () => {
      const error = {
        response: {
          status: 404,
          statusText: "Not Found",
        },
      };
      mockHttpService.get.mockReturnValue(throwError(() => error));

      const result = await repository.search(mockDatasource, searchParams);

      expect(result).toEqual({ traces: [] });
    });

    it("should throw InternalServerErrorException for other HTTP errors", async () => {
      const error = {
        response: {
          status: 500,
          statusText: "Internal Server Error",
        },
      };
      mockHttpService.get.mockReturnValue(throwError(() => error));

      const promise = repository.search(mockDatasource, searchParams);
      await expect(promise).rejects.toThrow(InternalServerErrorException);
      await expect(promise).rejects.toThrow(
        formatError(ERROR_MESSAGES.TRACE_SEARCH_FAILED),
      );
    });

    it("should throw InternalServerErrorException when config is missing", async () => {
      const datasourceWithoutConfig = {
        ...mockDatasource,
        config: null,
      } as unknown as Datasource;

      const promise = repository.search(datasourceWithoutConfig, searchParams);
      await expect(promise).rejects.toThrow(InternalServerErrorException);
      await expect(promise).rejects.toThrow(
        formatError(ERROR_MESSAGES.TRACE_QUERY_FAILED),
      );
    });

    it("should throw InternalServerErrorException when baseUrl is missing", async () => {
      const datasourceWithoutBaseUrl = {
        ...mockDatasource,
        url: null,
        config: {
          customApi: {
            endpoints: {
              search: {
                path: "/api/search",
              },
              searchByTraceId: {
                path: "/api/traces/{traceId}",
              },
            },
          },
        },
      } as unknown as Datasource;

      const promise = repository.search(datasourceWithoutBaseUrl, searchParams);
      await expect(promise).rejects.toThrow(InternalServerErrorException);
      await expect(promise).rejects.toThrow(
        formatError(ERROR_MESSAGES.TRACE_SEARCH_FAILED),
      );
    });

    it("should throw InternalServerErrorException when search path is missing", async () => {
      const datasourceWithoutSearchPath = {
        ...mockDatasource,
        config: {
          customApi: {
            baseUrl: "https://custom-api.example.com",
            endpoints: {
              searchByTraceId: {
                path: "/api/traces/{traceId}",
              },
            },
          },
        },
      } as unknown as Datasource;

      const promise = repository.search(
        datasourceWithoutSearchPath,
        searchParams,
      );
      await expect(promise).rejects.toThrow(InternalServerErrorException);
      await expect(promise).rejects.toThrow(
        formatError(ERROR_MESSAGES.TRACE_SEARCH_FAILED),
      );
    });

    it("should throw InternalServerErrorException when searchByTraceId path is missing", async () => {
      const datasourceWithoutSearchByTraceIdPath = {
        ...mockDatasource,
        config: {
          customApi: {
            baseUrl: "https://custom-api.example.com",
            endpoints: {
              search: {
                path: "/api/search",
              },
            },
          },
        },
      } as unknown as Datasource;

      const promise = repository.search(
        datasourceWithoutSearchByTraceIdPath,
        searchParams,
      );
      await expect(promise).rejects.toThrow(InternalServerErrorException);
      await expect(promise).rejects.toThrow(
        formatError(ERROR_MESSAGES.TRACE_SEARCH_FAILED),
      );
    });

    it("should throw InternalServerErrorException when searchByTraceId path does not contain {traceId} placeholder", async () => {
      const datasourceWithoutPlaceholder = {
        ...mockDatasource,
        config: {
          customApi: {
            baseUrl: "https://custom-api.example.com",
            endpoints: {
              search: {
                path: "/api/search",
              },
              searchByTraceId: {
                path: "/api/traces",
              },
            },
          },
        },
      } as unknown as Datasource;

      const promise = repository.search(
        datasourceWithoutPlaceholder,
        searchParams,
      );
      await expect(promise).rejects.toThrow(InternalServerErrorException);
      await expect(promise).rejects.toThrow(
        formatError(ERROR_MESSAGES.TRACE_SEARCH_FAILED),
      );
    });

    it("should use baseUrl from config over url field", async () => {
      const datasourceWithConfigBaseUrl = {
        ...mockDatasource,
        url: "https://fallback.example.com",
        config: {
          customApi: {
            baseUrl: "https://config.example.com",
            endpoints: {
              search: {
                path: "/api/search",
              },
              searchByTraceId: {
                path: "/api/traces/{traceId}",
              },
            },
          },
        },
      } as unknown as Datasource;

      const mockResponse = {
        data: {
          traces: [],
        },
      };
      mockHttpService.get.mockReturnValue(of(mockResponse));

      await repository.search(datasourceWithConfigBaseUrl, searchParams);

      expect(mockHttpService.get).toHaveBeenCalledWith(
        expect.stringContaining("https://config.example.com"),
        expect.anything(),
      );
    });

    it("should handle path without leading slash", async () => {
      const datasourceWithPathNoSlash = {
        ...mockDatasource,
        config: {
          customApi: {
            baseUrl: "https://custom-api.example.com",
            endpoints: {
              search: {
                path: "api/search",
              },
              searchByTraceId: {
                path: "/api/traces/{traceId}",
              },
            },
          },
        },
      } as unknown as Datasource;

      const mockResponse = {
        data: {
          traces: [],
        },
      };
      mockHttpService.get.mockReturnValue(of(mockResponse));

      await repository.search(datasourceWithPathNoSlash, searchParams);

      expect(mockHttpService.get).toHaveBeenCalledWith(
        expect.stringContaining("/api/search"),
        expect.anything(),
      );
    });

    it("should throw BadRequestException when attributes are provided but capability disabled", async () => {
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
          DatasourceSource.CUSTOM_API,
        ),
      );
    });

    it("should include attributes when capability enabled", async () => {
      const datasourceWithAttributes = {
        ...mockDatasource,
        config: {
          customApi: {
            ...mockDatasource.config.customApi,
            capabilities: {
              searchByAttributes: true,
            },
          },
        },
      } as unknown as Datasource;

      const searchParamsWithAttributes: SearchTracesRequestDto = {
        ...searchParams,
        attributes: "key=value",
      };

      const mockResponse = {
        data: {
          traces: [],
        },
      };
      mockHttpService.get.mockReturnValue(of(mockResponse));

      await repository.search(
        datasourceWithAttributes,
        searchParamsWithAttributes,
      );

      expect(mockHttpService.get).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          params: expect.objectContaining({
            attributes: "key=value",
          }),
        }),
      );
    });

    it("should throw BadRequestException when q is provided but capability disabled", async () => {
      const datasourceWithoutQuery = {
        ...mockDatasource,
        config: {
          customApi: {
            ...mockDatasource.config.customApi,
            capabilities: {
              searchByQuery: false,
            },
          },
        },
      } as unknown as Datasource;

      const searchParamsWithQuery: SearchTracesRequestDto = {
        ...searchParams,
        q: 'service.name="test"',
      };

      const promise = repository.search(
        datasourceWithoutQuery,
        searchParamsWithQuery,
      );
      await expect(promise).rejects.toThrow(BadRequestException);
      await expect(promise).rejects.toThrow(
        formatError(ERROR_MESSAGES.SEARCH_BY_QUERY_NOT_SUPPORTED, "custom_api"),
      );
    });

    it("should include q when capability enabled", async () => {
      const searchParamsWithQuery: SearchTracesRequestDto = {
        ...searchParams,
        q: 'service.name="test"',
      };

      const mockResponse = {
        data: {
          traces: [],
        },
      };
      mockHttpService.get.mockReturnValue(of(mockResponse));

      await repository.search(mockDatasource, searchParamsWithQuery);

      expect(mockHttpService.get).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          params: expect.objectContaining({
            q: 'service.name="test"',
          }),
        }),
      );
    });

    it("should throw BadRequestException when filterByAttributeExists is provided but capability disabled", async () => {
      const searchParamsWithFilter: SearchTracesRequestDto = {
        ...searchParams,
        filterByAttributeExists: ["session.id", "user.id"],
      };

      const promise = repository.search(mockDatasource, searchParamsWithFilter);
      await expect(promise).rejects.toThrow(BadRequestException);
      await expect(promise).rejects.toThrow(
        formatError(
          ERROR_MESSAGES.FILTER_BY_ATTRIBUTE_EXISTS_NOT_SUPPORTED,
          "custom_api",
        ),
      );
    });

    it("should include filterByAttributeExists when capability enabled", async () => {
      const datasourceWithFilter = {
        ...mockDatasource,
        config: {
          customApi: {
            ...mockDatasource.config.customApi,
            capabilities: {
              filterByAttributeExists: true,
            },
          },
        },
      } as unknown as Datasource;

      const searchParamsWithFilter: SearchTracesRequestDto = {
        ...searchParams,
        filterByAttributeExists: ["session.id", "user.id"],
      };

      const mockResponse = {
        data: {
          traces: [],
        },
      };
      mockHttpService.get.mockReturnValue(of(mockResponse));

      await repository.search(datasourceWithFilter, searchParamsWithFilter);

      expect(mockHttpService.get).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          params: expect.objectContaining({
            filterByAttributeExists: "session.id,user.id",
          }),
        }),
      );
    });

    it("should not include filterByAttributeExists when array is empty", async () => {
      const datasourceWithFilter = {
        ...mockDatasource,
        config: {
          customApi: {
            ...mockDatasource.config.customApi,
            capabilities: {
              filterByAttributeExists: true,
            },
          },
        },
      } as unknown as Datasource;

      const searchParamsWithEmptyFilter: SearchTracesRequestDto = {
        ...searchParams,
        filterByAttributeExists: [],
      };

      const mockResponse = {
        data: {
          traces: [],
        },
      };
      mockHttpService.get.mockReturnValue(of(mockResponse));

      await repository.search(
        datasourceWithFilter,
        searchParamsWithEmptyFilter,
      );

      expect(mockHttpService.get).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          params: expect.not.objectContaining({
            filterByAttributeExists: expect.anything(),
          }),
        }),
      );
    });
  });

  describe("searchByTraceId", () => {
    const traceId = "test-trace-id";

    it("should search trace by ID with GET method", async () => {
      const mockResponse = {
        data: {
          batches: [],
        },
      };
      mockHttpService.get.mockReturnValue(of(mockResponse));

      const result = await repository.searchByTraceId(mockDatasource, traceId);

      expect(result).toEqual(mockResponse.data);
      expect(mockHttpService.get).toHaveBeenCalledWith(
        expect.stringContaining(traceId),
        expect.objectContaining({
          headers: expect.any(Object),
        }),
      );
    });

    it("should include timeRange as query parameters", async () => {
      const timeRange: TimeRangeDto = {
        start: "2024-01-01T00:00:00Z",
        end: "2024-01-02T00:00:00Z",
      };

      const mockResponse = {
        data: {
          batches: [],
        },
      };
      mockHttpService.get.mockReturnValue(of(mockResponse));

      await repository.searchByTraceId(mockDatasource, traceId, timeRange);

      expect(mockHttpService.get).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          params: expect.objectContaining({
            start: "2024-01-01T00:00:00Z",
            end: "2024-01-02T00:00:00Z",
          }),
        }),
      );
    });

    it("should return raw OTLP response", async () => {
      const mockResponse = {
        data: {
          batches: [],
        },
      };
      mockHttpService.get.mockReturnValue(of(mockResponse));

      const result = await repository.searchByTraceId(mockDatasource, traceId);

      expect(result).toEqual(mockResponse.data);
    });

    it("should throw error for 404", async () => {
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

    it("should throw InternalServerErrorException for other HTTP errors", async () => {
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
        formatError(ERROR_MESSAGES.TRACE_QUERY_FAILED),
      );
    });

    it("should throw NotFoundException when trace does not match project filter", async () => {
      const projectTraceFilter = {
        attributeName: "project.id",
        attributeValue: "project-123",
      };

      const mockResponse = {
        data: {
          batches: [
            {
              resource: {
                attributes: [{ key: "project.id", value: "project-456" }],
              },
              scopeSpans: [{ spans: [] }],
            },
          ],
        },
      };
      mockHttpService.get.mockReturnValue(of(mockResponse));
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

      const mockResponse = {
        data: {
          batches: [
            {
              resource: {
                attributes: [{ key: "project.id", value: "project-123" }],
              },
              scopeSpans: [{ spans: [] }],
            },
          ],
        },
      };
      mockHttpService.get.mockReturnValue(of(mockResponse));
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
      const mockResponse = {
        data: {
          batches: [],
        },
      };
      mockHttpService.get.mockReturnValue(of(mockResponse));

      const result = await repository.searchByTraceId(mockDatasource, traceId);

      expect(mockTraceFilterUtil.filterFullTrace).not.toHaveBeenCalled();
      expect(result).toHaveProperty("batches");
    });
  });

  describe("authentication", () => {
    const searchParams: SearchTracesRequestDto = {
      start: "2024-01-01T00:00:00Z",
      end: "2024-01-02T00:00:00Z",
    };

    it("should include header authentication", async () => {
      const datasourceWithHeaderAuth = {
        ...mockDatasource,
        config: {
          customApi: {
            ...mockDatasource.config.customApi,
            authentication: {
              type: CustomApiAuthenticationType.HEADER,
              headerName: "X-API-Key",
              value: "secret-key",
            },
          },
        },
      } as unknown as Datasource;

      const mockResponse = {
        data: {
          traces: [],
        },
      };
      mockHttpService.get.mockReturnValue(of(mockResponse));

      await repository.search(datasourceWithHeaderAuth, searchParams);

      expect(mockHttpService.get).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          headers: expect.objectContaining({
            "X-API-Key": "secret-key",
          }),
        }),
      );
    });

    it("should include bearer authentication", async () => {
      const datasourceWithBearerAuth = {
        ...mockDatasource,
        config: {
          customApi: {
            ...mockDatasource.config.customApi,
            authentication: {
              type: CustomApiAuthenticationType.BEARER,
              value: "bearer-token",
            },
          },
        },
      } as unknown as Datasource;

      const mockResponse = {
        data: {
          traces: [],
        },
      };
      mockHttpService.get.mockReturnValue(of(mockResponse));

      await repository.search(datasourceWithBearerAuth, searchParams);

      expect(mockHttpService.get).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: "Bearer bearer-token",
          }),
        }),
      );
    });

    it("should include basic authentication", async () => {
      const datasourceWithBasicAuth = {
        ...mockDatasource,
        config: {
          customApi: {
            ...mockDatasource.config.customApi,
            authentication: {
              type: CustomApiAuthenticationType.BASIC,
              username: "user",
              password: "pass",
            },
          },
        },
      } as unknown as Datasource;

      const mockResponse = {
        data: {
          traces: [],
        },
      };
      mockHttpService.get.mockReturnValue(of(mockResponse));

      await repository.search(datasourceWithBasicAuth, searchParams);

      expect(mockHttpService.get).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: expect.stringContaining("Basic"),
          }),
        }),
      );
    });

    it("should include additional headers", async () => {
      const datasourceWithHeaders = {
        ...mockDatasource,
        config: {
          customApi: {
            ...mockDatasource.config.customApi,
            headers: {
              "X-Custom-Header": "custom-value",
            },
          },
        },
      } as unknown as Datasource;

      const mockResponse = {
        data: {
          traces: [],
        },
      };
      mockHttpService.get.mockReturnValue(of(mockResponse));

      await repository.search(datasourceWithHeaders, searchParams);

      expect(mockHttpService.get).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          headers: expect.objectContaining({
            "X-Custom-Header": "custom-value",
          }),
        }),
      );
    });
  });

  describe("getAttributeNames", () => {
    it("should throw BadRequestException when capability disabled", async () => {
      const promise = repository.getAttributeNames(mockDatasource);
      await expect(promise).rejects.toThrow(BadRequestException);
      await expect(promise).rejects.toThrow(
        formatError(
          ERROR_MESSAGES.GET_ATTRIBUTE_NAMES_NOT_SUPPORTED,
          DatasourceSource.CUSTOM_API,
        ),
      );
    });

    it("should throw InternalServerErrorException when endpoint path is missing", async () => {
      const datasourceWithCapability = {
        ...mockDatasource,
        config: {
          customApi: {
            ...mockDatasource.config.customApi,
            capabilities: {
              getAttributeNames: true,
            },
          },
        },
      } as unknown as Datasource;

      const promise = repository.getAttributeNames(datasourceWithCapability);
      await expect(promise).rejects.toThrow(InternalServerErrorException);
      await expect(promise).rejects.toThrow(
        formatError(ERROR_MESSAGES.TRACE_QUERY_FAILED),
      );
    });

    it("should call correct endpoint when enabled", async () => {
      const datasourceWithCapability = {
        ...mockDatasource,
        config: {
          customApi: {
            ...mockDatasource.config.customApi,
            capabilities: {
              getAttributeNames: true,
            },
            endpoints: {
              ...mockDatasource.config.customApi.endpoints,
              attributeNames: {
                path: "/api/attributes",
              },
            },
          },
        },
      } as unknown as Datasource;

      const mockResponse = {
        data: ["attr1", "attr2", "attr3"],
      };
      mockHttpService.get.mockReturnValue(of(mockResponse));

      const result = await repository.getAttributeNames(
        datasourceWithCapability,
      );

      expect(result).toEqual(["attr1", "attr2", "attr3"]);
      expect(mockHttpService.get).toHaveBeenCalledWith(
        expect.stringContaining("/api/attributes"),
        expect.anything(),
      );
    });

    it("should parse { attributeNames: [] } response format", async () => {
      const datasourceWithCapability = {
        ...mockDatasource,
        config: {
          customApi: {
            ...mockDatasource.config.customApi,
            capabilities: {
              getAttributeNames: true,
            },
            endpoints: {
              ...mockDatasource.config.customApi.endpoints,
              attributeNames: {
                path: "/api/attributes",
              },
            },
          },
        },
      } as unknown as Datasource;

      const mockResponse = {
        data: {
          attributeNames: ["attr1", "attr2"],
        },
      };
      mockHttpService.get.mockReturnValue(of(mockResponse));

      const result = await repository.getAttributeNames(
        datasourceWithCapability,
      );

      expect(result).toEqual(["attr1", "attr2"]);
    });

    it("should handle raw response format", async () => {
      const datasourceWithRaw = {
        ...mockDatasource,
        config: {
          customApi: {
            ...mockDatasource.config.customApi,
            capabilities: {
              getAttributeNames: true,
            },
            endpoints: {
              ...mockDatasource.config.customApi.endpoints,
              attributeNames: {
                path: "/api/attributes",
              },
            },
          },
        },
      } as unknown as Datasource;

      const mockResponse = {
        data: ["attr1", "attr2"],
      };
      mockHttpService.get.mockReturnValue(of(mockResponse));

      const result = await repository.getAttributeNames(datasourceWithRaw);

      expect(result).toEqual(["attr1", "attr2"]);
    });

    it("should throw InternalServerErrorException for errors", async () => {
      const datasourceWithCapability = {
        ...mockDatasource,
        config: {
          customApi: {
            ...mockDatasource.config.customApi,
            capabilities: {
              getAttributeNames: true,
            },
            endpoints: {
              ...mockDatasource.config.customApi.endpoints,
              attributeNames: {
                path: "/api/attributes",
              },
            },
          },
        },
      } as unknown as Datasource;

      const error = {
        response: {
          status: 500,
        },
      };
      mockHttpService.get.mockReturnValue(throwError(() => error));

      const promise = repository.getAttributeNames(datasourceWithCapability);
      await expect(promise).rejects.toThrow(InternalServerErrorException);
      await expect(promise).rejects.toThrow(
        formatError(ERROR_MESSAGES.TRACE_QUERY_FAILED),
      );
    });
  });

  describe("getAttributeValues", () => {
    const attributeName = "service.name";

    it("should throw BadRequestException when capability disabled", async () => {
      const promise = repository.getAttributeValues(
        mockDatasource,
        attributeName,
      );
      await expect(promise).rejects.toThrow(BadRequestException);
      await expect(promise).rejects.toThrow(
        formatError(
          ERROR_MESSAGES.GET_ATTRIBUTE_VALUES_NOT_SUPPORTED,
          DatasourceSource.CUSTOM_API,
        ),
      );
    });

    it("should throw InternalServerErrorException when endpoint path is missing", async () => {
      const datasourceWithCapability = {
        ...mockDatasource,
        config: {
          customApi: {
            ...mockDatasource.config.customApi,
            capabilities: {
              getAttributeValues: true,
            },
          },
        },
      } as unknown as Datasource;

      const promise = repository.getAttributeValues(
        datasourceWithCapability,
        attributeName,
      );
      await expect(promise).rejects.toThrow(InternalServerErrorException);
      await expect(promise).rejects.toThrow(
        formatError(ERROR_MESSAGES.TRACE_QUERY_FAILED),
      );
    });

    it("should throw InternalServerErrorException when endpoint path does not contain {attributeName} placeholder", async () => {
      const datasourceWithCapability = {
        ...mockDatasource,
        config: {
          customApi: {
            ...mockDatasource.config.customApi,
            capabilities: {
              getAttributeValues: true,
            },
            endpoints: {
              ...mockDatasource.config.customApi.endpoints,
              attributeValues: {
                path: "/api/values",
              },
            },
          },
        },
      } as unknown as Datasource;

      const promise = repository.getAttributeValues(
        datasourceWithCapability,
        attributeName,
      );
      await expect(promise).rejects.toThrow(InternalServerErrorException);
      await expect(promise).rejects.toThrow(
        formatError(ERROR_MESSAGES.TRACE_QUERY_FAILED),
      );
    });

    it("should replace {attributeName} placeholder correctly", async () => {
      const datasourceWithCapability = {
        ...mockDatasource,
        config: {
          customApi: {
            ...mockDatasource.config.customApi,
            capabilities: {
              getAttributeValues: true,
            },
            endpoints: {
              ...mockDatasource.config.customApi.endpoints,
              attributeValues: {
                path: "/api/attributes/{attributeName}/values",
              },
            },
          },
        },
      } as unknown as Datasource;

      const mockResponse = {
        data: ["value1", "value2"],
      };
      mockHttpService.get.mockReturnValue(of(mockResponse));

      await repository.getAttributeValues(
        datasourceWithCapability,
        attributeName,
      );

      expect(mockHttpService.get).toHaveBeenCalledWith(
        expect.stringContaining("/api/attributes/service.name/values"),
        expect.anything(),
      );
    });

    it("should parse array response correctly", async () => {
      const datasourceWithCapability = {
        ...mockDatasource,
        config: {
          customApi: {
            ...mockDatasource.config.customApi,
            capabilities: {
              getAttributeValues: true,
            },
            endpoints: {
              ...mockDatasource.config.customApi.endpoints,
              attributeValues: {
                path: "/api/attributes/{attributeName}/values",
              },
            },
          },
        },
      } as unknown as Datasource;

      const mockResponse = {
        data: ["value1", "value2", "value3"],
      };
      mockHttpService.get.mockReturnValue(of(mockResponse));

      const result = await repository.getAttributeValues(
        datasourceWithCapability,
        attributeName,
      );

      expect(result).toEqual(["value1", "value2", "value3"]);
    });

    it("should parse { values: [] } response format", async () => {
      const datasourceWithCapability = {
        ...mockDatasource,
        config: {
          customApi: {
            ...mockDatasource.config.customApi,
            capabilities: {
              getAttributeValues: true,
            },
            endpoints: {
              ...mockDatasource.config.customApi.endpoints,
              attributeValues: {
                path: "/api/attributes/{attributeName}/values",
              },
            },
          },
        },
      } as unknown as Datasource;

      const mockResponse = {
        data: {
          values: ["value1", "value2"],
        },
      };
      mockHttpService.get.mockReturnValue(of(mockResponse));

      const result = await repository.getAttributeValues(
        datasourceWithCapability,
        attributeName,
      );

      expect(result).toEqual(["value1", "value2"]);
    });

    it("should handle raw response format", async () => {
      const datasourceWithRaw = {
        ...mockDatasource,
        config: {
          customApi: {
            ...mockDatasource.config.customApi,
            capabilities: {
              getAttributeValues: true,
            },
            endpoints: {
              ...mockDatasource.config.customApi.endpoints,
              attributeValues: {
                path: "/api/attributes/{attributeName}/values",
              },
            },
          },
        },
      } as unknown as Datasource;

      const mockResponse = {
        data: ["value1", "value2"],
      };
      mockHttpService.get.mockReturnValue(of(mockResponse));

      const result = await repository.getAttributeValues(
        datasourceWithRaw,
        attributeName,
      );

      expect(result).toEqual(["value1", "value2"]);
    });

    it("should throw InternalServerErrorException for errors", async () => {
      const datasourceWithCapability = {
        ...mockDatasource,
        config: {
          customApi: {
            ...mockDatasource.config.customApi,
            capabilities: {
              getAttributeValues: true,
            },
            endpoints: {
              ...mockDatasource.config.customApi.endpoints,
              attributeValues: {
                path: "/api/attributes/{attributeName}/values",
              },
            },
          },
        },
      } as unknown as Datasource;

      const error = {
        response: {
          status: 500,
        },
      };
      mockHttpService.get.mockReturnValue(throwError(() => error));

      const promise = repository.getAttributeValues(
        datasourceWithCapability,
        attributeName,
      );
      await expect(promise).rejects.toThrow(InternalServerErrorException);
      await expect(promise).rejects.toThrow(
        formatError(ERROR_MESSAGES.TRACE_QUERY_FAILED),
      );
    });
  });
});
