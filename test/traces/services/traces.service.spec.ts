import { Test, TestingModule } from "@nestjs/testing";
import {
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  BadGatewayException,
  InternalServerErrorException,
} from "@nestjs/common";
import { TracesService } from "../../../src/traces/services/traces.service";
import { DatasourcesService } from "../../../src/datasources/services/datasources.service";
import { ProjectManagementService } from "../../../src/projects/services/project-management.service";
import { TraceRepositoryFactory } from "../../../src/traces/backends/trace-repository.factory";
import { TraceAttributeObfuscationService } from "../../../src/traces/services/trace-attribute-obfuscation.service";
import { SearchTracesRequestDto } from "../../../src/traces/dto/request/search-traces-request.dto";
import {
  Datasource,
  DatasourceSource,
} from "../../../src/datasources/entities/datasource.entity";
import {
  ERROR_MESSAGES,
  formatError,
} from "../../../src/common/constants/error-messages.constants";
import { Project } from "../../../src/projects/entities/project.entity";

const tempoTraceListJson = require("../resources/tempo/trace-list.json");
const tempoTraceJson = require("../resources/tempo/trace.json");
const tempoTagsJson = require("../resources/tempo/tags.json");
const tempoTagValuesJson = require("../resources/tempo/tag-values.json");
const jaegerTraceJson = require("../resources/jaeger/trace.json");
const jaegerTraceListJson = require("../resources/jaeger/trace-list.json");
const clickhouseTraceJson = require("../resources/clickhouse/trace.json");
const clickhouseTraceListJson = require("../resources/clickhouse/trace-list.json");

