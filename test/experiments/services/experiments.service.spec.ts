import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { ExperimentsService } from "../../../src/experiments/services/experiments.service";
import { Experiment } from "../../../src/experiments/entities/experiment.entity";
import {
  ExperimentResult,
  ExperimentResultStatus,
} from "../../../src/experiments/entities/experiment-result.entity";
import { PromptVersion } from "../../../src/prompts/entities/prompt-version.entity";
import { Dataset } from "../../../src/datasets/entities/dataset.entity";
import { DatasetRow } from "../../../src/datasets/entities/dataset-row.entity";
import { ExperimentJobsService } from "../../../src/experiments/services/experiment-jobs.service";
import { CreateExperimentRequestDto } from "../../../src/experiments/dto/request/create-experiment-request.dto";
import { CreateExperimentResultRequestDto } from "../../../src/experiments/dto/request/create-experiment-result-request.dto";
import {
  ERROR_MESSAGES,
  formatError,
} from "../../../src/common/constants/error-messages.constants";
import { AuditService } from "../../../src/audit/audit.service";

describe("ExperimentsService", () => {
  let service: ExperimentsService;
  let experimentRepository: Repository<Experiment>;
  let experimentResultRepository: Repository<ExperimentResult>;
  let promptVersionRepository: Repository<PromptVersion>;
  let datasetRepository: Repository<Dataset>;
  let datasetRowRepository: Repository<DatasetRow>;
  let experimentJobsService: ExperimentJobsService;

  const mockExperimentRepository = {
    findOne: jest.fn(),
    find: jest.fn(),
    save: jest.fn(),
    remove: jest.fn(),
  };

  const mockExperimentResultRepository = {
    find: jest.fn(),
    save: jest.fn(),
    createQueryBuilder: jest.fn(),
  };

  const mockPromptVersionRepository = {
    findOne: jest.fn(),
  };

  const mockDatasetRepository = {
    findOne: jest.fn(),
  };

  const mockDatasetRowRepository = {
    findOne: jest.fn(),
  };

  const mockExperimentJobsService = {
    queueForExperiment: jest.fn(),
  };

  const mockAuditService = { record: jest.fn().mockResolvedValue(undefined) };

  const basePromptVersion: PromptVersion = {
    id: "prompt-version-1",
    promptId: "prompt-1",
    prompt: { id: "prompt-1", projectId: "project-1" } as any,
    modelConfigurationId: "model-config-1",
    modelConfiguration: { id: "model-config-1" } as any,
    createdAt: new Date("2024-01-01T00:00:00.000Z"),
    updatedAt: new Date("2024-01-02T00:00:00.000Z"),
  } as PromptVersion;

  const baseDataset: Dataset = {
    id: "dataset-1",
    name: "Dataset",
    description: null,
    header: ["col1", "col2"],
    projectId: "project-1",
    createdAt: new Date(),
    updatedAt: new Date(),
  } as Dataset;

  const baseExperiment: Experiment = {
    id: "experiment-1",
    projectId: "project-1",
    name: "Experiment",
    description: "desc",
    promptVersionId: basePromptVersion.id,
    promptVersion: basePromptVersion,
    datasetId: baseDataset.id,
    dataset: baseDataset,
    promptInputMappings: { col1: "input1" },
    createdById: "user-1",
    results: [],
    createdAt: new Date("2024-01-03T00:00:00.000Z"),
    updatedAt: new Date("2024-01-03T00:00:00.000Z"),
  } as unknown as Experiment;

  let module: TestingModule;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      providers: [
        ExperimentsService,
        {
          provide: getRepositoryToken(Experiment),
          useValue: mockExperimentRepository,
        },
        {
          provide: getRepositoryToken(ExperimentResult),
          useValue: mockExperimentResultRepository,
        },
        {
          provide: getRepositoryToken(PromptVersion),
          useValue: mockPromptVersionRepository,
        },
        {
          provide: getRepositoryToken(Dataset),
          useValue: mockDatasetRepository,
        },
        {
          provide: getRepositoryToken(DatasetRow),
          useValue: mockDatasetRowRepository,
        },
        {
          provide: ExperimentJobsService,
          useValue: mockExperimentJobsService,
        },
        { provide: AuditService, useValue: mockAuditService },
      ],
    }).compile();

    service = module.get<ExperimentsService>(ExperimentsService);
    experimentRepository = module.get<Repository<Experiment>>(
      getRepositoryToken(Experiment),
    );
    experimentResultRepository = module.get<Repository<ExperimentResult>>(
      getRepositoryToken(ExperimentResult),
    );
    promptVersionRepository = module.get<Repository<PromptVersion>>(
      getRepositoryToken(PromptVersion),
    );
    datasetRepository = module.get<Repository<Dataset>>(
      getRepositoryToken(Dataset),
    );
    datasetRowRepository = module.get<Repository<DatasetRow>>(
      getRepositoryToken(DatasetRow),
    );
    experimentJobsService = module.get<ExperimentJobsService>(
      ExperimentJobsService,
    );
  });

  afterAll(async () => {
    await module.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockExperimentJobsService.queueForExperiment.mockResolvedValue(undefined);
  });

  describe("create", () => {
    const dto: CreateExperimentRequestDto = {
      name: "New Experiment",
      description: "desc",
      promptVersionId: basePromptVersion.id,
      datasetId: baseDataset.id,
      promptInputMappings: { col1: "input1" },
    };

    it("should create an experiment and queue jobs", async () => {
      mockPromptVersionRepository.findOne.mockResolvedValue(basePromptVersion);
      mockDatasetRepository.findOne.mockResolvedValue(baseDataset);
      mockExperimentRepository.save.mockResolvedValue(baseExperiment);

      const result = await service.create("project-1", dto, "user-1", "org-1");

      expect(result.id).toBe(baseExperiment.id);
      expect(result.promptVersionId).toBe(basePromptVersion.id);
      expect(result.datasetId).toBe(baseDataset.id);
      expect(experimentRepository.save).toHaveBeenCalled();
      expect(mockAuditService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "experiment.created",
          actorId: "user-1",
          resourceType: "experiment",
          resourceId: baseExperiment.id,
          organisationId: "org-1",
          projectId: "project-1",
          afterState: expect.objectContaining({
            id: baseExperiment.id,
            name: baseExperiment.name,
            projectId: baseExperiment.projectId,
          }),
          metadata: {
            creatorId: "user-1",
            organisationId: "org-1",
            projectId: "project-1",
          },
        }),
      );
      expect(experimentJobsService.queueForExperiment).toHaveBeenCalledWith(
        baseExperiment,
      );
    });

    it("should not fail if queuing jobs throws", async () => {
      mockPromptVersionRepository.findOne.mockResolvedValue(basePromptVersion);
      mockDatasetRepository.findOne.mockResolvedValue(baseDataset);
      mockExperimentRepository.save.mockResolvedValue(baseExperiment);
      mockExperimentJobsService.queueForExperiment.mockRejectedValue(
        new Error("Queue error"),
      );

      const result = await service.create("project-1", dto, "user-1", "org-1");

      expect(result.id).toBe(baseExperiment.id);
    });

    it("should throw NotFoundException if prompt version is missing or in another project", async () => {
      const mismatchedPromptVersion = {
        ...basePromptVersion,
        prompt: { id: "prompt-1", projectId: "other-project" },
      };
      mockPromptVersionRepository.findOne.mockResolvedValue(
        mismatchedPromptVersion,
      );

      await expect(
        service.create("project-1", dto, "user-1", "org-1"),
      ).rejects.toThrow(
        formatError(
          ERROR_MESSAGES.PROMPT_VERSION_NOT_FOUND,
          basePromptVersion.id,
        ),
      );
    });

    it("should throw NotFoundException if dataset is not in project", async () => {
      mockPromptVersionRepository.findOne.mockResolvedValue(basePromptVersion);
      mockDatasetRepository.findOne.mockResolvedValue(null);

      await expect(
        service.create("project-1", dto, "user-1", "org-1"),
      ).rejects.toThrow(
        formatError(
          ERROR_MESSAGES.DATASET_NOT_FOUND_IN_PROJECT,
          baseDataset.id,
          "project-1",
        ),
      );
    });
  });

  describe("findAll", () => {
    it("should return experiments for a project", async () => {
      mockExperimentRepository.find.mockResolvedValue([baseExperiment]);

      const result = await service.findAll("project-1");

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(baseExperiment.id);
      expect(experimentRepository.find).toHaveBeenCalledWith({
        where: { projectId: "project-1" },
        order: { createdAt: "DESC" },
      });
    });
  });

  describe("findOne", () => {
    it("should return an experiment with results", async () => {
      const resultEntity: ExperimentResult = {
        id: "result-1",
        experimentId: baseExperiment.id,
        datasetRowId: "row-1",
        result: "ok",
        status: ExperimentResultStatus.DONE,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as ExperimentResult;
      mockExperimentRepository.findOne.mockResolvedValue({
        ...baseExperiment,
        results: [resultEntity],
      });

      const result = await service.findOne("project-1", baseExperiment.id);

      expect(result.results).toHaveLength(1);
      expect(result.results?.[0].id).toBe("result-1");
    });

    it("should throw NotFoundException when experiment is missing", async () => {
      mockExperimentRepository.findOne.mockResolvedValue(null);

      await expect(service.findOne("project-1", "missing")).rejects.toThrow(
        formatError(ERROR_MESSAGES.EXPERIMENT_NOT_FOUND_IN_PROJECT, "missing"),
      );
    });
  });

  describe("rerun", () => {
    it("should create a rerun and queue jobs", async () => {
      mockExperimentRepository.findOne.mockResolvedValue({
        ...baseExperiment,
        promptVersion: basePromptVersion,
        dataset: baseDataset,
      });
      mockExperimentRepository.save.mockImplementation(async (input) => ({
        ...(input as Experiment),
        id: "rerun-1",
        projectId: baseExperiment.projectId,
        createdAt: new Date(),
        updatedAt: new Date(),
      }));

      const result = await service.rerun(
        "project-1",
        baseExperiment.id,
        "user-2",
        "org-1",
      );

      expect(result.id).toBe("rerun-1");
      expect(result.name).toMatch(/^Re-run /);
      expect(mockAuditService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "experiment.rerun",
          actorId: "user-2",
          resourceType: "experiment",
          resourceId: "rerun-1",
          organisationId: "org-1",
          projectId: baseExperiment.projectId,
          metadata: expect.objectContaining({
            sourceExperimentId: baseExperiment.id,
            organisationId: "org-1",
            creatorId: "user-2",
          }),
        }),
      );
      expect(experimentJobsService.queueForExperiment).toHaveBeenCalled();
    });
  });

  describe("remove", () => {
    it("should remove an experiment", async () => {
      mockExperimentRepository.findOne.mockResolvedValue(baseExperiment);

      await service.remove("project-1", baseExperiment.id, "user-1", "org-1");

      expect(experimentRepository.remove).toHaveBeenCalledWith(baseExperiment);
      expect(mockAuditService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "experiment.deleted",
          actorId: "user-1",
          resourceType: "experiment",
          resourceId: baseExperiment.id,
          organisationId: "org-1",
          projectId: baseExperiment.projectId,
          beforeState: expect.objectContaining({
            id: baseExperiment.id,
            name: baseExperiment.name,
            projectId: baseExperiment.projectId,
          }),
          afterState: null,
          metadata: {
            organisationId: "org-1",
            projectId: baseExperiment.projectId,
          },
        }),
      );
    });
  });

  describe("createResult", () => {
    it("should create a DONE experiment result", async () => {
      const dto: CreateExperimentResultRequestDto = {
        datasetRowId: "row-1",
        result: "ok",
      };
      const datasetRow: DatasetRow = {
        id: "row-1",
        datasetId: baseDataset.id,
      } as DatasetRow;

      mockExperimentRepository.findOne.mockResolvedValue(baseExperiment);
      mockDatasetRowRepository.findOne.mockResolvedValue(datasetRow);
      mockExperimentResultRepository.save.mockResolvedValue({
        id: "result-1",
        datasetRowId: "row-1",
        result: "ok",
        status: ExperimentResultStatus.DONE,
        createdAt: new Date(),
      });

      const result = await service.createResult(
        "project-1",
        baseExperiment.id,
        dto,
      );

      expect(result.status).toBe(ExperimentResultStatus.DONE);
      expect(experimentResultRepository.save).toHaveBeenCalledWith({
        experimentId: baseExperiment.id,
        datasetRowId: "row-1",
        result: "ok",
        status: ExperimentResultStatus.DONE,
      });
    });

    it("should throw NotFoundException when dataset row is not in dataset", async () => {
      const dto: CreateExperimentResultRequestDto = {
        datasetRowId: "row-2",
        result: "ok",
      };
      const datasetRow: DatasetRow = {
        id: "row-2",
        datasetId: "other-dataset",
      } as DatasetRow;

      mockExperimentRepository.findOne.mockResolvedValue(baseExperiment);
      mockDatasetRowRepository.findOne.mockResolvedValue(datasetRow);

      await expect(
        service.createResult("project-1", baseExperiment.id, dto),
      ).rejects.toThrow(
        `Dataset row row-2 not found for experiment dataset ${baseExperiment.datasetId}`,
      );
    });
  });

  describe("listResults", () => {
    it("should list experiment results", async () => {
      mockExperimentRepository.findOne.mockResolvedValue(baseExperiment);
      mockExperimentResultRepository.find.mockResolvedValue([
        {
          id: "result-1",
          datasetRowId: "row-1",
          result: "ok",
          status: ExperimentResultStatus.DONE,
          createdAt: new Date(),
        },
      ]);

      const result = await service.listResults("project-1", baseExperiment.id);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("result-1");
    });
  });

  describe("listResultsPaginated", () => {
    it("should return paginated experiment results", async () => {
      const mockDatasetRow = {
        id: "row-1",
        values: ["value1", "value2"],
        datasetId: baseDataset.id,
      };

      const mockResult = {
        id: "result-1",
        datasetRowId: "row-1",
        datasetRow: mockDatasetRow,
        result: "ok",
        status: ExperimentResultStatus.DONE,
        createdAt: new Date(),
      };

      const queryBuilder = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getCount: jest.fn().mockResolvedValue(1),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([mockResult]),
      };

      mockExperimentRepository.findOne.mockResolvedValue(baseExperiment);
      mockExperimentResultRepository.createQueryBuilder.mockReturnValue(
        queryBuilder,
      );

      const query = { page: 1, limit: 20 };
      const result = await service.listResultsPaginated(
        "project-1",
        baseExperiment.id,
        query,
      );

      expect(result.data).toHaveLength(1);
      expect(result.pagination.page).toBe(1);
      expect(result.pagination.limit).toBe(20);
      expect(result.pagination.total).toBe(1);
      expect(result.pagination.totalPages).toBe(1);
      expect(result.pagination.hasNextPage).toBe(false);
      expect(result.pagination.hasPreviousPage).toBe(false);
      expect(queryBuilder.leftJoinAndSelect).toHaveBeenCalledWith(
        "result.datasetRow",
        "datasetRow",
      );
      expect(queryBuilder.where).toHaveBeenCalledWith(
        "result.experimentId = :experimentId",
        {
          experimentId: baseExperiment.id,
        },
      );
      expect(queryBuilder.skip).toHaveBeenCalledWith(0);
      expect(queryBuilder.take).toHaveBeenCalledWith(20);
    });

    it("should apply search filter when provided", async () => {
      const queryBuilder = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getCount: jest.fn().mockResolvedValue(0),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      };

      mockExperimentRepository.findOne.mockResolvedValue(baseExperiment);
      mockExperimentResultRepository.createQueryBuilder.mockReturnValue(
        queryBuilder,
      );

      const query = { page: 1, limit: 20, search: "test" };
      await service.listResultsPaginated("project-1", baseExperiment.id, query);

      expect(queryBuilder.andWhere).toHaveBeenCalledWith(
        "(result.result ILIKE :search OR datasetRow.values::text ILIKE :search)",
        { search: "%test%" },
      );
    });

    it("should apply sorting when provided", async () => {
      const queryBuilder = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getCount: jest.fn().mockResolvedValue(0),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      };

      mockExperimentRepository.findOne.mockResolvedValue(baseExperiment);
      mockExperimentResultRepository.createQueryBuilder.mockReturnValue(
        queryBuilder,
      );

      const query = { page: 1, limit: 20, sortBy: "result", sortOrder: "asc" };
      await service.listResultsPaginated("project-1", baseExperiment.id, query);

      expect(queryBuilder.orderBy).toHaveBeenCalledWith("result.result", "ASC");
    });
  });
});
