import { InternalServerErrorException } from "@nestjs/common";
import { CustomApiConfigMapper } from "../../../../src/traces/backends/custom-api/custom-api.config.mapper";
import {
  Datasource,
  DatasourceSource,
} from "../../../../src/datasources/entities/datasource.entity";
import {
  ERROR_MESSAGES,
  formatError,
} from "../../../../src/common/constants/error-messages.constants";
import { CustomApiAuthenticationType } from "../../../../src/datasources/dto/custom-api-config.dto";

describe("CustomApiConfigMapper", () => {
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

  describe("map", () => {
    it("should map valid datasource config correctly", () => {
      const config = CustomApiConfigMapper.map(mockDatasource);

      expect(config.baseUrl).toBe("https://custom-api.example.com");
      expect(config.endpoints.search.path).toBe("/api/search");
      expect(config.endpoints.searchByTraceId.path).toBe(
        "/api/traces/{traceId}",
      );
      expect(config.capabilities.searchByQuery).toBe(true);
      expect(config.capabilities.searchByAttributes).toBe(false);
      expect(config.headers).toEqual({});
    });

    it("should throw InternalServerErrorException when config is null", () => {
      const datasourceWithoutConfig = {
        ...mockDatasource,
        config: null,
      } as unknown as Datasource;

      expect(() => CustomApiConfigMapper.map(datasourceWithoutConfig)).toThrow(
        InternalServerErrorException,
      );
      expect(() => CustomApiConfigMapper.map(datasourceWithoutConfig)).toThrow(
        formatError(ERROR_MESSAGES.TRACE_QUERY_FAILED),
      );
    });

    it("should throw InternalServerErrorException when customApi is missing", () => {
      const datasourceWithoutCustomApi = {
        ...mockDatasource,
        config: {},
      } as unknown as Datasource;

      expect(() =>
        CustomApiConfigMapper.map(datasourceWithoutCustomApi),
      ).toThrow(InternalServerErrorException);
      expect(() =>
        CustomApiConfigMapper.map(datasourceWithoutCustomApi),
      ).toThrow(formatError(ERROR_MESSAGES.TRACE_QUERY_FAILED));
    });

    it("should use baseUrl from config when provided", () => {
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

      const config = CustomApiConfigMapper.map(datasourceWithConfigBaseUrl);
      expect(config.baseUrl).toBe("https://config.example.com");
    });

    it("should fallback to url field when baseUrl is not in config", () => {
      const datasourceWithUrlFallback = {
        ...mockDatasource,
        url: "https://url-fallback.example.com",
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

      const config = CustomApiConfigMapper.map(datasourceWithUrlFallback);
      expect(config.baseUrl).toBe("https://url-fallback.example.com");
    });

    it("should use empty string when both baseUrl and url are missing", () => {
      const datasourceWithoutUrl = {
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

      const config = CustomApiConfigMapper.map(datasourceWithoutUrl);
      expect(config.baseUrl).toBe("");
    });

    it("should remove trailing slash from baseUrl", () => {
      const datasourceWithTrailingSlash = {
        ...mockDatasource,
        config: {
          customApi: {
            baseUrl: "https://custom-api.example.com/",
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

      const config = CustomApiConfigMapper.map(datasourceWithTrailingSlash);
      expect(config.baseUrl).toBe("https://custom-api.example.com");
    });

    it("should use empty string for missing endpoint paths", () => {
      const datasourceWithMissingPaths = {
        ...mockDatasource,
        config: {
          customApi: {
            baseUrl: "https://custom-api.example.com",
            endpoints: {},
          },
        },
      } as unknown as Datasource;

      const config = CustomApiConfigMapper.map(datasourceWithMissingPaths);
      expect(config.endpoints.search.path).toBe("");
      expect(config.endpoints.searchByTraceId.path).toBe("");
    });

    it("should include optional attributeNames endpoint when provided", () => {
      const datasourceWithAttributeNames = {
        ...mockDatasource,
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
              attributeNames: {
                path: "/api/attributes",
              },
            },
          },
        },
      } as unknown as Datasource;

      const config = CustomApiConfigMapper.map(datasourceWithAttributeNames);
      expect(config.endpoints.attributeNames?.path).toBe("/api/attributes");
    });

    it("should include optional attributeValues endpoint when provided", () => {
      const datasourceWithAttributeValues = {
        ...mockDatasource,
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
              attributeValues: {
                path: "/api/attributes/{attributeName}/values",
              },
            },
          },
        },
      } as unknown as Datasource;

      const config = CustomApiConfigMapper.map(datasourceWithAttributeValues);
      expect(config.endpoints.attributeValues?.path).toBe(
        "/api/attributes/{attributeName}/values",
      );
    });

    it("should default searchByQuery capability to true when not specified", () => {
      const datasourceWithoutCapabilities = {
        ...mockDatasource,
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

      const config = CustomApiConfigMapper.map(datasourceWithoutCapabilities);
      expect(config.capabilities.searchByQuery).toBe(true);
    });

    it("should set searchByQuery to false when explicitly set to false", () => {
      const datasourceWithDisabledQuery = {
        ...mockDatasource,
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
            capabilities: {
              searchByQuery: false,
            },
          },
        },
      } as unknown as Datasource;

      const config = CustomApiConfigMapper.map(datasourceWithDisabledQuery);
      expect(config.capabilities.searchByQuery).toBe(false);
    });

    it("should map all capability flags correctly", () => {
      const datasourceWithAllCapabilities = {
        ...mockDatasource,
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
            capabilities: {
              searchByQuery: true,
              searchByAttributes: true,
              filterByAttributeExists: true,
              getAttributeNames: true,
              getAttributeValues: true,
            },
          },
        },
      } as unknown as Datasource;

      const config = CustomApiConfigMapper.map(datasourceWithAllCapabilities);
      expect(config.capabilities.searchByQuery).toBe(true);
      expect(config.capabilities.searchByAttributes).toBe(true);
      expect(config.capabilities.filterByAttributeExists).toBe(true);
      expect(config.capabilities.getAttributeNames).toBe(true);
      expect(config.capabilities.getAttributeValues).toBe(true);
    });

    it("should default capability flags to false when not explicitly set to true", () => {
      const datasourceWithPartialCapabilities = {
        ...mockDatasource,
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
            capabilities: {
              searchByQuery: true,
            },
          },
        },
      } as unknown as Datasource;

      const config = CustomApiConfigMapper.map(
        datasourceWithPartialCapabilities,
      );
      expect(config.capabilities.searchByQuery).toBe(true);
      expect(config.capabilities.searchByAttributes).toBe(false);
      expect(config.capabilities.filterByAttributeExists).toBe(false);
      expect(config.capabilities.getAttributeNames).toBe(false);
      expect(config.capabilities.getAttributeValues).toBe(false);
    });

    it("should include authentication config when provided", () => {
      const datasourceWithAuth = {
        ...mockDatasource,
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
            authentication: {
              type: CustomApiAuthenticationType.BEARER,
              value: "token123",
            },
          },
        },
      } as unknown as Datasource;

      const config = CustomApiConfigMapper.map(datasourceWithAuth);
      expect(config.authentication).toEqual({
        type: CustomApiAuthenticationType.BEARER,
        value: "token123",
      });
    });

    it("should default headers to empty object when not provided", () => {
      const datasourceWithoutHeaders = {
        ...mockDatasource,
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

      const config = CustomApiConfigMapper.map(datasourceWithoutHeaders);
      expect(config.headers).toEqual({});
    });

    it("should include custom headers when provided", () => {
      const datasourceWithHeaders = {
        ...mockDatasource,
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
            headers: {
              "X-Custom-Header": "value1",
              "X-Another-Header": "value2",
            },
          },
        },
      } as unknown as Datasource;

      const config = CustomApiConfigMapper.map(datasourceWithHeaders);
      expect(config.headers).toEqual({
        "X-Custom-Header": "value1",
        "X-Another-Header": "value2",
      });
    });
  });
});
