import { DatasourceMapper } from "./datasource.mapper";
import { DatasourceConfigEncryptionService } from "../services/datasource-config-encryption.service";
import { Datasource, DatasourceSource } from "../entities/datasource.entity";

function createMockDatasource(overrides: Partial<Datasource> = {}): Datasource {
  return {
    id: "ds-1",
    name: "Test Datasource",
    description: "Test Description",
    url: "http://example.com",
    source: DatasourceSource.TEMPO,
    type: "trace",
    config: {},
    organisationId: "org-1",
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as Datasource;
}

describe("DatasourceMapper", () => {
  let mockEncryptionService: jest.Mocked<DatasourceConfigEncryptionService>;

  beforeEach(() => {
    mockEncryptionService = {
      decryptConfig: jest.fn(),
      encryptConfig: jest.fn(),
      maskConfigForResponse: jest.fn(),
    } as any;

    DatasourceMapper.setConfigEncryptionService(mockEncryptionService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("toResponseDto", () => {
    it("should decrypt config instead of masking it", () => {
      const encryptedConfig = {
        authentication: {
          type: "basic",
          username: "user",
          password: "encrypted:password123",
        },
      };

      const decryptedConfig = {
        authentication: {
          type: "basic",
          username: "user",
          password: "password123",
        },
      };

      const datasource = createMockDatasource({
        source: DatasourceSource.TEMPO,
        config: encryptedConfig,
      });

      mockEncryptionService.decryptConfig.mockReturnValue(decryptedConfig);

      const result = DatasourceMapper.toResponseDto(datasource);

      expect(mockEncryptionService.decryptConfig).toHaveBeenCalledWith(
        DatasourceSource.TEMPO,
        encryptedConfig,
      );
      expect(
        mockEncryptionService.maskConfigForResponse,
      ).not.toHaveBeenCalled();
      expect(result.config).toEqual(decryptedConfig);
      expect(result.config.authentication.password).toBe("password123");
    });

    it("should return datasource without config when config is null", () => {
      const datasource = createMockDatasource({ config: null });

      const result = DatasourceMapper.toResponseDto(datasource);

      expect(mockEncryptionService.decryptConfig).not.toHaveBeenCalled();
      expect(result.config).toBeNull();
    });

    it("should return datasource without config when config is undefined", () => {
      const datasource = createMockDatasource({ config: undefined });

      const result = DatasourceMapper.toResponseDto(datasource);

      expect(mockEncryptionService.decryptConfig).not.toHaveBeenCalled();
      expect(result.config).toBeUndefined();
    });

    it("should decrypt ClickHouse password", () => {
      const encryptedConfig = {
        clickhouse: {
          host: "localhost",
          password: "encrypted:clickhouse123",
        },
      };

      const decryptedConfig = {
        clickhouse: {
          host: "localhost",
          password: "clickhouse123",
        },
      };

      const datasource = createMockDatasource({
        source: DatasourceSource.CLICKHOUSE,
        config: encryptedConfig,
      });

      mockEncryptionService.decryptConfig.mockReturnValue(decryptedConfig);

      const result = DatasourceMapper.toResponseDto(datasource);

      expect(result.config.clickhouse.password).toBe("clickhouse123");
    });

    it("should decrypt Custom API bearer token", () => {
      const encryptedConfig = {
        customApi: {
          baseUrl: "http://api.com",
          authentication: {
            type: "bearer",
            value: "encrypted:token123",
          },
        },
      };

      const decryptedConfig = {
        customApi: {
          baseUrl: "http://api.com",
          authentication: {
            type: "bearer",
            value: "token123",
          },
        },
      };

      const datasource = createMockDatasource({
        source: DatasourceSource.CUSTOM_API,
        config: encryptedConfig,
      });

      mockEncryptionService.decryptConfig.mockReturnValue(decryptedConfig);

      const result = DatasourceMapper.toResponseDto(datasource);

      expect(result.config.customApi.authentication.value).toBe("token123");
    });

    it("should include all datasource fields in response", () => {
      const datasource = createMockDatasource({
        id: "ds-123",
        name: "My Datasource",
        description: "My Description",
        url: "http://test.com",
        source: DatasourceSource.JAEGER,
        type: "trace",
      });

      mockEncryptionService.decryptConfig.mockReturnValue({});

      const result = DatasourceMapper.toResponseDto(datasource);

      expect(result.id).toBe("ds-123");
      expect(result.name).toBe("My Datasource");
      expect(result.description).toBe("My Description");
      expect(result.url).toBe("http://test.com");
      expect(result.source).toBe(DatasourceSource.JAEGER);
      expect(result.type).toBe("trace");
    });

    it("should set capabilities for Custom API datasource", () => {
      const datasource = createMockDatasource({
        source: DatasourceSource.CUSTOM_API,
        config: {
          customApi: {
            capabilities: {
              searchByQuery: true,
              searchByAttributes: true,
              getAttributeNames: true,
              getAttributeValues: true,
            },
          },
        },
      });

      mockEncryptionService.decryptConfig.mockReturnValue(datasource.config);

      const result = DatasourceMapper.toResponseDto(datasource);

      expect(result.isSearchByQueryEnabled).toBe(true);
      expect(result.isSearchByAttributesEnabled).toBe(true);
      expect(result.isGetAttributeNamesEnabled).toBe(true);
      expect(result.isGetAttributeValuesEnabled).toBe(true);
    });

    it("should set capabilities for Tempo datasource", () => {
      const datasource = createMockDatasource({
        source: DatasourceSource.TEMPO,
      });

      mockEncryptionService.decryptConfig.mockReturnValue({});

      const result = DatasourceMapper.toResponseDto(datasource);

      expect(result.isSearchByQueryEnabled).toBe(true);
      expect(result.isSearchByAttributesEnabled).toBe(true);
      expect(result.isGetAttributeNamesEnabled).toBe(true);
      expect(result.isGetAttributeValuesEnabled).toBe(true);
    });

    it("should set capabilities for ClickHouse datasource", () => {
      const datasource = createMockDatasource({
        source: DatasourceSource.CLICKHOUSE,
      });

      mockEncryptionService.decryptConfig.mockReturnValue({});

      const result = DatasourceMapper.toResponseDto(datasource);

      expect(result.isSearchByQueryEnabled).toBe(true);
      expect(result.isSearchByAttributesEnabled).toBe(true);
      expect(result.isGetAttributeNamesEnabled).toBe(true);
      expect(result.isGetAttributeValuesEnabled).toBe(true);
    });
  });

  describe("toListItemDto", () => {
    it("should not include config in list item", () => {
      const datasource = createMockDatasource({
        config: { some: "config" },
      });

      const result = DatasourceMapper.toListItemDto(datasource);

      expect(result).not.toHaveProperty("config");
      expect(mockEncryptionService.decryptConfig).not.toHaveBeenCalled();
    });

    it("should include all basic fields", () => {
      const datasource = createMockDatasource({
        id: "ds-123",
        name: "My Datasource",
        description: "My Description",
        source: DatasourceSource.JAEGER,
        type: "trace",
      });

      const result = DatasourceMapper.toListItemDto(datasource);

      expect(result.id).toBe("ds-123");
      expect(result.name).toBe("My Datasource");
      expect(result.description).toBe("My Description");
      expect(result.source).toBe(DatasourceSource.JAEGER);
      expect(result.type).toBe("trace");
    });
  });
});
