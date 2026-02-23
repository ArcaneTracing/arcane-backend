import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { BadRequestException, NotFoundException } from "@nestjs/common";
import { DatasetsCsvService } from "../../../src/datasets/services/datasets-csv.service";
import { Dataset } from "../../../src/datasets/entities/dataset.entity";
import { DatasetRow } from "../../../src/datasets/entities/dataset-row.entity";
import { DatasetMapper } from "../../../src/datasets/mappers";
import {
  ERROR_MESSAGES,
  formatError,
} from "../../../src/common/constants/error-messages.constants";
import { Readable } from "stream";
import { AuditService } from "../../../src/audit/audit.service";

jest.mock("../../../src/datasets/mappers");

describe("DatasetsCsvService", () => {
  let service: DatasetsCsvService;
  let datasetRepository: Repository<Dataset>;

  const mockAuditService = { record: jest.fn().mockResolvedValue(undefined) };

  const mockDatasetRepository = {
    findOne: jest.fn(),
    manager: {
      transaction: jest.fn(),
    },
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
        DatasetsCsvService,
        {
          provide: getRepositoryToken(Dataset),
          useValue: mockDatasetRepository,
        },
        { provide: AuditService, useValue: mockAuditService },
      ],
    }).compile();

    service = module.get<DatasetsCsvService>(DatasetsCsvService);
    datasetRepository = module.get<Repository<Dataset>>(
      getRepositoryToken(Dataset),
    );
  });

  afterAll(async () => {
    await module.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("createFromCsv", () => {
    it("should create a dataset from CSV successfully", async () => {
      const projectId = "project-1";
      const csvContent = "col1,col2\nvalue1,value2";
      const name = "Test Dataset";
      const description = "Test Description";

      const mockDatasetRepo = {
        create: jest.fn(),
        save: jest.fn(),
      };

      const mockRowRepo = {
        create: jest.fn(),
        save: jest.fn(),
      };

      const savedDataset = { ...mockDataset, header: ["col1", "col2"] };
      mockDatasetRepo.create.mockReturnValue(savedDataset);
      mockDatasetRepo.save.mockResolvedValue(savedDataset);
      mockRowRepo.create.mockReturnValue(mockDatasetRow);
      mockRowRepo.save.mockResolvedValue([mockDatasetRow]);

      mockDatasetRepository.manager.transaction.mockImplementation(
        async (callback) => {
          return callback({
            getRepository: jest.fn((entity) => {
              if (entity === Dataset) return mockDatasetRepo;
              if (entity === DatasetRow) return mockRowRepo;
              return null;
            }),
          });
        },
      );

      const mockResponseDto = {
        id: "dataset-1",
        name: "Test Dataset",
        header: ["col1", "col2"],
        rows: [],
      };

      (DatasetMapper.toDto as jest.Mock).mockReturnValue(mockResponseDto);

      const userId = "user-1";
      const result = await service.createFromCsv(
        projectId,
        csvContent,
        name,
        userId,
        description,
        "org-1",
      );

      expect(mockDatasetRepository.manager.transaction).toHaveBeenCalled();
      expect(mockDatasetRepo.save).toHaveBeenCalled();
      expect(mockAuditService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "dataset.imported",
          actorId: userId,
          resourceType: "dataset",
          resourceId: savedDataset.id,
          organisationId: "org-1",
          projectId: "project-1",
          afterState: expect.objectContaining({
            id: savedDataset.id,
            name: savedDataset.name,
            header: ["col1", "col2"],
            projectId: "project-1",
          }),
          metadata: expect.objectContaining({
            organisationId: "org-1",
            projectId: "project-1",
            importedById: userId,
            rowCount: 1,
          }),
        }),
      );
      expect(result).toEqual(mockResponseDto);
    });

    it("should throw BadRequestException for empty CSV", async () => {
      const projectId = "project-1";
      const csvContent = "";
      const name = "Test Dataset";

      const mockDatasetRepo = {
        create: jest.fn(),
        save: jest.fn(),
      };

      const mockRowRepo = {
        create: jest.fn(),
        save: jest.fn(),
      };

      mockDatasetRepository.manager.transaction.mockImplementation(
        async (callback) => {
          return callback({
            getRepository: jest.fn((entity) => {
              if (entity === Dataset) return mockDatasetRepo;
              if (entity === DatasetRow) return mockRowRepo;
              return null;
            }),
          });
        },
      );

      const userId = "user-1";
      const promise = service.createFromCsv(
        projectId,
        csvContent,
        name,
        userId,
        undefined,
        "org-1",
      );
      await expect(promise).rejects.toThrow(BadRequestException);
      await expect(promise).rejects.toThrow(
        formatError(ERROR_MESSAGES.CSV_FILE_MUST_CONTAIN_HEADER_ROW),
      );
    });

    it("should throw BadRequestException for empty header (all whitespace)", async () => {
      const projectId = "project-1";
      const csvContent = "  ,  \nvalue1,value2";
      const name = "Test Dataset";

      const mockDatasetRepo = {
        create: jest.fn(),
        save: jest.fn(),
      };

      const mockRowRepo = {
        create: jest.fn(),
        save: jest.fn(),
      };

      mockDatasetRepository.manager.transaction.mockImplementation(
        async (callback) => {
          return callback({
            getRepository: jest.fn((entity) => {
              if (entity === Dataset) return mockDatasetRepo;
              if (entity === DatasetRow) return mockRowRepo;
              return null;
            }),
          });
        },
      );

      const userId = "user-1";
      const promise = service.createFromCsv(
        projectId,
        csvContent,
        name,
        userId,
        undefined,
        "org-1",
      );
      await expect(promise).rejects.toThrow(BadRequestException);
      await expect(promise).rejects.toThrow(
        formatError(ERROR_MESSAGES.CSV_HEADER_EMPTY),
      );
    });

    it("should throw BadRequestException for duplicate column names", async () => {
      const projectId = "project-1";
      const csvContent = "col1,col1\nvalue1,value2";
      const name = "Test Dataset";

      const mockDatasetRepo = {
        create: jest.fn(),
        save: jest.fn(),
      };

      const mockRowRepo = {
        create: jest.fn(),
        save: jest.fn(),
      };

      mockDatasetRepository.manager.transaction.mockImplementation(
        async (callback) => {
          return callback({
            getRepository: jest.fn((entity) => {
              if (entity === Dataset) return mockDatasetRepo;
              if (entity === DatasetRow) return mockRowRepo;
              return null;
            }),
          });
        },
      );

      const userId = "user-1";
      const promise = service.createFromCsv(
        projectId,
        csvContent,
        name,
        userId,
        undefined,
        "org-1",
      );
      await expect(promise).rejects.toThrow(BadRequestException);
      await expect(promise).rejects.toThrow(
        formatError(ERROR_MESSAGES.CSV_HEADER_CONTAINS_DUPLICATE_COLUMN_NAMES),
      );
    });

    it("should throw BadRequestException for row column mismatch", async () => {
      const projectId = "project-1";
      const csvContent = "col1,col2\nvalue1";
      const name = "Test Dataset";

      const mockDatasetRepo = {
        create: jest.fn(),
        save: jest.fn(),
      };

      const mockRowRepo = {
        create: jest.fn(),
        save: jest.fn(),
      };

      const savedDataset = { ...mockDataset, header: ["col1", "col2"] };
      mockDatasetRepo.create.mockReturnValue(savedDataset);
      mockDatasetRepo.save.mockResolvedValue(savedDataset);

      mockDatasetRepository.manager.transaction.mockImplementation(
        async (callback) => {
          return callback({
            getRepository: jest.fn((entity) => {
              if (entity === Dataset) return mockDatasetRepo;
              if (entity === DatasetRow) return mockRowRepo;
              return null;
            }),
          });
        },
      );

      const userId = "user-1";
      const promise = service.createFromCsv(
        projectId,
        csvContent,
        name,
        userId,
        undefined,
        "org-1",
      );
      await expect(promise).rejects.toThrow(BadRequestException);
      const error = await promise.catch((e) => e);
      expect(error.message).toContain("Failed to parse CSV file");
    });

    it("should throw BadRequestException for empty column names in header", async () => {
      const projectId = "project-1";
      const csvContent = "col1,\nvalue1,value2";
      const name = "Test Dataset";

      const mockDatasetRepo = {
        create: jest.fn(),
        save: jest.fn(),
      };

      const mockRowRepo = {
        create: jest.fn(),
        save: jest.fn(),
      };

      mockDatasetRepository.manager.transaction.mockImplementation(
        async (callback) => {
          return callback({
            getRepository: jest.fn((entity) => {
              if (entity === Dataset) return mockDatasetRepo;
              if (entity === DatasetRow) return mockRowRepo;
              return null;
            }),
          });
        },
      );

      const userId = "user-1";
      const promise = service.createFromCsv(
        projectId,
        csvContent,
        name,
        userId,
        undefined,
        "org-1",
      );
      await expect(promise).rejects.toThrow(BadRequestException);
      await expect(promise).rejects.toThrow(
        formatError(ERROR_MESSAGES.CSV_HEADER_CONTAINS_EMPTY_COLUMN_NAMES),
      );
    });
  });

  describe("exportToCsvStream", () => {
    it("should export dataset to CSV stream", async () => {
      const projectId = "project-1";
      const datasetId = "dataset-1";
      const datasetWithRows = { ...mockDataset, rows: [mockDatasetRow] };

      mockDatasetRepository.findOne.mockResolvedValue(datasetWithRows);

      const result = await service.exportToCsvStream(projectId, datasetId);

      expect(mockDatasetRepository.findOne).toHaveBeenCalledWith({
        where: { id: datasetId, projectId },
        relations: ["rows"],
      });
      expect(result).toHaveProperty("csvStream");
      expect(result).toHaveProperty("datasetName");
      expect(result.datasetName).toBe("Test Dataset");
      expect(result.csvStream).toBeDefined();
    });

    it("should throw NotFoundException when dataset does not exist", async () => {
      const projectId = "project-1";
      const datasetId = "dataset-1";

      mockDatasetRepository.findOne.mockResolvedValue(null);

      const promise = service.exportToCsvStream(projectId, datasetId);
      await expect(promise).rejects.toThrow(NotFoundException);
      await expect(promise).rejects.toThrow(
        `Dataset with ID ${datasetId} not found in project ${projectId}`,
      );
    });
  });
});
