import { DatasourceMapper } from "../../../src/datasources/mappers/datasource.mapper";
import {
  Datasource,
  DatasourceSource,
  DatasourceType,
} from "../../../src/datasources/entities/datasource.entity";

describe("DatasourceMapper", () => {
  describe("toListItemDto", () => {
    it("should map datasource to list item dto without url/config", () => {
      const datasource: Datasource = {
        id: "datasource-1",
        name: "Test Datasource",
        description: "Test Description",
        url: "https://example.com",
        type: DatasourceType.TRACES,
        source: DatasourceSource.TEMPO,
        config: { any: "value" } as any,
        createdById: "user-1",
        organisationId: "org-1",
        organisation: null as any,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = DatasourceMapper.toListItemDto(datasource);

      expect(result).toEqual(
        expect.objectContaining({
          id: "datasource-1",
          name: "Test Datasource",
          description: "Test Description",
          type: DatasourceType.TRACES,
          source: DatasourceSource.TEMPO,
          isSearchByQueryEnabled: true,
          isSearchByAttributesEnabled: true,
          isGetAttributeNamesEnabled: true,
          isGetAttributeValuesEnabled: true,
        }),
      );
      expect((result as any).url).toBeUndefined();
      expect((result as any).config).toBeUndefined();
    });

    it("should disable attribute capabilities for non-clickhouse/tempo sources", () => {
      const datasource: Datasource = {
        id: "datasource-1",
        name: "Test Datasource",
        description: "Test Description",
        url: "https://example.com",
        type: DatasourceType.TRACES,
        source: DatasourceSource.JAEGER,
        config: null,
        createdById: "user-1",
        organisationId: "org-1",
        organisation: null as any,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = DatasourceMapper.toListItemDto(datasource);

      expect(result.isSearchByQueryEnabled).toBe(false);
      expect(result.isSearchByAttributesEnabled).toBe(false);
      expect(result.isGetAttributeNamesEnabled).toBe(false);
      expect(result.isGetAttributeValuesEnabled).toBe(false);
    });

    it("should read capabilities from config for Custom API datasource", () => {
      const datasource: Datasource = {
        id: "datasource-1",
        name: "Custom API Datasource",
        description: "Test Description",
        url: "https://api.example.com",
        type: DatasourceType.TRACES,
        source: DatasourceSource.CUSTOM_API,
        config: {
          customApi: {
            baseUrl: "https://api.example.com",
            endpoints: {
              search: { path: "/search" },
              searchByTraceId: { path: "/trace/{traceId}" },
            },
            capabilities: {
              searchByQuery: true,
              searchByAttributes: true,
              getAttributeNames: true,
              getAttributeValues: true,
            },
          },
        },
        createdById: "user-1",
        organisationId: "org-1",
        organisation: null as any,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = DatasourceMapper.toListItemDto(datasource);

      expect(result.isSearchByQueryEnabled).toBe(true);
      expect(result.isSearchByAttributesEnabled).toBe(true);
      expect(result.isGetAttributeNamesEnabled).toBe(true);
      expect(result.isGetAttributeValuesEnabled).toBe(true);
    });

    it("should default searchByQuery to true for Custom API when not specified", () => {
      const datasource: Datasource = {
        id: "datasource-1",
        name: "Custom API Datasource",
        description: "Test Description",
        url: "https://api.example.com",
        type: DatasourceType.TRACES,
        source: DatasourceSource.CUSTOM_API,
        config: {
          customApi: {
            baseUrl: "https://api.example.com",
            endpoints: {
              search: { path: "/search" },
              searchByTraceId: { path: "/trace/{traceId}" },
            },
          },
        },
        createdById: "user-1",
        organisationId: "org-1",
        organisation: null as any,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = DatasourceMapper.toListItemDto(datasource);

      expect(result.isSearchByQueryEnabled).toBe(true);
      expect(result.isSearchByAttributesEnabled).toBe(false);
      expect(result.isGetAttributeNamesEnabled).toBe(false);
      expect(result.isGetAttributeValuesEnabled).toBe(false);
    });

    it("should respect disabled capabilities for Custom API", () => {
      const datasource: Datasource = {
        id: "datasource-1",
        name: "Custom API Datasource",
        description: "Test Description",
        url: "https://api.example.com",
        type: DatasourceType.TRACES,
        source: DatasourceSource.CUSTOM_API,
        config: {
          customApi: {
            baseUrl: "https://api.example.com",
            endpoints: {
              search: { path: "/search" },
              searchByTraceId: { path: "/trace/{traceId}" },
            },
            capabilities: {
              searchByQuery: false,
              searchByAttributes: false,
              getAttributeNames: false,
              getAttributeValues: false,
            },
          },
        },
        createdById: "user-1",
        organisationId: "org-1",
        organisation: null as any,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = DatasourceMapper.toListItemDto(datasource);

      expect(result.isSearchByQueryEnabled).toBe(false);
      expect(result.isSearchByAttributesEnabled).toBe(false);
      expect(result.isGetAttributeNamesEnabled).toBe(false);
      expect(result.isGetAttributeValuesEnabled).toBe(false);
    });
  });
});
