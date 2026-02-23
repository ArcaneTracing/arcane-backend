import { Test, TestingModule } from "@nestjs/testing";
import { HttpService } from "@nestjs/axios";
import { of, throwError } from "rxjs";
import { DatasourceConnectivityService } from "./datasource-connectivity.service";
import { DatasourceAuthService } from "./datasource-auth.service";
import { DatasourceConfigEncryptionService } from "./datasource-config-encryption.service";
import { Datasource, DatasourceSource } from "../entities/datasource.entity";
import { CustomApiConfigMapper } from "../../traces/backends/custom-api/custom-api.config.mapper";
import { CustomApiRequestBuilder } from "../../traces/backends/custom-api/custom-api.request.builder";

describe("DatasourceConnectivityService", () => {
  let service: DatasourceConnectivityService;
  let httpService: jest.Mocked<HttpService>;
  let authService: jest.Mocked<DatasourceAuthService>;
  let configEncryptionService: jest.Mocked<DatasourceConfigEncryptionService>;

  beforeEach(async () => {
    jest
      .spyOn(CustomApiConfigMapper, "map")
      .mockImplementation((datasource) => {
        const config = datasource.config?.customApi || {};
        return {
          baseUrl: config.baseUrl || datasource.url || "",
          endpoints: {
            search: { path: config.endpoints?.search?.path || "/search" },
            searchByTraceId: {
              path: config.endpoints?.searchByTraceId?.path || "",
            },
          },
          capabilities: config.capabilities || {},
          authentication: config.authentication,
          headers: config.headers || {},
        };
      });

    jest
      .spyOn(CustomApiRequestBuilder, "buildSearchParams")
      .mockImplementation((searchParams, config) => {
        const params: Record<string, string | number> = {};
        if (searchParams.start) {
          params.start = Math.round(
            new Date(searchParams.start).getTime() / 1000,
          );
        }
        if (searchParams.end) {
          params.end = Math.round(new Date(searchParams.end).getTime() / 1000);
        }
        if (searchParams.limit !== undefined) {
          params.limit = searchParams.limit;
        }
        return params;
      });

    jest
      .spyOn(CustomApiRequestBuilder, "buildUrl")
      .mockImplementation((baseUrl, path) => {
        const normalizedBaseUrl = baseUrl.replace(/\/$/, "");
        const normalizedPath = path.startsWith("/") ? path : `/${path}`;
        return `${normalizedBaseUrl}${normalizedPath}`;
      });

    jest
      .spyOn(CustomApiRequestBuilder, "buildHeaders")
      .mockImplementation((config) => {
        const headers: Record<string, string> = {
          "Content-Type": "application/json",
          ...config.headers,
        };
        return headers;
      });

    const mockHttpService = {
      get: jest.fn(),
    };

    const mockAuthService = {
      buildAuthHeaders: jest.fn(),
    };

    const mockConfigEncryptionService = {
      decryptConfig: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DatasourceConnectivityService,
        {
          provide: HttpService,
          useValue: mockHttpService,
        },
        {
          provide: DatasourceAuthService,
          useValue: mockAuthService,
        },
        {
          provide: DatasourceConfigEncryptionService,
          useValue: mockConfigEncryptionService,
        },
      ],
    }).compile();

    service = module.get<DatasourceConnectivityService>(
      DatasourceConnectivityService,
    );
    httpService = module.get(HttpService);
    authService = module.get(DatasourceAuthService);
    configEncryptionService = module.get(DatasourceConfigEncryptionService);
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  describe("testConnection", () => {
    const createMockDatasource = (
      overrides: Partial<Datasource> = {},
    ): Datasource =>
      ({
        id: "ds-1",
        name: "Test Datasource",
        description: "Test",
        url: "http://example.com",
        source: DatasourceSource.TEMPO,
        type: "trace",
        config: {},
        organisationId: "org-1",
        createdAt: new Date(),
        updatedAt: new Date(),
        ...overrides,
      }) as Datasource;

    it("should test Tempo connection successfully", async () => {
      const datasource = createMockDatasource({
        source: DatasourceSource.TEMPO,
      });
      configEncryptionService.decryptConfig.mockReturnValue({});
      authService.buildAuthHeaders.mockReturnValue({});
      httpService.get.mockReturnValue(of({ data: {} }));

      const result = await service.testConnection(datasource);

      expect(result.success).toBe(true);
      expect(result.message).toBe("Connection successful");
      expect(httpService.get).toHaveBeenCalledWith(
        "http://example.com/api/search",
        expect.objectContaining({
          headers: expect.objectContaining({
            "Content-Type": "application/json",
          }),
          timeout: 5000,
        }),
      );
    });

    it("should test Jaeger connection successfully", async () => {
      const datasource = createMockDatasource({
        source: DatasourceSource.JAEGER,
      });
      configEncryptionService.decryptConfig.mockReturnValue({});
      authService.buildAuthHeaders.mockReturnValue({});
      httpService.get.mockReturnValue(of({ data: {} }));

      const result = await service.testConnection(datasource);

      expect(result.success).toBe(true);
      expect(result.message).toBe("Connection successful");
      expect(httpService.get).toHaveBeenCalledWith(
        "http://example.com/api/v3/services",
        expect.objectContaining({
          headers: expect.objectContaining({
            "Content-Type": "application/json",
          }),
          timeout: 5000,
        }),
      );
    });

    it("should test Custom API connection with start and end params", async () => {
      const datasource = createMockDatasource({
        source: DatasourceSource.CUSTOM_API,
        url: "",
        config: {
          customApi: {
            baseUrl: "http://custom-api.com",
            endpoints: {
              search: { path: "/api/traces/search" },
            },
          },
        },
      });

      const decryptedConfig = {
        customApi: {
          baseUrl: "http://custom-api.com",
          endpoints: {
            search: { path: "/api/traces/search" },
          },
        },
      };

      configEncryptionService.decryptConfig.mockReturnValue(decryptedConfig);
      authService.buildAuthHeaders.mockReturnValue({});
      httpService.get.mockReturnValue(of({ data: {} }));

      const result = await service.testConnection(datasource);

      expect(result.success).toBe(true);
      expect(result.message).toBe("Connection successful");

      const callArgs = httpService.get.mock.calls[0];
      expect(callArgs[0]).toBe("http://custom-api.com/api/traces/search");
      expect(callArgs[1]).toMatchObject({
        headers: expect.objectContaining({
          "Content-Type": "application/json",
        }),
        params: expect.objectContaining({
          start: expect.any(Number),
          end: expect.any(Number),
          limit: 1,
        }),
        timeout: 5000,
      });

      const params = callArgs[1].params;
      const now = Math.floor(Date.now() / 1000);
      const expectedStart = Math.floor(
        (Date.now() - 24 * 60 * 60 * 1000) / 1000,
      );

      expect(params.end).toBeGreaterThanOrEqual(expectedStart);
      expect(params.end).toBeLessThanOrEqual(now + 1);
      expect(params.start).toBeLessThanOrEqual(params.end);
      expect(params.end - params.start).toBeGreaterThanOrEqual(86300);
      expect(params.end - params.start).toBeLessThanOrEqual(86400 + 1);
    });

    it("should return error when Custom API baseUrl is missing", async () => {
      const datasource = createMockDatasource({
        source: DatasourceSource.CUSTOM_API,
        url: "",
        config: {
          customApi: {},
        },
      });

      configEncryptionService.decryptConfig.mockReturnValue({
        customApi: {},
      });

      jest.spyOn(CustomApiConfigMapper, "map").mockReturnValue({
        baseUrl: "",
        endpoints: {
          search: { path: "/search" },
          searchByTraceId: { path: "" },
        },
        capabilities: {},
        authentication: undefined,
        headers: {},
      });

      const result = await service.testConnection(datasource);

      expect(result.success).toBe(false);
      expect(result.message).toBe("Custom API baseUrl not configured");
      expect(httpService.get).not.toHaveBeenCalled();
    });

    it("should handle authentication errors", async () => {
      const datasource = createMockDatasource({
        source: DatasourceSource.TEMPO,
      });
      configEncryptionService.decryptConfig.mockReturnValue({});
      authService.buildAuthHeaders.mockReturnValue({});
      httpService.get.mockReturnValue(
        throwError(() => ({
          response: { status: 401 },
        })),
      );

      const result = await service.testConnection(datasource);

      expect(result.success).toBe(false);
      expect(result.message).toBe("Authentication failed");
    });

    it("should handle connection refused errors", async () => {
      const datasource = createMockDatasource({
        source: DatasourceSource.TEMPO,
      });
      configEncryptionService.decryptConfig.mockReturnValue({});
      authService.buildAuthHeaders.mockReturnValue({});
      httpService.get.mockReturnValue(
        throwError(() => ({
          code: "ECONNREFUSED",
        })),
      );

      const result = await service.testConnection(datasource);

      expect(result.success).toBe(false);
      expect(result.message).toBe("Unable to connect to datasource URL");
    });

    it("should handle 404 errors", async () => {
      const datasource = createMockDatasource({
        source: DatasourceSource.TEMPO,
      });
      configEncryptionService.decryptConfig.mockReturnValue({});
      authService.buildAuthHeaders.mockReturnValue({});
      httpService.get.mockReturnValue(
        throwError(() => ({
          response: { status: 404 },
        })),
      );

      const result = await service.testConnection(datasource);

      expect(result.success).toBe(false);
      expect(result.message).toBe(
        "Endpoint not found - check URL and path configuration",
      );
    });

    it("should return error for unsupported datasource type", async () => {
      const datasource = createMockDatasource({
        source: "UNSUPPORTED" as DatasourceSource,
      });
      configEncryptionService.decryptConfig.mockReturnValue({});

      const result = await service.testConnection(datasource);

      expect(result.success).toBe(false);
      expect(result.message).toBe("Unsupported datasource type");
      expect(httpService.get).not.toHaveBeenCalled();
    });
  });
});
