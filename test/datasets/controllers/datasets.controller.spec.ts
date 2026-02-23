jest.mock("../../../src/rbac/guards/org-project-permission.guard", () => ({
  OrgProjectPermissionGuard: jest.fn(() => ({
    canActivate: jest.fn(() => true),
  })),
}));

jest.mock("@thallesp/nestjs-better-auth", () => ({
  Session:
    () => (target: any, propertyKey: string, parameterIndex: number) => {},
  UserSession: class UserSession {},
}));

import { Test, TestingModule } from "@nestjs/testing";
import { BadRequestException } from "@nestjs/common";
import { DatasetsController } from "../../../src/datasets/controllers/datasets.controller";
import { DatasetsService } from "../../../src/datasets/services/datasets.service";
import { DatasetsCsvService } from "../../../src/datasets/services/datasets-csv.service";
import { CreateDatasetRequestDto } from "../../../src/datasets/dto/request/create-dataset.dto";
import { UpdateDatasetRequestDto } from "../../../src/datasets/dto/request/update-dataset.dto";
import { UpsertRowToDatasetRequestDto } from "../../../src/datasets/dto/request/upsert-row-to-dataset.dto";
import { DatasetResponseDto } from "../../../src/datasets/dto/response/dataset.dto";
import { DatasetListItemResponseDto } from "../../../src/datasets/dto/response/dataset-list-item.dto";
import { DatasetRowResponseDto } from "../../../src/datasets/dto/response/dataset-row.dto";
import { DatasetHeaderResponseDto } from "../../../src/datasets/dto/response/dataset-header.dto";
import { DatasetMessageResponseDto } from "../../../src/datasets/dto/response/dataset-message-response.dto";
import { PaginatedDatasetResponseDto } from "../../../src/datasets/dto/response/paginated-dataset.dto";
import {
  ERROR_MESSAGES,
  formatError,
} from "../../../src/common/constants/error-messages.constants";
import { Response } from "express";

