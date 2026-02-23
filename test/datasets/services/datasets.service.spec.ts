import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { NotFoundException, BadRequestException } from "@nestjs/common";
import { DatasetsService } from "../../../src/datasets/services/datasets.service";
import { Dataset } from "../../../src/datasets/entities/dataset.entity";
import { DatasetRow } from "../../../src/datasets/entities/dataset-row.entity";
import { CreateDatasetRequestDto } from "../../../src/datasets/dto/request/create-dataset.dto";
import { UpdateDatasetRequestDto } from "../../../src/datasets/dto/request/update-dataset.dto";
import { UpsertRowToDatasetRequestDto } from "../../../src/datasets/dto/request/upsert-row-to-dataset.dto";
import { DatasetMapper } from "../../../src/datasets/mappers";
import {
  ERROR_MESSAGES,
  formatError,
} from "../../../src/common/constants/error-messages.constants";
import { AuditService } from "../../../src/audit/audit.service";

jest.mock("../../../src/datasets/mappers");

describe("DatasetsService", () => {
  let service: DatasetsService;
  let datasetRepository: Repository<Dataset>;
  let datasetRowRepository: Repository<DatasetRow>;

  const mockAuditService = { record: jest.fn().mockResolvedValue(undefined) };

  const mockDatasetRepository = {
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    remove: jest.fn(),
  };

  const mockDatasetRowRepository = {
    save: jest.fn(),
    createQueryBuilder: jest.fn(),
  };

  const mockDataset: Dataset = {
    id: "dataset-1",
    name: "Test Dataset",
    description: "Test Description",
    header: ["col1", "col2"],
    rows: [],
    projectId: "project-1",
    createdById: "user-1",
    createdAt: new Date(),
    updatedAt: new Date(),
  } as Dataset;

  const mockDatasetRow: DatasetRow = {
    id: "row-1",
    values: ["value1", "value2"],
    datasetId: "dataset-1",
    dataset: mockDataset,
    createdAt: new Date(),
    updatedAt: new Date(),
  } as DatasetRow;

  let module: TestingModule;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      providers: [
        DatasetsService,
        {
          provide: getRepositoryToken(Dataset),
          useValue: mockDatasetRepository,
        },
        {
          provide: getRepositoryToken(DatasetRow),
          useValue: mockDatasetRowRepository,
        },
        { provide: AuditService, useValue: mockAuditService },
      ],
    }).compile();

    service = module.get<DatasetsService>(DatasetsService);
    datasetRepository = module.get<Repository<Dataset>>(
      getRepositoryToken(Dataset),
    );
    datasetRowRepository = module.get<Repository<DatasetRow>>(
      getRepositoryToken(DatasetRow),
    );
  });

  afterAll(async () => {
    await module.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("create", () => {
    it("should create a dataset successfully", async () => {
      const projectId = "project-1";
      const createDto: CreateDatasetRequestDto = {
        name: "Test Dataset",
        description: "Test Description",
        header: ["col1", "col2"],
      };

      const mockResponseDto = {
        id: "dataset-1",
        name: "Test Dataset",
        description: "Test Description",
        header: ["col1", "col2"],
        rows: [],
      };

      mockDatasetRepository.create.mockReturnValue(mockDataset);
      mockDatasetRepository.save.mockResolvedValue(mockDataset);
      (DatasetMapper.toDto as jest.Mock).mockReturnValue(mockResponseDto);

      const result = await service.create(
        projectId,
        createDto,
        "user-1",
        "org-1",
      );

      expect(mockDatasetRepository.create).toHaveBeenCalledWith({
        name: createDto.name,
        description: createDto.description,
        header: createDto.header,
        projectId,
        createdById: "user-1",
        rows: [],
      });
      expect(mockDatasetRepository.save).toHaveBeenCalledWith(mockDataset);
      expect(mockAuditService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "dataset.created",
          actorId: "user-1",
          resourceType: "dataset",
          resourceId: mockDataset.id,
          organisationId: "org-1",
          projectId: "project-1",
          afterState: expect.objectContaining({
            id: mockDataset.id,
            name: mockDataset.name,
            description: mockDataset.description,
            header: mockDataset.header,
            projectId: mockDataset.projectId,
          }),
          metadata: {
            creatorId: "user-1",
            organisationId: "org-1",
            projectId: "project-1",
          },
        }),
      );
      expect(result).toEqual(mockResponseDto);
    });
  });

  describe("findAll", () => {
    it("should return all datasets for a project", async () => {
      const projectId = "project-1";
      const datasets = [mockDataset];

      const mockListItemDto = {
        id: "dataset-1",
        name: "Test Dataset",
        description: "Test Description",
      };

      mockDatasetRepository.find.mockResolvedValue(datasets);
      (DatasetMapper.toListItemDto as jest.Mock).mockReturnValue(
        mockListItemDto,
      );

      const result = await service.findAll(projectId);

      expect(mockDatasetRepository.find).toHaveBeenCalledWith({
        where: { projectId },
        order: { createdAt: "DESC" },
      });
      expect(result).toEqual([mockListItemDto]);
    });
  });

  describe("findOne", () => {
    it("should return a dataset with rows", async () => {
      const projectId = "project-1";
      const datasetId = "dataset-1";
      const datasetWithRows = { ...mockDataset, rows: [mockDatasetRow] };

      const mockRowDto = {
        id: "row-1",
        values: ["value1", "value2"],
      };

      const mockResponseDto = {
        id: "dataset-1",
        name: "Test Dataset",
        header: ["col1", "col2"],
        rows: [mockRowDto],
      };

      mockDatasetRepository.findOne.mockResolvedValue(datasetWithRows);
      (DatasetMapper.toRowDto as jest.Mock).mockReturnValue(mockRowDto);
      (DatasetMapper.toDto as jest.Mock).mockReturnValue(mockResponseDto);

      const result = await service.findOne(projectId, datasetId);

      expect(mockDatasetRepository.findOne).toHaveBeenCalledWith({
        where: { id: datasetId, projectId },
        relations: ["rows"],
      });
      expect(result).toEqual(mockResponseDto);
    });

    it("should throw NotFoundException when dataset does not exist", async () => {
      const projectId = "project-1";
      const datasetId = "dataset-1";

      mockDatasetRepository.findOne.mockResolvedValue(null);

      const promise = service.findOne(projectId, datasetId);
      await expect(promise).rejects.toThrow(NotFoundException);
      await expect(promise).rejects.toThrow(
        formatError(
          ERROR_MESSAGES.DATASET_NOT_FOUND_IN_PROJECT,
          datasetId,
          projectId,
        ),
      );
    });
  });

  describe("findHeader", () => {
    it("should return dataset header", async () => {
      const projectId = "project-1";
      const datasetId = "dataset-1";
      const datasetWithHeader = { ...mockDataset, header: ["col1", "col2"] };

      mockDatasetRepository.findOne.mockResolvedValue(datasetWithHeader);

      const result = await service.findHeader(projectId, datasetId);

      expect(mockDatasetRepository.findOne).toHaveBeenCalledWith({
        where: { id: datasetId, projectId },
        relations: [],
      });
      expect(result).toEqual({ header: ["col1", "col2"] });
    });

    it("should throw NotFoundException when dataset does not exist", async () => {
      const projectId = "project-1";
      const datasetId = "dataset-1";

      mockDatasetRepository.findOne.mockResolvedValue(null);

      const promise = service.findHeader(projectId, datasetId);
      await expect(promise).rejects.toThrow(NotFoundException);
    });
  });

  describe("update", () => {
    it("should update dataset name", async () => {
      const projectId = "project-1";
      const datasetId = "dataset-1";
      const updateDto: UpdateDatasetRequestDto = {
        name: "Updated Dataset",
      };

      const updatedDataset = { ...mockDataset, name: "Updated Dataset" };
      const mockResponseDto = {
        id: "dataset-1",
        name: "Updated Dataset",
        header: ["col1", "col2"],
        rows: [],
      };

      mockDatasetRepository.findOne.mockResolvedValue(mockDataset);
      mockDatasetRepository.save.mockResolvedValue(updatedDataset);
      (DatasetMapper.toDto as jest.Mock).mockReturnValue(mockResponseDto);

      const result = await service.update(
        projectId,
        datasetId,
        updateDto,
        "user-1",
        "org-1",
      );

      expect(mockDatasetRepository.save).toHaveBeenCalledWith({
        ...mockDataset,
        name: "Updated Dataset",
      });
      expect(mockAuditService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "dataset.updated",
          actorId: "user-1",
          resourceType: "dataset",
          resourceId: datasetId,
          organisationId: "org-1",
          projectId: "project-1",
          metadata: expect.objectContaining({
            changedFields: ["name"],
            organisationId: "org-1",
            projectId: "project-1",
          }),
        }),
      );
      expect(result).toEqual(mockResponseDto);
    });

    it("should update dataset description", async () => {
      const projectId = "project-1";
      const datasetId = "dataset-1";
      const updateDto: UpdateDatasetRequestDto = {
        description: "Updated Description",
      };

      const updatedDataset = {
        ...mockDataset,
        description: "Updated Description",
      };
      const mockResponseDto = {
        id: "dataset-1",
        name: "Test Dataset",
        description: "Updated Description",
        header: ["col1", "col2"],
        rows: [],
      };

      mockDatasetRepository.findOne.mockResolvedValue(mockDataset);
      mockDatasetRepository.save.mockResolvedValue(updatedDataset);
      (DatasetMapper.toDto as jest.Mock).mockReturnValue(mockResponseDto);

      const result = await service.update(
        projectId,
        datasetId,
        updateDto,
        "user-1",
        "org-1",
      );

      expect(mockDatasetRepository.save).toHaveBeenCalledWith({
        ...mockDataset,
        description: "Updated Description",
      });
      expect(result).toEqual(mockResponseDto);
    });

    it("should throw NotFoundException when dataset does not exist", async () => {
      const projectId = "project-1";
      const datasetId = "dataset-1";
      const updateDto: UpdateDatasetRequestDto = {
        name: "Updated Dataset",
      };

      mockDatasetRepository.findOne.mockResolvedValue(null);

      const promise = service.update(
        projectId,
        datasetId,
        updateDto,
        "user-1",
        "org-1",
      );
      await expect(promise).rejects.toThrow(NotFoundException);
    });
  });

  describe("remove", () => {
    it("should remove a dataset successfully", async () => {
      const projectId = "project-1";
      const datasetId = "dataset-1";

      mockDatasetRepository.findOne.mockResolvedValue(mockDataset);
      mockDatasetRepository.remove.mockResolvedValue(mockDataset);

      const result = await service.remove(
        projectId,
        datasetId,
        "user-1",
        "org-1",
      );

      expect(mockDatasetRepository.findOne).toHaveBeenCalledWith({
        where: { id: datasetId, projectId },
        relations: [],
      });
      expect(mockDatasetRepository.remove).toHaveBeenCalledWith(mockDataset);
      expect(mockAuditService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "dataset.deleted",
          actorId: "user-1",
          resourceType: "dataset",
          resourceId: datasetId,
          organisationId: "org-1",
          projectId: "project-1",
          beforeState: expect.any(Object),
          afterState: null,
          metadata: { organisationId: "org-1", projectId: "project-1" },
        }),
      );
      expect(result).toEqual({ message: "Dataset deleted successfully" });
    });

    it("should throw NotFoundException when dataset does not exist", async () => {
      const projectId = "project-1";
      const datasetId = "dataset-1";

      mockDatasetRepository.findOne.mockResolvedValue(null);

      const promise = service.remove(projectId, datasetId, "user-1", "org-1");
      await expect(promise).rejects.toThrow(NotFoundException);
    });
  });

  describe("upsertRow", () => {
    it("should add a row to dataset successfully", async () => {
      const projectId = "project-1";
      const datasetId = "dataset-1";
      const upsertRowDto: UpsertRowToDatasetRequestDto = {
        values: ["value1", "value2"],
      };

      const mockRowDto = {
        id: "row-1",
        values: ["value1", "value2"],
      };

      mockDatasetRepository.findOne.mockResolvedValue(mockDataset);
      mockDatasetRowRepository.save.mockResolvedValue(mockDatasetRow);
      (DatasetMapper.toRowDto as jest.Mock).mockReturnValue(mockRowDto);

      const result = await service.upsertRow(
        projectId,
        datasetId,
        upsertRowDto,
      );

      expect(mockDatasetRepository.findOne).toHaveBeenCalledWith({
        where: { id: datasetId, projectId },
        relations: [],
      });
      expect(mockDatasetRowRepository.save).toHaveBeenCalledWith({
        values: upsertRowDto.values,
        dataset: mockDataset,
        datasetId: mockDataset.id,
      });
      expect(result).toEqual(mockRowDto);
    });

    it("should throw BadRequestException when values is not an array", async () => {
      const projectId = "project-1";
      const datasetId = "dataset-1";
      const upsertRowDto = {
        values: "not an array",
      } as any;

      mockDatasetRepository.findOne.mockResolvedValue(mockDataset);

      const promise = service.upsertRow(projectId, datasetId, upsertRowDto);
      await expect(promise).rejects.toThrow(BadRequestException);
      await expect(promise).rejects.toThrow(
        formatError(ERROR_MESSAGES.INVALID_REQUEST_BODY),
      );
    });

    it("should throw BadRequestException when values length does not match header length", async () => {
      const projectId = "project-1";
      const datasetId = "dataset-1";
      const upsertRowDto: UpsertRowToDatasetRequestDto = {
        values: ["value1"],
      };

      mockDatasetRepository.findOne.mockResolvedValue(mockDataset);

      const promise = service.upsertRow(projectId, datasetId, upsertRowDto);
      await expect(promise).rejects.toThrow(BadRequestException);
      await expect(promise).rejects.toThrow(
        formatError(ERROR_MESSAGES.VALUES_ARRAY_LENGTH_MISMATCH, 1, 2),
      );
    });

    it("should throw NotFoundException when dataset does not exist", async () => {
      const projectId = "project-1";
      const datasetId = "dataset-1";
      const upsertRowDto: UpsertRowToDatasetRequestDto = {
        values: ["value1", "value2"],
      };

      mockDatasetRepository.findOne.mockResolvedValue(null);

      const promise = service.upsertRow(projectId, datasetId, upsertRowDto);
      await expect(promise).rejects.toThrow(NotFoundException);
    });
  });

  describe("findOnePaginated", () => {
    it("should return paginated dataset rows", async () => {
      const projectId = "project-1";
      const datasetId = "dataset-1";
      const query = { page: 1, limit: 20 };

      const queryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getCount: jest.fn().mockResolvedValue(2),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([
          { id: "row-1", values: ["value1", "value2"] },
          { id: "row-2", values: ["value3", "value4"] },
        ]),
      };

      mockDatasetRepository.findOne.mockResolvedValue(mockDataset);
      mockDatasetRowRepository.createQueryBuilder.mockReturnValue(queryBuilder);
      (DatasetMapper.toRowDto as jest.Mock).mockImplementation((row) => ({
        id: row.id,
        values: row.values,
      }));

      const result = await service.findOnePaginated(
        projectId,
        datasetId,
        query as any,
      );

      expect(result.id).toBe(mockDataset.id);
      expect(result.data).toHaveLength(2);
      expect(result.pagination.page).toBe(1);
      expect(result.pagination.limit).toBe(20);
      expect(result.pagination.total).toBe(2);
      expect(result.pagination.totalPages).toBe(1);
      expect(result.pagination.hasNextPage).toBe(false);
      expect(result.pagination.hasPreviousPage).toBe(false);
      expect(queryBuilder.where).toHaveBeenCalledWith(
        "row.datasetId = :datasetId",
        { datasetId },
      );
      expect(queryBuilder.skip).toHaveBeenCalledWith(0);
      expect(queryBuilder.take).toHaveBeenCalledWith(20);
    });

    it("should apply search filter when provided", async () => {
      const projectId = "project-1";
      const datasetId = "dataset-1";
      const query = { page: 1, limit: 20, search: "test" };

      const queryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getCount: jest.fn().mockResolvedValue(0),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      };

      mockDatasetRepository.findOne.mockResolvedValue(mockDataset);
      mockDatasetRowRepository.createQueryBuilder.mockReturnValue(queryBuilder);

      await service.findOnePaginated(projectId, datasetId, query as any);

      expect(queryBuilder.andWhere).toHaveBeenCalledWith(
        "row.values::text ILIKE :search",
        {
          search: "%test%",
        },
      );
    });

    it("should apply sorting by column index when provided", async () => {
      const projectId = "project-1";
      const datasetId = "dataset-1";
      const query = { page: 1, limit: 20, sortBy: "0", sortOrder: "desc" };

      const queryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getCount: jest.fn().mockResolvedValue(0),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      };

      mockDatasetRepository.findOne.mockResolvedValue(mockDataset);
      mockDatasetRowRepository.createQueryBuilder.mockReturnValue(queryBuilder);

      await service.findOnePaginated(projectId, datasetId, query as any);

      expect(queryBuilder.orderBy).toHaveBeenCalledWith(
        "row.values->>0",
        "DESC",
      );
    });

    it("should apply sorting by row id when sortBy is id", async () => {
      const projectId = "project-1";
      const datasetId = "dataset-1";
      const query = { page: 1, limit: 20, sortBy: "id", sortOrder: "desc" };

      const queryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getCount: jest.fn().mockResolvedValue(0),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      };

      mockDatasetRepository.findOne.mockResolvedValue(mockDataset);
      mockDatasetRowRepository.createQueryBuilder.mockReturnValue(queryBuilder);

      await service.findOnePaginated(projectId, datasetId, query as any);

      expect(queryBuilder.orderBy).toHaveBeenCalledWith("row.id", "DESC");
    });

    it("should throw NotFoundException when dataset does not exist", async () => {
      const projectId = "project-1";
      const datasetId = "dataset-1";
      const query = { page: 1, limit: 20 };

      mockDatasetRepository.findOne.mockResolvedValue(null);

      const promise = service.findOnePaginated(
        projectId,
        datasetId,
        query as any,
      );
      await expect(promise).rejects.toThrow(NotFoundException);
    });
  });
});