describe("TracesService", () => {
  let service: TracesService;
  let datasourcesService: DatasourcesService;
  let projectManagementService: ProjectManagementService;
  let traceRepositoryFactory: TraceRepositoryFactory;

  const mockDatasourcesService = {
    findById: jest.fn(),
  };

  const mockProjectManagementService = {
    getByIdAndOrganisationOrThrow: jest.fn(),
  };

  const mockTraceRepository = {
    search: jest.fn(),
    searchByTraceId: jest.fn(),
    getAttributeNames: jest.fn(),
    getAttributeValues: jest.fn(),
  };

  const mockTraceRepositoryFactory = {
    getRepository: jest.fn(),
  };

  const mockTraceAttributeObfuscationService = {
    obfuscateSearchResponse: jest.fn((response) => Promise.resolve(response)),
    obfuscateTraceResponse: jest.fn((response) => Promise.resolve(response)),
  };

  const mockTempoTraceRepository = {
    search: jest.fn(),
    searchByTraceId: jest.fn(),
    getAttributeNames: jest.fn(),
    getAttributeValues: jest.fn(),
  };

  const mockClickHouseTraceRepository = {
    search: jest.fn(),
    searchByTraceId: jest.fn(),
    getAttributeNames: jest.fn(),
    getAttributeValues: jest.fn(),
  };

  const mockJaegerTraceRepository = {
    getAttributeNames: jest.fn(),
    getAttributeValues: jest.fn(),
  };

  const mockDatasource: Datasource = {
    id: "datasource-1",
    name: "Test Datasource",
    description: "Test Description",
    url: "https://example.com",
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
        TracesService,
        {
          provide: DatasourcesService,
          useValue: mockDatasourcesService,
        },
        {
          provide: ProjectManagementService,
          useValue: mockProjectManagementService,
        },
        {
          provide: TraceRepositoryFactory,
          useValue: mockTraceRepositoryFactory,
        },
        {
          provide: TraceAttributeObfuscationService,
          useValue: mockTraceAttributeObfuscationService,
        },
      ],
    }).compile();

    service = module.get<TracesService>(TracesService);
    datasourcesService = module.get<DatasourcesService>(DatasourcesService);
    projectManagementService = module.get<ProjectManagementService>(
      ProjectManagementService,
    );
    traceRepositoryFactory = module.get<TraceRepositoryFactory>(
      TraceRepositoryFactory,
    );
  });

  afterAll(async () => {
    await module.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockTraceRepositoryFactory.getRepository.mockReturnValue(
      mockTraceRepository,
    );

    mockProjectManagementService.getByIdAndOrganisationOrThrow.mockResolvedValue(
      {
        id: "project-1",
        traceFilterAttributeName: undefined,
        traceFilterAttributeValue: undefined,
      } as Project,
    );
  });

  describe("search", () => {
    const searchParams: SearchTracesRequestDto = {
      limit: 10,
      q: "test",
    };

    it("should search traces successfully with Tempo datasource", async () => {
      mockDatasourcesService.findById.mockResolvedValue(mockDatasource);
      mockTraceRepositoryFactory.getRepository.mockReturnValue(
        mockTraceRepository,
      );
      mockTraceRepository.search.mockResolvedValue(tempoTraceListJson);

      const result = await service.search(
        "org-1",
        "project-1",
        "datasource-1",
        "user-1",
        searchParams,
      );

      expect(result).toEqual(tempoTraceListJson);
      expect(result).toHaveProperty("traces");
      expect(Array.isArray(result.traces)).toBe(true);
      expect(mockDatasourcesService.findById).toHaveBeenCalledWith(
        "datasource-1",
      );
      expect(mockTraceRepositoryFactory.getRepository).toHaveBeenCalledWith(
        DatasourceSource.TEMPO,
      );
      expect(mockTraceRepository.search).toHaveBeenCalledWith(
        mockDatasource,
        searchParams,
        undefined,
      );
    });

    it("should search traces successfully with Jaeger datasource and preserve response format", async () => {
      const jaegerDatasource: Datasource = {
        ...mockDatasource,
        source: DatasourceSource.JAEGER,
      };
      mockDatasourcesService.findById.mockResolvedValue(jaegerDatasource);
      mockTraceRepositoryFactory.getRepository.mockReturnValue(
        mockTraceRepository,
      );
      mockTraceRepository.search.mockResolvedValue(tempoTraceListJson);

      const result = await service.search(
        "org-1",
        "project-1",
        "datasource-1",
        "user-1",
        searchParams,
      );

      expect(result).toHaveProperty("traces");
      expect(Array.isArray(result.traces)).toBe(true);
      if (result.traces.length > 0) {
        expect(result.traces[0]).toHaveProperty("traceID");
        expect(result.traces[0]).toHaveProperty("rootServiceName");
        expect(result.traces[0]).toHaveProperty("rootTraceName");

        expect(typeof result.traces[0].traceID).toBe("string");
        expect(result.traces[0].traceID.length).toBeGreaterThan(0);
      }

      expect(jaegerTraceListJson).toHaveProperty("result");
      expect(jaegerTraceListJson.result).toHaveProperty("resourceSpans");
      expect(Array.isArray(jaegerTraceListJson.result.resourceSpans)).toBe(
        true,
      );
    });

    it("should search traces successfully with ClickHouse datasource and preserve response format", async () => {
      const clickHouseDatasource: Datasource = {
        ...mockDatasource,
        source: DatasourceSource.CLICKHOUSE,
      };
      mockDatasourcesService.findById.mockResolvedValue(clickHouseDatasource);
      mockTraceRepositoryFactory.getRepository.mockReturnValue(
        mockTraceRepository,
      );

      mockTraceRepository.search.mockResolvedValue(tempoTraceListJson);

      const result = await service.search(
        "org-1",
        "project-1",
        "datasource-1",
        "user-1",
        searchParams,
      );

      expect(result).toHaveProperty("traces");
      expect(Array.isArray(result.traces)).toBe(true);

      expect(clickhouseTraceListJson).toHaveProperty("meta");
      expect(clickhouseTraceListJson).toHaveProperty("data");
      expect(Array.isArray(clickhouseTraceListJson.data)).toBe(true);
      if (clickhouseTraceListJson.data.length > 0) {
        const firstRow = clickhouseTraceListJson.data[0];
        expect(firstRow).toHaveProperty("TraceId");
        expect(firstRow).toHaveProperty("ServiceName");
        expect(firstRow).toHaveProperty("SpanName");
        expect(firstRow).toHaveProperty("Timestamp");
        expect(firstRow).toHaveProperty("Duration");

        expect(typeof firstRow.TraceId).toBe("string");
        expect(firstRow.TraceId.length).toBeGreaterThan(0);
      }

      if (result.traces.length > 0) {
        expect(result.traces[0]).toHaveProperty("traceID");
        expect(result.traces[0]).toHaveProperty("rootServiceName");
        expect(result.traces[0]).toHaveProperty("rootTraceName");
      }
    });

    it("should throw NotFoundException if datasource not found", async () => {
      mockDatasourcesService.findById.mockResolvedValue(null);

      const promise = service.search(
        "org-1",
        "project-1",
        "datasource-1",
        "user-1",
        searchParams,
      );
      await expect(promise).rejects.toThrow(NotFoundException);
      await expect(promise).rejects.toThrow(
        formatError(ERROR_MESSAGES.DATASOURCE_NOT_FOUND, "datasource-1"),
      );
    });

    it("should throw ForbiddenException if datasource does not belong to organisation", async () => {
      const datasourceFromDifferentOrg: Datasource = {
        ...mockDatasource,
        organisationId: "org-2",
      };
      mockDatasourcesService.findById.mockResolvedValue(
        datasourceFromDifferentOrg,
      );

      const promise = service.search(
        "org-1",
        "project-1",
        "datasource-1",
        "user-1",
        searchParams,
      );
      await expect(promise).rejects.toThrow(ForbiddenException);
      await expect(promise).rejects.toThrow(
        formatError(ERROR_MESSAGES.DATASOURCE_DOES_NOT_BELONG_TO_ORGANISATION),
      );
    });

    it("should throw InternalServerErrorException if repository search fails", async () => {
      mockDatasourcesService.findById.mockResolvedValue(mockDatasource);
      mockTraceRepositoryFactory.getRepository.mockReturnValue(
        mockTraceRepository,
      );
      mockTraceRepository.search.mockRejectedValue(
        new Error("Repository error"),
      );

      const promise = service.search(
        "org-1",
        "project-1",
        "datasource-1",
        "user-1",
        searchParams,
      );
      await expect(promise).rejects.toThrow(InternalServerErrorException);
      await expect(promise).rejects.toThrow(
        formatError(ERROR_MESSAGES.TRACE_SEARCH_FAILED),
      );
    });

    it("should merge project trace filter into search params when project has filter configured", async () => {
      const projectWithFilter: Project = {
        id: "project-1",
        traceFilterAttributeName: "project.id",
        traceFilterAttributeValue: "project-123",
      } as Project;
      mockProjectManagementService.getByIdAndOrganisationOrThrow.mockResolvedValue(
        projectWithFilter,
      );
      mockDatasourcesService.findById.mockResolvedValue(mockDatasource);
      mockTraceRepositoryFactory.getRepository.mockReturnValue(
        mockTraceRepository,
      );
      mockTraceRepository.search.mockResolvedValue(tempoTraceListJson);

      const result = await service.search(
        "org-1",
        "project-1",
        "datasource-1",
        "user-1",
        searchParams,
      );

      expect(
        mockProjectManagementService.getByIdAndOrganisationOrThrow,
      ).toHaveBeenCalledWith("org-1", "project-1");
      expect(mockTraceRepository.search).toHaveBeenCalledWith(
        mockDatasource,
        searchParams,
        { attributeName: "project.id", attributeValue: "project-123" },
      );
      expect(result).toEqual(tempoTraceListJson);
    });

    it("should merge project trace filter with existing attributes filter", async () => {
      const projectWithFilter: Project = {
        id: "project-1",
        traceFilterAttributeName: "project.id",
        traceFilterAttributeValue: "project-123",
      } as Project;
      mockProjectManagementService.getByIdAndOrganisationOrThrow.mockResolvedValue(
        projectWithFilter,
      );
      mockDatasourcesService.findById.mockResolvedValue(mockDatasource);
      mockTraceRepositoryFactory.getRepository.mockReturnValue(
        mockTraceRepository,
      );
      mockTraceRepository.search.mockResolvedValue(tempoTraceListJson);

      const searchParamsWithAttributes: SearchTracesRequestDto = {
        ...searchParams,
        attributes: "service.name=api",
      };

      const result = await service.search(
        "org-1",
        "project-1",
        "datasource-1",
        "user-1",
        searchParamsWithAttributes,
      );

      expect(mockTraceRepository.search).toHaveBeenCalledWith(
        mockDatasource,
        searchParamsWithAttributes,
        { attributeName: "project.id", attributeValue: "project-123" },
      );
      expect(result).toEqual(tempoTraceListJson);
    });

    it("should not merge project filter when project has no filter configured", async () => {
      const projectWithoutFilter: Project = {
        id: "project-1",
        traceFilterAttributeName: undefined,
        traceFilterAttributeValue: undefined,
      } as Project;
      mockProjectManagementService.getByIdAndOrganisationOrThrow.mockResolvedValue(
        projectWithoutFilter,
      );
      mockDatasourcesService.findById.mockResolvedValue(mockDatasource);
      mockTraceRepositoryFactory.getRepository.mockReturnValue(
        mockTraceRepository,
      );
      mockTraceRepository.search.mockResolvedValue(tempoTraceListJson);

      const result = await service.search(
        "org-1",
        "project-1",
        "datasource-1",
        "user-1",
        searchParams,
      );

      expect(mockTraceRepository.search).toHaveBeenCalledWith(
        mockDatasource,
        searchParams,
        undefined,
      );
      expect(result).toEqual(tempoTraceListJson);
    });

    it("should not build project filter when traceFilterAttributeName is empty string", async () => {
      const projectWithEmptyName: Project = {
        id: "project-1",
        traceFilterAttributeName: "",
        traceFilterAttributeValue: "project-123",
      } as Project;
      mockProjectManagementService.getByIdAndOrganisationOrThrow.mockResolvedValue(
        projectWithEmptyName,
      );
      mockDatasourcesService.findById.mockResolvedValue(mockDatasource);
      mockTraceRepositoryFactory.getRepository.mockReturnValue(
        mockTraceRepository,
      );
      mockTraceRepository.search.mockResolvedValue(tempoTraceListJson);

      const result = await service.search(
        "org-1",
        "project-1",
        "datasource-1",
        "user-1",
        searchParams,
      );

      expect(mockTraceRepository.search).toHaveBeenCalledWith(
        mockDatasource,
        searchParams,
        undefined,
      );
      expect(result).toEqual(tempoTraceListJson);
    });

    it("should not build project filter when traceFilterAttributeValue is empty string", async () => {
      const projectWithEmptyValue: Project = {
        id: "project-1",
        traceFilterAttributeName: "project.id",
        traceFilterAttributeValue: "",
      } as Project;
      mockProjectManagementService.getByIdAndOrganisationOrThrow.mockResolvedValue(
        projectWithEmptyValue,
      );
      mockDatasourcesService.findById.mockResolvedValue(mockDatasource);
      mockTraceRepositoryFactory.getRepository.mockReturnValue(
        mockTraceRepository,
      );
      mockTraceRepository.search.mockResolvedValue(tempoTraceListJson);

      const result = await service.search(
        "org-1",
        "project-1",
        "datasource-1",
        "user-1",
        searchParams,
      );

      expect(mockTraceRepository.search).toHaveBeenCalledWith(
        mockDatasource,
        searchParams,
        undefined,
      );
      expect(result).toEqual(tempoTraceListJson);
    });

    it("should not build project filter when only traceFilterAttributeName is set", async () => {
      const projectWithOnlyName: Project = {
        id: "project-1",
        traceFilterAttributeName: "project.id",
        traceFilterAttributeValue: undefined,
      } as Project;
      mockProjectManagementService.getByIdAndOrganisationOrThrow.mockResolvedValue(
        projectWithOnlyName,
      );
      mockDatasourcesService.findById.mockResolvedValue(mockDatasource);
      mockTraceRepositoryFactory.getRepository.mockReturnValue(
        mockTraceRepository,
      );
      mockTraceRepository.search.mockResolvedValue(tempoTraceListJson);

      const result = await service.search(
        "org-1",
        "project-1",
        "datasource-1",
        "user-1",
        searchParams,
      );

      expect(mockTraceRepository.search).toHaveBeenCalledWith(
        mockDatasource,
        searchParams,
        undefined,
      );
      expect(result).toEqual(tempoTraceListJson);
    });

    it("should not build project filter when only traceFilterAttributeValue is set", async () => {
      const projectWithOnlyValue: Project = {
        id: "project-1",
        traceFilterAttributeName: undefined,
        traceFilterAttributeValue: "project-123",
      } as Project;
      mockProjectManagementService.getByIdAndOrganisationOrThrow.mockResolvedValue(
        projectWithOnlyValue,
      );
      mockDatasourcesService.findById.mockResolvedValue(mockDatasource);
      mockTraceRepositoryFactory.getRepository.mockReturnValue(
        mockTraceRepository,
      );
      mockTraceRepository.search.mockResolvedValue(tempoTraceListJson);

      const result = await service.search(
        "org-1",
        "project-1",
        "datasource-1",
        "user-1",
        searchParams,
      );

      expect(mockTraceRepository.search).toHaveBeenCalledWith(
        mockDatasource,
        searchParams,
        undefined,
      );
      expect(result).toEqual(tempoTraceListJson);
    });
  });

  describe("searchByTraceId", () => {
    const traceId = "trace-123";

    it("should search trace by ID successfully with Tempo datasource and preserve attributes", async () => {
      mockDatasourcesService.findById.mockResolvedValue(mockDatasource);
      mockTraceRepositoryFactory.getRepository.mockReturnValue(
        mockTraceRepository,
      );
      mockTraceRepository.searchByTraceId.mockResolvedValue(tempoTraceJson);

      const result = await service.searchByTraceId(
        "org-1",
        "project-1",
        "datasource-1",
        "user-1",
        traceId,
      );

      expect(result).toEqual(tempoTraceJson);
      expect(result).toHaveProperty("batches");
      expect(Array.isArray(result.batches)).toBe(true);

      if (result.batches && result.batches.length > 0) {
        const firstBatch = result.batches[0];
        if (firstBatch.scopeSpans && firstBatch.scopeSpans.length > 0) {
          const firstSpan = firstBatch.scopeSpans[0].spans?.[0];
          if (firstSpan && firstSpan.attributes) {
            expect(Array.isArray(firstSpan.attributes)).toBe(true);

            const attributeKeys = firstSpan.attributes.map(
              (attr: any) => attr.key,
            );

            expect(attributeKeys.length).toBeGreaterThan(0);
          }
        }
      }

      expect(mockDatasourcesService.findById).toHaveBeenCalledWith(
        "datasource-1",
      );
      expect(mockTraceRepositoryFactory.getRepository).toHaveBeenCalledWith(
        DatasourceSource.TEMPO,
      );
      expect(mockTraceRepository.searchByTraceId).toHaveBeenCalledWith(
        mockDatasource,
        traceId,
        undefined,
        undefined,
      );
    });

    it("should search trace by ID with Jaeger datasource and preserve all attributes", async () => {
      const jaegerDatasource: Datasource = {
        ...mockDatasource,
        source: DatasourceSource.JAEGER,
      };
      mockDatasourcesService.findById.mockResolvedValue(jaegerDatasource);
      mockTraceRepositoryFactory.getRepository.mockReturnValue(
        mockTraceRepository,
      );

      mockTraceRepository.searchByTraceId.mockResolvedValue(tempoTraceJson);

      const result = await service.searchByTraceId(
        "org-1",
        "project-1",
        "datasource-1",
        "user-1",
        traceId,
      );

      expect(result).toHaveProperty("batches");
      expect(Array.isArray(result.batches)).toBe(true);

      if (result.batches && result.batches.length > 0) {
        const firstBatch = result.batches[0];
        if (firstBatch.scopeSpans && firstBatch.scopeSpans.length > 0) {
          const spans = firstBatch.scopeSpans[0].spans || [];
          if (spans.length > 0) {
            const firstSpan = spans[0];
            if (firstSpan.attributes) {
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
    });

    it("should search trace by ID with ClickHouse datasource and preserve attributes", async () => {
      const clickHouseDatasource: Datasource = {
        ...mockDatasource,
        source: DatasourceSource.CLICKHOUSE,
      };
      mockDatasourcesService.findById.mockResolvedValue(clickHouseDatasource);
      mockTraceRepositoryFactory.getRepository.mockReturnValue(
        mockTraceRepository,
      );
      mockTraceRepository.searchByTraceId.mockResolvedValue(tempoTraceJson);

      const result = await service.searchByTraceId(
        "org-1",
        "project-1",
        "datasource-1",
        "user-1",
        traceId,
      );

      expect(result).toHaveProperty("batches");
      expect(Array.isArray(result.batches)).toBe(true);

      if (result.batches && result.batches.length > 0) {
        const firstBatch = result.batches[0];
        expect(firstBatch).toHaveProperty("resource");
        expect(firstBatch).toHaveProperty("scopeSpans");
        if (firstBatch.scopeSpans && firstBatch.scopeSpans.length > 0) {
          const firstSpan = firstBatch.scopeSpans[0].spans?.[0];
          if (firstSpan) {
            expect(firstSpan).toHaveProperty("attributes");
            if (firstSpan.attributes) {
              expect(Array.isArray(firstSpan.attributes)).toBe(true);

              firstSpan.attributes.forEach((attr: any) => {
                expect(attr).toHaveProperty("key");
                expect(attr).toHaveProperty("value");
              });
            }
          }
        }
      }
    });

    it("should preserve all attributes from Jaeger trace response according to resource format", async () => {
      const jaegerDatasource: Datasource = {
        ...mockDatasource,
        source: DatasourceSource.JAEGER,
      };
      mockDatasourcesService.findById.mockResolvedValue(jaegerDatasource);
      mockTraceRepositoryFactory.getRepository.mockReturnValue(
        mockTraceRepository,
      );

      const jaegerResponse = jaegerTraceJson;

      mockTraceRepository.searchByTraceId.mockResolvedValue(tempoTraceJson);

      const result = await service.searchByTraceId(
        "org-1",
        "project-1",
        "datasource-1",
        "user-1",
        traceId,
      );

      expect(result).toHaveProperty("batches");
      expect(Array.isArray(result.batches)).toBe(true);
      const originalResourceSpans = jaegerResponse.result?.resourceSpans || [];
      let originalAttributeCount = 0;
      originalResourceSpans.forEach((resourceSpan: any) => {
        resourceSpan.scopeSpans?.forEach((scopeSpan: any) => {
          scopeSpan.spans?.forEach((span: any) => {
            if (span.attributes) {
              originalAttributeCount += span.attributes.length;
            }
          });
        });
      });

      let transformedAttributeCount = 0;
      if (result.batches && result.batches.length > 0) {
        result.batches.forEach((batch: any) => {
          batch.scopeSpans?.forEach((scopeSpan: any) => {
            scopeSpan.spans?.forEach((span: any) => {
              if (span.attributes) {
                transformedAttributeCount += span.attributes.length;
              }
            });
          });
        });
      }

      expect(transformedAttributeCount).toBeGreaterThan(0);

      const importantAttributeKeys = [
        "llm.model_name",
        "llm.provider",
        "input.mime_type",
        "input.value",
        "output.mime_type",
        "output.value",
        "openinference.span.kind",
        "service.name",
        "session.id",
      ];

      let foundImportantAttributes = false;
      if (result.batches && result.batches.length > 0) {
        result.batches.forEach((batch: any) => {
          batch.scopeSpans?.forEach((scopeSpan: any) => {
            scopeSpan.spans?.forEach((span: any) => {
              if (span.attributes && Array.isArray(span.attributes)) {
                const attributeKeys = span.attributes.map(
                  (attr: any) => attr.key,
                );
                const hasImportantAttributes = importantAttributeKeys.some(
                  (key) =>
                    attributeKeys.some((attrKey: string) =>
                      attrKey.includes(key.split(".")[0]),
                    ),
                );
                if (hasImportantAttributes) {
                  foundImportantAttributes = true;
                }
              }
            });
          });
        });
      }

      if (originalAttributeCount > 0) {
        expect(foundImportantAttributes || transformedAttributeCount > 0).toBe(
          true,
        );
      }
    });

    it("should preserve all attributes from ClickHouse trace response according to resource format", async () => {
      const clickHouseDatasource: Datasource = {
        ...mockDatasource,
        source: DatasourceSource.CLICKHOUSE,
      };
      mockDatasourcesService.findById.mockResolvedValue(clickHouseDatasource);
      mockTraceRepositoryFactory.getRepository.mockReturnValue(
        mockTraceRepository,
      );

      const clickHouseResponse = clickhouseTraceJson;

      mockTraceRepository.searchByTraceId.mockResolvedValue(tempoTraceJson);

      const result = await service.searchByTraceId(
        "org-1",
        "project-1",
        "datasource-1",
        "user-1",
        traceId,
      );

      expect(result).toHaveProperty("batches");
      expect(Array.isArray(result.batches)).toBe(true);

      if (clickHouseResponse.data && Array.isArray(clickHouseResponse.data)) {
        const clickHouseRows = clickHouseResponse.data;
        expect(clickHouseRows.length).toBeGreaterThan(0);

        clickHouseRows.forEach((row: any) => {
          expect(row).toHaveProperty("TraceId");
          expect(row).toHaveProperty("ServiceName");
          expect(row).toHaveProperty("SpanName");
          expect(row).toHaveProperty("Timestamp");
          expect(row).toHaveProperty("Duration");

          if (row.Attributes) {
            expect(typeof row.Attributes).toBe("object");

            const hasImportantAttributes =
              row.Attributes["llm.model"] !== undefined ||
              row.Attributes["input.mime_type"] !== undefined ||
              row.Attributes["service.name"] !== undefined;
            expect(
              hasImportantAttributes ||
                Object.keys(row.Attributes).length === 0,
            ).toBe(true);
          }

          if (row.ResourceAttributes) {
            expect(typeof row.ResourceAttributes).toBe("object");
            expect(row.ResourceAttributes["service.name"]).toBeDefined();
          }
        });
      }

      if (result.batches && result.batches.length > 0) {
        result.batches.forEach((batch: any) => {
          expect(batch.resource).toBeDefined();
          expect(batch.resource.attributes).toBeDefined();
          expect(Array.isArray(batch.resource.attributes)).toBe(true);

          batch.scopeSpans?.forEach((scopeSpan: any) => {
            scopeSpan.spans?.forEach((span: any) => {
              expect(span).toHaveProperty("attributes");
              if (span.attributes) {
                expect(Array.isArray(span.attributes)).toBe(true);

                span.attributes.forEach((attr: any) => {
                  expect(attr).toHaveProperty("key");
                  expect(attr).toHaveProperty("value");

                  expect(attr.value).toBeDefined();
                });
              }
            });
          });
        });
      }
    });

    it("should search trace by ID with time range", async () => {
      const timeRange = {
        start: "2024-01-01T00:00:00Z",
        end: "2024-01-02T00:00:00Z",
      };
      mockDatasourcesService.findById.mockResolvedValue(mockDatasource);
      mockTraceRepositoryFactory.getRepository.mockReturnValue(
        mockTraceRepository,
      );
      mockTraceRepository.searchByTraceId.mockResolvedValue(tempoTraceJson);

      const result = await service.searchByTraceId(
        "org-1",
        "project-1",
        "datasource-1",
        "user-1",
        traceId,
        timeRange,
      );

      expect(result).toEqual(tempoTraceJson);
      expect(mockTraceRepository.searchByTraceId).toHaveBeenCalledWith(
        mockDatasource,
        traceId,
        timeRange,
        undefined,
      );
    });

    it("should throw NotFoundException if datasource not found", async () => {
      mockDatasourcesService.findById.mockResolvedValue(null);

      const promise = service.searchByTraceId(
        "org-1",
        "project-1",
        "datasource-1",
        "user-1",
        traceId,
      );
      await expect(promise).rejects.toThrow(NotFoundException);
    });

    it("should throw ForbiddenException if datasource does not belong to organisation", async () => {
      const datasourceFromDifferentOrg: Datasource = {
        ...mockDatasource,
        organisationId: "org-2",
      };
      mockDatasourcesService.findById.mockResolvedValue(
        datasourceFromDifferentOrg,
      );

      const promise = service.searchByTraceId(
        "org-1",
        "project-1",
        "datasource-1",
        "user-1",
        traceId,
      );
      await expect(promise).rejects.toThrow(ForbiddenException);
    });

    it("should throw NotFoundException when trace is not found (404)", async () => {
      mockDatasourcesService.findById.mockResolvedValue(mockDatasource);
      mockTraceRepositoryFactory.getRepository.mockReturnValue(
        mockTraceRepository,
      );
      mockTraceRepository.searchByTraceId.mockRejectedValue(
        new Error(`TRACE_NOT_FOUND:${traceId}`),
      );

      const promise = service.searchByTraceId(
        "org-1",
        "project-1",
        "datasource-1",
        "user-1",
        traceId,
      );
      await expect(promise).rejects.toThrow(NotFoundException);
      await expect(promise).rejects.toThrow(
        `Trace with ID ${traceId} not found in datasource`,
      );
    });

    it("should throw BadGatewayException for Tempo connection errors", async () => {
      mockDatasourcesService.findById.mockResolvedValue(mockDatasource);
      mockTraceRepositoryFactory.getRepository.mockReturnValue(
        mockTraceRepository,
      );
      mockTraceRepository.searchByTraceId.mockRejectedValue(
        new Error(`TEMPO_CONNECTION_ERROR:${mockDatasource.url}:ECONNREFUSED`),
      );

      const promise = service.searchByTraceId(
        "org-1",
        "project-1",
        "datasource-1",
        "user-1",
        traceId,
      );
      await expect(promise).rejects.toThrow(BadGatewayException);
      await expect(promise).rejects.toThrow(
        `Unable to connect to Tempo at ${mockDatasource.url}. Please verify the datasource URL and ensure Tempo is running.`,
      );
    });

    it("should throw BadGatewayException for Tempo timeout errors", async () => {
      mockDatasourcesService.findById.mockResolvedValue(mockDatasource);
      mockTraceRepositoryFactory.getRepository.mockReturnValue(
        mockTraceRepository,
      );
      mockTraceRepository.searchByTraceId.mockRejectedValue(
        new Error(`TEMPO_TIMEOUT_ERROR:${mockDatasource.url}`),
      );

      const promise = service.searchByTraceId(
        "org-1",
        "project-1",
        "datasource-1",
        "user-1",
        traceId,
      );
      await expect(promise).rejects.toThrow(BadGatewayException);
      await expect(promise).rejects.toThrow("Request to Tempo timed out");
    });

    it("should throw BadGatewayException for Tempo authentication errors", async () => {
      mockDatasourcesService.findById.mockResolvedValue(mockDatasource);
      mockTraceRepositoryFactory.getRepository.mockReturnValue(
        mockTraceRepository,
      );
      mockTraceRepository.searchByTraceId.mockRejectedValue(
        new Error("TEMPO_AUTH_ERROR:401:Unauthorized"),
      );

      const promise = service.searchByTraceId(
        "org-1",
        "project-1",
        "datasource-1",
        "user-1",
        traceId,
      );
      await expect(promise).rejects.toThrow(BadGatewayException);
      await expect(promise).rejects.toThrow(
        "Authentication failed when connecting to Tempo",
      );
    });

    it("should throw BadGatewayException for Tempo service errors (5xx)", async () => {
      mockDatasourcesService.findById.mockResolvedValue(mockDatasource);
      mockTraceRepositoryFactory.getRepository.mockReturnValue(
        mockTraceRepository,
      );
      mockTraceRepository.searchByTraceId.mockRejectedValue(
        new Error("TEMPO_SERVICE_ERROR:500:Internal Server Error"),
      );

      const promise = service.searchByTraceId(
        "org-1",
        "project-1",
        "datasource-1",
        "user-1",
        traceId,
      );
      await expect(promise).rejects.toThrow(BadGatewayException);
      await expect(promise).rejects.toThrow(
        "Tempo service returned an error (status 500)",
      );
    });

    it("should throw InternalServerErrorException for unknown errors", async () => {
      mockDatasourcesService.findById.mockResolvedValue(mockDatasource);
      mockTraceRepositoryFactory.getRepository.mockReturnValue(
        mockTraceRepository,
      );
      mockTraceRepository.searchByTraceId.mockRejectedValue(
        new Error("Unknown error"),
      );

      const promise = service.searchByTraceId(
        "org-1",
        "project-1",
        "datasource-1",
        "user-1",
        traceId,
      );
      await expect(promise).rejects.toThrow(InternalServerErrorException);
      await expect(promise).rejects.toThrow(
        "Failed to query trace from datasource",
      );
    });

    it("should pass project trace filter to repository when project has filter configured", async () => {
      const projectWithFilter: Project = {
        id: "project-1",
        traceFilterAttributeName: "project.id",
        traceFilterAttributeValue: "project-123",
      } as Project;
      mockProjectManagementService.getByIdAndOrganisationOrThrow.mockResolvedValue(
        projectWithFilter,
      );
      mockDatasourcesService.findById.mockResolvedValue(mockDatasource);
      mockTraceRepositoryFactory.getRepository.mockReturnValue(
        mockTraceRepository,
      );
      mockTraceRepository.searchByTraceId.mockResolvedValue(tempoTraceJson);

      const result = await service.searchByTraceId(
        "org-1",
        "project-1",
        "datasource-1",
        "user-1",
        traceId,
      );

      expect(
        mockProjectManagementService.getByIdAndOrganisationOrThrow,
      ).toHaveBeenCalledWith("org-1", "project-1");
      expect(mockTraceRepository.searchByTraceId).toHaveBeenCalledWith(
        mockDatasource,
        traceId,
        undefined,
        {
          attributeName: "project.id",
          attributeValue: "project-123",
        },
      );
      expect(result).toEqual(tempoTraceJson);
    });

    it("should throw NotFoundException when trace is filtered out by project filter", async () => {
      const projectWithFilter: Project = {
        id: "project-1",
        traceFilterAttributeName: "project.id",
        traceFilterAttributeValue: "project-123",
      } as Project;
      mockProjectManagementService.getByIdAndOrganisationOrThrow.mockResolvedValue(
        projectWithFilter,
      );
      mockDatasourcesService.findById.mockResolvedValue(mockDatasource);
      mockTraceRepositoryFactory.getRepository.mockReturnValue(
        mockTraceRepository,
      );
      const notFoundError = new NotFoundException(
        formatError(ERROR_MESSAGES.TRACE_NOT_FOUND, traceId),
      );
      mockTraceRepository.searchByTraceId.mockRejectedValue(notFoundError);

      const promise = service.searchByTraceId(
        "org-1",
        "project-1",
        "datasource-1",
        "user-1",
        traceId,
      );

      await expect(promise).rejects.toThrow(NotFoundException);
      await expect(promise).rejects.toThrow(
        `Trace with ID ${traceId} not found in datasource`,
      );
      expect(mockTraceRepository.searchByTraceId).toHaveBeenCalledWith(
        mockDatasource,
        traceId,
        undefined,
        {
          attributeName: "project.id",
          attributeValue: "project-123",
        },
      );
    });

    it("should not pass project filter when project has no filter configured", async () => {
      const projectWithoutFilter: Project = {
        id: "project-1",
        traceFilterAttributeName: undefined,
        traceFilterAttributeValue: undefined,
      } as Project;
      mockProjectManagementService.getByIdAndOrganisationOrThrow.mockResolvedValue(
        projectWithoutFilter,
      );
      mockDatasourcesService.findById.mockResolvedValue(mockDatasource);
      mockTraceRepositoryFactory.getRepository.mockReturnValue(
        mockTraceRepository,
      );
      mockTraceRepository.searchByTraceId.mockResolvedValue(tempoTraceJson);

      const result = await service.searchByTraceId(
        "org-1",
        "project-1",
        "datasource-1",
        "user-1",
        traceId,
      );

      expect(mockTraceRepository.searchByTraceId).toHaveBeenCalledWith(
        mockDatasource,
        traceId,
        undefined,
        undefined,
      );
      expect(result).toEqual(tempoTraceJson);
    });

    it("should pass project filter with time range", async () => {
      const projectWithFilter: Project = {
        id: "project-1",
        traceFilterAttributeName: "project.id",
        traceFilterAttributeValue: "project-123",
      } as Project;
      const timeRange = {
        start: "2024-01-01T00:00:00Z",
        end: "2024-01-02T00:00:00Z",
      };
      mockProjectManagementService.getByIdAndOrganisationOrThrow.mockResolvedValue(
        projectWithFilter,
      );
      mockDatasourcesService.findById.mockResolvedValue(mockDatasource);
      mockTraceRepositoryFactory.getRepository.mockReturnValue(
        mockTraceRepository,
      );
      mockTraceRepository.searchByTraceId.mockResolvedValue(tempoTraceJson);

      const result = await service.searchByTraceId(
        "org-1",
        "project-1",
        "datasource-1",
        "user-1",
        traceId,
        timeRange,
      );

      expect(mockTraceRepository.searchByTraceId).toHaveBeenCalledWith(
        mockDatasource,
        traceId,
        timeRange,
        {
          attributeName: "project.id",
          attributeValue: "project-123",
        },
      );
      expect(result).toEqual(tempoTraceJson);
    });
  });

  describe("getAttributeNames", () => {
    it("should get all tags from Tempo datasource", async () => {
      const mockTags = tempoTagsJson.tagNames || [];
      mockDatasourcesService.findById.mockResolvedValue(mockDatasource);
      mockTraceRepositoryFactory.getRepository.mockReturnValue(
        mockTempoTraceRepository,
      );
      mockTempoTraceRepository.getAttributeNames.mockResolvedValue(mockTags);

      const result = await service.getAttributeNames(
        "org-1",
        "project-1",
        "datasource-1",
        "user-1",
      );

      expect(result).toEqual(mockTags);
      expect(Array.isArray(result)).toBe(true);

      expect(mockTags.length).toBeGreaterThan(0);
      expect(mockDatasourcesService.findById).toHaveBeenCalledWith(
        "datasource-1",
      );
      expect(mockTempoTraceRepository.getAttributeNames).toHaveBeenCalledWith(
        mockDatasource,
      );
    });

    it("should get all tags from ClickHouse datasource", async () => {
      const mockTags = ["tag1", "tag2"];
      const clickHouseDatasource: Datasource = {
        ...mockDatasource,
        source: DatasourceSource.CLICKHOUSE,
      };
      mockDatasourcesService.findById.mockResolvedValue(clickHouseDatasource);
      mockTraceRepositoryFactory.getRepository.mockReturnValue(
        mockClickHouseTraceRepository,
      );
      mockClickHouseTraceRepository.getAttributeNames.mockResolvedValue(
        mockTags,
      );

      const result = await service.getAttributeNames(
        "org-1",
        "project-1",
        "datasource-1",
        "user-1",
      );

      expect(result).toEqual(mockTags);
      expect(
        mockClickHouseTraceRepository.getAttributeNames,
      ).toHaveBeenCalledWith(clickHouseDatasource);
    });

    it("should throw NotFoundException if datasource not found", async () => {
      mockDatasourcesService.findById.mockResolvedValue(null);

      const promise = service.getAttributeNames(
        "org-1",
        "project-1",
        "datasource-1",
        "user-1",
      );
      await expect(promise).rejects.toThrow(NotFoundException);
    });

    it("should throw ForbiddenException if datasource does not belong to organisation", async () => {
      const datasourceFromDifferentOrg: Datasource = {
        ...mockDatasource,
        organisationId: "org-2",
      };
      mockDatasourcesService.findById.mockResolvedValue(
        datasourceFromDifferentOrg,
      );

      const promise = service.getAttributeNames(
        "org-1",
        "project-1",
        "datasource-1",
        "user-1",
      );
      await expect(promise).rejects.toThrow(ForbiddenException);
    });

    it("should throw BadRequestException if datasource is not Tempo or ClickHouse", async () => {
      const jaegerDatasource: Datasource = {
        ...mockDatasource,
        source: DatasourceSource.JAEGER,
      };
      mockDatasourcesService.findById.mockResolvedValue(jaegerDatasource);
      mockTraceRepositoryFactory.getRepository.mockReturnValue(
        mockJaegerTraceRepository,
      );
      mockJaegerTraceRepository.getAttributeNames.mockImplementation(() => {
        throw new BadRequestException(
          formatError(
            ERROR_MESSAGES.GET_ATTRIBUTE_NAMES_NOT_SUPPORTED,
            DatasourceSource.JAEGER,
          ),
        );
      });

      const promise = service.getAttributeNames(
        "org-1",
        "project-1",
        "datasource-1",
        "user-1",
      );
      await expect(promise).rejects.toThrow(BadRequestException);
      await expect(promise).rejects.toThrow(
        formatError(
          ERROR_MESSAGES.GET_ATTRIBUTE_NAMES_NOT_SUPPORTED,
          DatasourceSource.JAEGER,
        ),
      );
    });

    it("should throw InternalServerErrorException if repository fails", async () => {
      mockDatasourcesService.findById.mockResolvedValue(mockDatasource);
      mockTempoTraceRepository.getAttributeNames.mockRejectedValue(
        new InternalServerErrorException("Repository error"),
      );

      const promise = service.getAttributeNames(
        "org-1",
        "project-1",
        "datasource-1",
        "user-1",
      );
      await expect(promise).rejects.toThrow(InternalServerErrorException);
      await expect(promise).rejects.toThrow(
        formatError(ERROR_MESSAGES.TRACE_QUERY_FAILED),
      );
    });
  });

  describe("getAttributeValues", () => {
    const tagName = "service.name";

    it("should get tag values from Tempo datasource", async () => {
      const mockValues = tempoTagValuesJson.tagValues || [];
      mockDatasourcesService.findById.mockResolvedValue(mockDatasource);
      mockTraceRepositoryFactory.getRepository.mockReturnValue(
        mockTempoTraceRepository,
      );
      mockTempoTraceRepository.getAttributeValues.mockResolvedValue(mockValues);

      const result = await service.getAttributeValues(
        "org-1",
        "project-1",
        "datasource-1",
        "user-1",
        tagName,
      );

      expect(result).toEqual(mockValues);
      expect(Array.isArray(result)).toBe(true);
      expect(mockDatasourcesService.findById).toHaveBeenCalledWith(
        "datasource-1",
      );
      expect(mockTempoTraceRepository.getAttributeValues).toHaveBeenCalledWith(
        mockDatasource,
        tagName,
      );
    });

    it("should get tag values from ClickHouse datasource", async () => {
      const mockValues = ["value1", "value2"];
      const clickHouseDatasource: Datasource = {
        ...mockDatasource,
        source: DatasourceSource.CLICKHOUSE,
      };
      mockDatasourcesService.findById.mockResolvedValue(clickHouseDatasource);
      mockTraceRepositoryFactory.getRepository.mockReturnValue(
        mockClickHouseTraceRepository,
      );
      mockClickHouseTraceRepository.getAttributeValues.mockResolvedValue(
        mockValues,
      );

      const result = await service.getAttributeValues(
        "org-1",
        "project-1",
        "datasource-1",
        "user-1",
        tagName,
      );

      expect(result).toEqual(mockValues);
      expect(
        mockClickHouseTraceRepository.getAttributeValues,
      ).toHaveBeenCalledWith(clickHouseDatasource, tagName);
    });

    it("should throw NotFoundException if datasource not found", async () => {
      mockDatasourcesService.findById.mockResolvedValue(null);

      const promise = service.getAttributeValues(
        "org-1",
        "project-1",
        "datasource-1",
        "user-1",
        tagName,
      );
      await expect(promise).rejects.toThrow(NotFoundException);
    });

    it("should throw ForbiddenException if datasource does not belong to organisation", async () => {
      const datasourceFromDifferentOrg: Datasource = {
        ...mockDatasource,
        organisationId: "org-2",
      };
      mockDatasourcesService.findById.mockResolvedValue(
        datasourceFromDifferentOrg,
      );

      const promise = service.getAttributeValues(
        "org-1",
        "project-1",
        "datasource-1",
        "user-1",
        tagName,
      );
      await expect(promise).rejects.toThrow(ForbiddenException);
    });

    it("should throw BadRequestException if datasource is not Tempo or ClickHouse", async () => {
      const jaegerDatasource: Datasource = {
        ...mockDatasource,
        source: DatasourceSource.JAEGER,
      };
      mockDatasourcesService.findById.mockResolvedValue(jaegerDatasource);
      mockTraceRepositoryFactory.getRepository.mockReturnValue(
        mockJaegerTraceRepository,
      );
      mockJaegerTraceRepository.getAttributeValues.mockImplementation(() => {
        throw new BadRequestException(
          formatError(
            ERROR_MESSAGES.GET_ATTRIBUTE_VALUES_NOT_SUPPORTED,
            DatasourceSource.JAEGER,
          ),
        );
      });

      const promise = service.getAttributeValues(
        "org-1",
        "project-1",
        "datasource-1",
        "user-1",
        tagName,
      );
      await expect(promise).rejects.toThrow(BadRequestException);
      await expect(promise).rejects.toThrow(
        formatError(
          ERROR_MESSAGES.GET_ATTRIBUTE_VALUES_NOT_SUPPORTED,
          DatasourceSource.JAEGER,
        ),
      );
    });

    it("should throw InternalServerErrorException if repository fails", async () => {
      mockDatasourcesService.findById.mockResolvedValue(mockDatasource);
      mockTraceRepositoryFactory.getRepository.mockReturnValue(
        mockTempoTraceRepository,
      );
      mockTempoTraceRepository.getAttributeValues.mockRejectedValue(
        new Error("Repository error"),
      );

      const promise = service.getAttributeValues(
        "org-1",
        "project-1",
        "datasource-1",
        "user-1",
        tagName,
      );
      await expect(promise).rejects.toThrow(InternalServerErrorException);
      await expect(promise).rejects.toThrow(
        formatError(ERROR_MESSAGES.TRACE_QUERY_FAILED),
      );
    });
  });
});