describe("DatasetsController", () => {
  let controller: DatasetsController;
  let datasetsService: DatasetsService;
  let datasetsCsvService: DatasetsCsvService;

  const mockDatasetsService = {
    create: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    findOnePaginated: jest.fn(),
    findHeader: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
    upsertRow: jest.fn(),
  };

  const mockDatasetsCsvService = {
    createFromCsv: jest.fn(),
    exportToCsvStream: jest.fn(),
  };

  const mockDatasetResponseDto: DatasetResponseDto = {
    id: "dataset-1",
    name: "Test Dataset",
    description: "Test Description",
    header: ["col1", "col2"],
    rows: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockDatasetListItemDto: DatasetListItemResponseDto = {
    id: "dataset-1",
    name: "Test Dataset",
    description: "Test Description",
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  let module: TestingModule;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      controllers: [DatasetsController],
      providers: [
        {
          provide: DatasetsService,
          useValue: mockDatasetsService,
        },
        {
          provide: DatasetsCsvService,
          useValue: mockDatasetsCsvService,
        },
      ],
    }).compile();

    controller = module.get<DatasetsController>(DatasetsController);
    datasetsService = module.get<DatasetsService>(DatasetsService);
    datasetsCsvService = module.get<DatasetsCsvService>(DatasetsCsvService);
  });

  afterAll(async () => {
    await module.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  const mockUserSession = {
    user: {
      id: "user-1",
    },
  } as any;

  describe("importDataset", () => {
    const mockFile: Express.Multer.File = {
      fieldname: "file",
      originalname: "test.csv",
      encoding: "7bit",
      mimetype: "text/csv",
      size: 1024,
      buffer: Buffer.from("col1,col2\nvalue1,value2"),
      destination: "",
      filename: "test.csv",
      path: "",
      stream: null as any,
    };

    it("should import a dataset from CSV file", async () => {
      mockDatasetsCsvService.createFromCsv.mockResolvedValue(
        mockDatasetResponseDto,
      );

      const result = await controller.importDataset(
        "org-1",
        "project-1",
        mockFile,
        mockUserSession,
        "Test Dataset",
        "Description",
      );

      expect(mockDatasetsCsvService.createFromCsv).toHaveBeenCalledWith(
        "project-1",
        "col1,col2\nvalue1,value2",
        "Test Dataset",
        "user-1",
        "Description",
        "org-1",
      );
      expect(result).toEqual(mockDatasetResponseDto);
    });

    it("should use filename as name if not provided", async () => {
      mockDatasetsCsvService.createFromCsv.mockResolvedValue(
        mockDatasetResponseDto,
      );

      await controller.importDataset(
        "org-1",
        "project-1",
        mockFile,
        mockUserSession,
        undefined,
        undefined,
      );

      expect(mockDatasetsCsvService.createFromCsv).toHaveBeenCalledWith(
        "project-1",
        "col1,col2\nvalue1,value2",
        "test",
        "user-1",
        undefined,
        "org-1",
      );
    });

    it("should throw BadRequestException if file is missing", async () => {
      const promise = controller.importDataset(
        "org-1",
        "project-1",
        null as any,
        mockUserSession,
        "Test Dataset",
        undefined,
      );
      await expect(promise).rejects.toThrow(BadRequestException);
      await expect(promise).rejects.toThrow(
        formatError(ERROR_MESSAGES.CSV_FILE_REQUIRED),
      );
    });

    it("should throw BadRequestException for unsupported file type", async () => {
      const invalidFile: Express.Multer.File = {
        ...mockFile,
        mimetype: "application/xml",
        originalname: "test.xml",
      };

      const promise = controller.importDataset(
        "org-1",
        "project-1",
        invalidFile,
        mockUserSession,
        "Test Dataset",
        undefined,
      );
      await expect(promise).rejects.toThrow(BadRequestException);
      await expect(promise).rejects.toThrow(
        formatError(ERROR_MESSAGES.FILE_MUST_BE_CSV),
      );
    });
  });

  describe("create", () => {
    const createDto: CreateDatasetRequestDto = {
      name: "Test Dataset",
      description: "Test Description",
      header: ["col1", "col2"],
    };

    it("should create a dataset", async () => {
      mockDatasetsService.create.mockResolvedValue(mockDatasetResponseDto);

      const result = await controller.create(
        "org-1",
        "project-1",
        mockUserSession,
        createDto,
      );

      expect(mockDatasetsService.create).toHaveBeenCalledWith(
        "project-1",
        createDto,
        "user-1",
        "org-1",
      );
      expect(result).toEqual(mockDatasetResponseDto);
    });
  });

  describe("findAll", () => {
    it("should return all datasets for a project", async () => {
      mockDatasetsService.findAll.mockResolvedValue([mockDatasetListItemDto]);

      const result = await controller.findAll("project-1");

      expect(mockDatasetsService.findAll).toHaveBeenCalledWith("project-1");
      expect(result).toEqual([mockDatasetListItemDto]);
    });
  });

  describe("findOne", () => {
    it("should return paginated dataset", async () => {
      const mockPaginatedResponse: PaginatedDatasetResponseDto = {
        id: "dataset-1",
        name: "Test Dataset",
        description: "Test Description",
        header: ["col1", "col2"],
        data: [
          { id: "row-1", values: ["value1", "value2"] },
          { id: "row-2", values: ["value3", "value4"] },
        ],

        pagination: {
          page: 1,
          limit: 20,
          total: 2,
          totalPages: 1,
          hasNextPage: false,
          hasPreviousPage: false,
        },
      };

      mockDatasetsService.findOnePaginated.mockResolvedValue(
        mockPaginatedResponse,
      );

      const query = { page: 1, limit: 20 };
      const result = await controller.findOne(
        "project-1",
        "dataset-1",
        query as any,
      );

      expect(mockDatasetsService.findOnePaginated).toHaveBeenCalledWith(
        "project-1",
        "dataset-1",
        query,
      );
      expect(result).toEqual(mockPaginatedResponse);
    });
  });

  describe("findHeader", () => {
    it("should return dataset header", async () => {
      const mockHeaderDto: DatasetHeaderResponseDto = {
        header: ["col1", "col2"],
      };

      mockDatasetsService.findHeader.mockResolvedValue(mockHeaderDto);

      const result = await controller.findHeader("project-1", "dataset-1");

      expect(mockDatasetsService.findHeader).toHaveBeenCalledWith(
        "project-1",
        "dataset-1",
      );
      expect(result).toEqual(mockHeaderDto);
    });
  });

  describe("upsertRow", () => {
    const upsertRowDto: UpsertRowToDatasetRequestDto = {
      values: ["value1", "value2"],
    };

    const mockRowDto: DatasetRowResponseDto = {
      id: "row-1",
      values: ["value1", "value2"],
    };

    it("should add a row to dataset", async () => {
      mockDatasetsService.upsertRow.mockResolvedValue(mockRowDto);

      const result = await controller.upsertRow(
        "project-1",
        "dataset-1",
        upsertRowDto,
      );

      expect(mockDatasetsService.upsertRow).toHaveBeenCalledWith(
        "project-1",
        "dataset-1",
        upsertRowDto,
      );
      expect(result).toEqual(mockRowDto);
    });
  });

  describe("export", () => {
    it("should export dataset to CSV", async () => {
      const mockCsvStream = {
        pipe: jest.fn(),
        on: jest.fn(),
      } as any;

      const mockResponse = {
        setHeader: jest.fn(),
        on: jest.fn((event, callback) => {
          if (event === "finish") {
            setTimeout(callback, 0);
          }
        }),
      } as unknown as Response;

      mockDatasetsCsvService.exportToCsvStream.mockResolvedValue({
        csvStream: mockCsvStream,
        datasetName: "Test Dataset",
      });

      await controller.export("project-1", "dataset-1", mockResponse);

      expect(mockDatasetsCsvService.exportToCsvStream).toHaveBeenCalledWith(
        "project-1",
        "dataset-1",
      );
      expect(mockResponse.setHeader).toHaveBeenCalledWith(
        "Content-Type",
        "text/csv",
      );
      expect(mockResponse.setHeader).toHaveBeenCalledWith(
        "Content-Disposition",
        'attachment; filename="test_dataset-export.csv"',
      );
    });
  });

  describe("update", () => {
    const updateDto: UpdateDatasetRequestDto = {
      name: "Updated Dataset",
    };

    const updatedDataset: DatasetResponseDto = {
      ...mockDatasetResponseDto,
      name: "Updated Dataset",
    };

    it("should update a dataset", async () => {
      mockDatasetsService.update.mockResolvedValue(updatedDataset);

      const result = await controller.update(
        "org-1",
        "project-1",
        "dataset-1",
        updateDto,
        mockUserSession,
      );

      expect(mockDatasetsService.update).toHaveBeenCalledWith(
        "project-1",
        "dataset-1",
        updateDto,
        "user-1",
        "org-1",
      );
      expect(result).toEqual(updatedDataset);
    });
  });

  describe("remove", () => {
    it("should remove a dataset", async () => {
      const deleteResponse: DatasetMessageResponseDto = {
        message: "Dataset deleted successfully",
      };
      mockDatasetsService.remove.mockResolvedValue(deleteResponse);

      const result = await controller.remove(
        "org-1",
        "project-1",
        "dataset-1",
        mockUserSession,
      );

      expect(mockDatasetsService.remove).toHaveBeenCalledWith(
        "project-1",
        "dataset-1",
        "user-1",
        "org-1",
      );
      expect(result).toEqual(deleteResponse);
    });
  });
});
