import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { Repository, In } from "typeorm";
import { NotFoundException, BadRequestException } from "@nestjs/common";
import { DatasourcesService } from "../../../src/datasources/services/datasources.service";
import {
  Datasource,
  DatasourceType,
  DatasourceSource,
} from "../../../src/datasources/entities/datasource.entity";
import {
  CreateDatasourceDto,
  UpdateDatasourceDto,
} from "../../../src/datasources/dto/request/create-datasource.dto";
import { DatasourceResponseDto } from "../../../src/datasources/dto/response/datasource-response.dto";
import { DatasourceListItemResponseDto } from "../../../src/datasources/dto/response/datasource-list-item-response.dto";
import { DatasourceConfigValidator } from "../../../src/datasources/validators/datasource-config.validator";
import { AuditService } from "../../../src/audit/audit.service";
import { DatasourceConfigEncryptionService } from "../../../src/datasources/services/datasource-config-encryption.service";

describe("DatasourcesService", () => {
  let service: DatasourcesService;
  let datasourceRepository: Repository<Datasource>;
  let datasourceConfigValidator: DatasourceConfigValidator;

  const mockAuditService = { record: jest.fn().mockResolvedValue(undefined) };

  const mockDatasourceRepository = {
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    remove: jest.fn(),
  };

  const mockDatasourceConfigValidator = {
    validate: jest.fn(),
  };

  const mockDatasourceConfigEncryptionService = {
    encryptConfig: jest.fn(
      (_source: unknown, config: unknown) => config ?? null,
    ),
    decryptConfig: jest.fn(
      (_source: unknown, config: unknown) => config ?? null,
    ),
    maskConfigForResponse: jest.fn(
      (_source: unknown, config: unknown) => config ?? null,
    ),
  };

  const mockDatasource: Datasource = {
    id: "datasource-1",
    name: "Test Datasource",
    description: "Test Description",
    url: "https://example.com",
    type: DatasourceType.TRACES,
    source: DatasourceSource.TEMPO,
    config: null,
    createdById: "user-1",
    organisationId: "org-1",
    organisation: null as any,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockDatasourceResponseDto: DatasourceResponseDto = {
    id: "datasource-1",
    name: "Test Datasource",
    description: "Test Description",
    url: "https://example.com",
    type: DatasourceType.TRACES as any,
    source: DatasourceSource.TEMPO as any,
    config: null,
    isSearchByQueryEnabled: true,
    isSearchByAttributesEnabled: true,
    isGetAttributeNamesEnabled: true,
    isGetAttributeValuesEnabled: true,
  };

  const mockDatasourceListItemResponseDto: DatasourceListItemResponseDto = {
    id: "datasource-1",
    name: "Test Datasource",
    description: "Test Description",
    type: DatasourceType.TRACES as any,
    source: DatasourceSource.TEMPO as any,
    isSearchByQueryEnabled: true,
    isSearchByAttributesEnabled: true,
    isGetAttributeNamesEnabled: true,
    isGetAttributeValuesEnabled: true,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DatasourcesService,
        {
          provide: getRepositoryToken(Datasource),
          useValue: mockDatasourceRepository,
        },
        {
          provide: DatasourceConfigValidator,
          useValue: mockDatasourceConfigValidator,
        },
        { provide: AuditService, useValue: mockAuditService },
        {
          provide: DatasourceConfigEncryptionService,
          useValue: mockDatasourceConfigEncryptionService,
        },
      ],
    }).compile();

    service = module.get<DatasourcesService>(DatasourcesService);
    datasourceRepository = module.get<Repository<Datasource>>(
      getRepositoryToken(Datasource),
    );
    datasourceConfigValidator = module.get<DatasourceConfigValidator>(
      DatasourceConfigValidator,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("create", () => {
    it("should create a datasource successfully", async () => {
      const createDto: CreateDatasourceDto = {
        name: "Test Datasource",
        description: "Test Description",
        url: "https://example.com",
        type: DatasourceType.TRACES,
        source: DatasourceSource.TEMPO,
      };
      mockDatasourceConfigValidator.validate.mockReturnValue(undefined);
      mockDatasourceRepository.create.mockReturnValue(mockDatasource);
      mockDatasourceRepository.save.mockResolvedValue(mockDatasource);

      const result = await service.create("org-1", "user-1", createDto);

      expect(mockDatasourceConfigValidator.validate).toHaveBeenCalledWith(
        createDto.url,
        createDto.source,
        createDto.config,
      );
      expect(mockDatasourceRepository.create).toHaveBeenCalledWith({
        ...createDto,
        config: null,
        createdById: "user-1",
        organisationId: "org-1",
      });
      expect(mockDatasourceRepository.save).toHaveBeenCalled();
      expect(mockAuditService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "datasource.created",
          actorId: "user-1",
          resourceType: "datasource",
          resourceId: mockDatasource.id,
          organisationId: "org-1",
          afterState: expect.objectContaining({
            id: mockDatasource.id,
            name: mockDatasource.name,
            description: mockDatasource.description,
            url: mockDatasource.url,
            type: mockDatasource.type,
            source: mockDatasource.source,
            organisationId: mockDatasource.organisationId,
          }),
          metadata: { creatorId: "user-1", organisationId: "org-1" },
        }),
      );
      expect(result).toEqual(mockDatasourceResponseDto);
    });

    it("should throw BadRequestException when validation fails", async () => {
      const createDto: CreateDatasourceDto = {
        name: "Test Datasource",
        url: "",
        type: DatasourceType.TRACES,
        source: DatasourceSource.TEMPO,
      };
      mockDatasourceConfigValidator.validate.mockImplementation(() => {
        throw new BadRequestException("URL is required");
      });

      await expect(
        service.create("org-1", "user-1", createDto),
      ).rejects.toThrow(BadRequestException);
      expect(mockDatasourceRepository.create).not.toHaveBeenCalled();
    });
  });

  describe("findAll", () => {
    it("should return all datasources for an organisation", async () => {
      mockDatasourceRepository.find.mockResolvedValue([mockDatasource]);

      const result = await service.findAll("org-1");

      expect(mockDatasourceRepository.find).toHaveBeenCalledWith({
        where: { organisationId: "org-1" },
        order: { name: "ASC" },
      });
      expect(result).toEqual([mockDatasourceResponseDto]);
    });

    it("should return empty array when no datasources exist", async () => {
      mockDatasourceRepository.find.mockResolvedValue([]);

      const result = await service.findAll("org-1");

      expect(result).toEqual([]);
    });
  });

  describe("findAllListItems", () => {
    it("should return all datasource list items for an organisation", async () => {
      mockDatasourceRepository.find.mockResolvedValue([mockDatasource]);

      const result = await service.findAllListItems("org-1");

      expect(mockDatasourceRepository.find).toHaveBeenCalledWith({
        where: { organisationId: "org-1" },
        order: { name: "ASC" },
      });
      expect(result).toEqual([mockDatasourceListItemResponseDto]);
    });

    it("should return empty array when no datasources exist", async () => {
      mockDatasourceRepository.find.mockResolvedValue([]);

      const result = await service.findAllListItems("org-1");

      expect(result).toEqual([]);
    });
  });

  describe("update", () => {
    it("should update a datasource successfully", async () => {
      const updateDto: UpdateDatasourceDto = {
        name: "Updated Datasource",
      };
      const updatedDatasource = {
        ...mockDatasource,
        name: "Updated Datasource",
      };
      mockDatasourceRepository.findOne.mockResolvedValue({ ...mockDatasource });
      mockDatasourceRepository.save.mockResolvedValue(updatedDatasource);

      const result = await service.update(
        "org-1",
        "datasource-1",
        updateDto,
        "user-1",
      );

      expect(mockDatasourceRepository.findOne).toHaveBeenCalledWith({
        where: { id: "datasource-1", organisationId: "org-1" },
      });
      expect(mockDatasourceRepository.save).toHaveBeenCalled();
      expect(mockAuditService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "datasource.updated",
          actorId: "user-1",
          resourceType: "datasource",
          resourceId: "datasource-1",
          organisationId: "org-1",
          metadata: { changedFields: ["name"], organisationId: "org-1" },
        }),
      );
      expect(result.name).toBe("Updated Datasource");
    });

    it("should validate URL when updating url", async () => {
      const updateDto: UpdateDatasourceDto = {
        url: "https://updated.com",
      };
      const updatedDatasource = {
        ...mockDatasource,
        url: "https://updated.com",
      };
      mockDatasourceRepository.findOne.mockResolvedValue(mockDatasource);
      mockDatasourceConfigValidator.validate.mockReturnValue(undefined);
      mockDatasourceRepository.save.mockResolvedValue(updatedDatasource);

      await service.update("org-1", "datasource-1", updateDto, "user-1");

      expect(mockDatasourceConfigValidator.validate).toHaveBeenCalledWith(
        "https://updated.com",
        mockDatasource.source,
        mockDatasource.config,
      );
    });

    it("should validate config when updating config", async () => {
      const updateDto: UpdateDatasourceDto = {
        config: { customApi: { baseUrl: "https://api.com" } },
      };
      const updatedDatasource = { ...mockDatasource, config: updateDto.config };
      mockDatasourceRepository.findOne.mockResolvedValue(mockDatasource);
      mockDatasourceConfigValidator.validate.mockReturnValue(undefined);
      mockDatasourceRepository.save.mockResolvedValue(updatedDatasource);

      await service.update("org-1", "datasource-1", updateDto, "user-1");

      expect(mockDatasourceConfigValidator.validate).toHaveBeenCalledWith(
        mockDatasource.url,
        mockDatasource.source,
        updateDto.config,
      );
    });

    it("should validate when updating both url and config", async () => {
      const updateDto: UpdateDatasourceDto = {
        url: "https://updated.com",
        config: { customApi: { baseUrl: "https://api.com" } },
      };
      const updatedDatasource = { ...mockDatasource, ...updateDto };
      mockDatasourceRepository.findOne.mockResolvedValue(mockDatasource);
      mockDatasourceConfigValidator.validate.mockReturnValue(undefined);
      mockDatasourceRepository.save.mockResolvedValue(updatedDatasource);

      await service.update("org-1", "datasource-1", updateDto, "user-1");

      expect(mockDatasourceConfigValidator.validate).toHaveBeenCalledWith(
        "https://updated.com",
        mockDatasource.source,
        updateDto.config,
      );
    });

    it("should not validate when updating only name", async () => {
      const updateDto: UpdateDatasourceDto = {
        name: "Updated Name",
      };
      const updatedDatasource = { ...mockDatasource, name: "Updated Name" };
      mockDatasourceRepository.findOne.mockResolvedValue(mockDatasource);
      mockDatasourceRepository.save.mockResolvedValue(updatedDatasource);

      await service.update("org-1", "datasource-1", updateDto, "user-1");

      expect(mockDatasourceConfigValidator.validate).not.toHaveBeenCalled();
    });

    it("should throw NotFoundException when datasource not found", async () => {
      const updateDto: UpdateDatasourceDto = {
        name: "Updated Datasource",
      };
      mockDatasourceRepository.findOne.mockResolvedValue(null);

      await expect(
        service.update("org-1", "non-existent", updateDto, "user-1"),
      ).rejects.toThrow(NotFoundException);
      expect(mockDatasourceRepository.save).not.toHaveBeenCalled();
    });

    it("should normalize empty string url to null when updating", async () => {
      const updateDto: UpdateDatasourceDto = {
        url: "",
      };
      const updatedDatasource = { ...mockDatasource, url: null };
      mockDatasourceRepository.findOne.mockResolvedValue(mockDatasource);
      mockDatasourceConfigValidator.validate.mockReturnValue(undefined);
      mockDatasourceRepository.save.mockResolvedValue(updatedDatasource);

      await service.update("org-1", "datasource-1", updateDto, "user-1");

      expect(mockDatasourceConfigValidator.validate).toHaveBeenCalledWith(
        null,
        mockDatasource.source,
        mockDatasource.config,
      );
      expect(mockDatasourceRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ url: null }),
      );
    });

    it("should update ClickHouse datasource with empty string url when config.clickhouse is provided", async () => {
      const clickhouseDatasource = {
        ...mockDatasource,
        source: DatasourceSource.CLICKHOUSE,
        config: {
          clickhouse: {
            host: "192.168.1.104",
            port: 8123,
            database: "default",
            tableName: "traces",
            protocol: "http",
            username: "default",
            password: "password",
          },
        },
      };
      const updateDto: UpdateDatasourceDto = {
        url: "",
        config: {
          clickhouse: {
            host: "192.168.1.104",
            port: 8123,
            database: "default",
            tableName: "traces",
            protocol: "http",
            username: "default",
            password: "password",
          },
        },
      };
      const updatedDatasource = { ...clickhouseDatasource, url: null };
      mockDatasourceRepository.findOne.mockResolvedValue(clickhouseDatasource);
      mockDatasourceConfigValidator.validate.mockReturnValue(undefined);
      mockDatasourceRepository.save.mockResolvedValue(updatedDatasource);

      await service.update("org-1", "datasource-1", updateDto, "user-1");

      expect(mockDatasourceConfigValidator.validate).toHaveBeenCalledWith(
        null,
        DatasourceSource.CLICKHOUSE,
        updateDto.config,
      );
      expect(mockDatasourceRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ url: null }),
      );
    });

    it("should update ClickHouse datasource with config.clickhouse but no url field", async () => {
      const clickhouseDatasource = {
        ...mockDatasource,
        source: DatasourceSource.CLICKHOUSE,
        url: "https://old-url.com",
        config: {
          clickhouse: {
            host: "192.168.1.104",
            port: 8123,
            database: "default",
            tableName: "traces",
            protocol: "http",
            username: "default",
            password: "password",
          },
        },
      };
      const updateDto: UpdateDatasourceDto = {
        config: {
          clickhouse: {
            host: "192.168.1.105",
            port: 8123,
            database: "default",
            tableName: "traces",
            protocol: "http",
            username: "default",
            password: "password",
          },
        },
      };
      const updatedDatasource = {
        ...clickhouseDatasource,
        config: updateDto.config,
      };
      mockDatasourceRepository.findOne.mockResolvedValue(clickhouseDatasource);
      mockDatasourceConfigValidator.validate.mockReturnValue(undefined);
      mockDatasourceRepository.save.mockResolvedValue(updatedDatasource);

      await service.update("org-1", "datasource-1", updateDto, "user-1");

      expect(mockDatasourceConfigValidator.validate).toHaveBeenCalledWith(
        clickhouseDatasource.url,
        DatasourceSource.CLICKHOUSE,
        updateDto.config,
      );
      expect(mockDatasourceRepository.save).toHaveBeenCalled();
    });

    it("should throw BadRequestException when validation fails", async () => {
      const updateDto: UpdateDatasourceDto = {
        url: "",
      };
      mockDatasourceRepository.findOne.mockResolvedValue(mockDatasource);
      mockDatasourceConfigValidator.validate.mockImplementation(() => {
        throw new BadRequestException("URL is required");
      });

      await expect(
        service.update("org-1", "datasource-1", updateDto, "user-1"),
      ).rejects.toThrow(BadRequestException);
      expect(mockDatasourceRepository.save).not.toHaveBeenCalled();
    });
  });

  describe("remove", () => {
    it("should remove a datasource successfully", async () => {
      mockDatasourceRepository.findOne.mockResolvedValue(mockDatasource);
      mockDatasourceRepository.remove.mockResolvedValue(mockDatasource);

      const result = await service.remove("org-1", "datasource-1", "user-1");

      expect(mockDatasourceRepository.findOne).toHaveBeenCalledWith({
        where: { id: "datasource-1", organisationId: "org-1" },
      });
      expect(mockDatasourceRepository.remove).toHaveBeenCalledWith(
        mockDatasource,
      );
      expect(mockAuditService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "datasource.deleted",
          actorId: "user-1",
          resourceType: "datasource",
          resourceId: "datasource-1",
          organisationId: "org-1",
          beforeState: expect.any(Object),
          afterState: null,
          metadata: { organisationId: "org-1" },
        }),
      );
      expect(result).toEqual({ message: "Datasource deleted successfully" });
    });

    it("should throw NotFoundException when datasource not found", async () => {
      mockDatasourceRepository.findOne.mockResolvedValue(null);

      await expect(
        service.remove("org-1", "non-existent", "user-1"),
      ).rejects.toThrow(NotFoundException);
      expect(mockDatasourceRepository.remove).not.toHaveBeenCalled();
    });
  });

  describe("findById", () => {
    it("should return a datasource by id", async () => {
      mockDatasourceRepository.findOne.mockResolvedValue(mockDatasource);

      const result = await service.findById("datasource-1");

      expect(mockDatasourceRepository.findOne).toHaveBeenCalledWith({
        where: { id: "datasource-1" },
      });
      expect(result).toEqual(mockDatasource);
    });

    it("should throw NotFoundException when datasource not found", async () => {
      mockDatasourceRepository.findOne.mockResolvedValue(null);

      await expect(service.findById("non-existent")).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe("findByIds", () => {
    it("should return multiple datasources by ids", async () => {
      const datasources = [mockDatasource];
      mockDatasourceRepository.find.mockResolvedValue(datasources);

      const result = await service.findByIds(["datasource-1", "datasource-2"]);

      expect(mockDatasourceRepository.find).toHaveBeenCalledWith({
        where: { id: In(["datasource-1", "datasource-2"]) },
      });
      expect(result).toEqual(datasources);
    });

    it("should return empty array when ids array is empty", async () => {
      const result = await service.findByIds([]);

      expect(result).toEqual([]);
      expect(mockDatasourceRepository.find).not.toHaveBeenCalled();
    });

    it("should return empty array when ids is null", async () => {
      const result = await service.findByIds(null as any);

      expect(result).toEqual([]);
      expect(mockDatasourceRepository.find).not.toHaveBeenCalled();
    });
  });
});
