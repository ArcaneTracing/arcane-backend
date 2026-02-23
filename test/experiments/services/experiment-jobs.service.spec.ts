import { NotFoundException } from "@nestjs/common";
import { ExperimentJobsService } from "../../../src/experiments/services/experiment-jobs.service";
import { Experiment } from "../../../src/experiments/entities/experiment.entity";
import { DatasetRow } from "../../../src/datasets/entities/dataset-row.entity";
import { Dataset } from "../../../src/datasets/entities/dataset.entity";
import { PromptVersion } from "../../../src/prompts/entities/prompt-version.entity";
import {
  ERROR_MESSAGES,
  formatError,
} from "../../../src/common/constants/error-messages.constants";

describe("ExperimentJobsService", () => {
  const mockExperimentResultRepository = {
    create: jest.fn(),
    save: jest.fn(),
  };

  const mockDatasetRowRepository = {
    find: jest.fn(),
  };

  const mockDatasetRepository = {
    findOne: jest.fn(),
  };

  const mockPromptVersionRepository = {
    findOne: jest.fn(),
  };

  const mockExperimentQueueService = {
    addJobs: jest.fn(),
  };

  const baseExperiment: Experiment = {
    id: "experiment-1",
    datasetId: "dataset-1",
    promptVersionId: "prompt-version-1",
    promptInputMappings: { col1: "input1", col2: "input2" },
  } as unknown as Experiment;

  const baseDataset: Dataset = {
    id: "dataset-1",
    header: ["col1", "col2", "col3"],
  } as Dataset;

  const basePromptVersion: PromptVersion = {
    id: "prompt-version-1",
    promptId: "prompt-1",
    prompt: { id: "prompt-1", name: "Prompt" } as any,
    modelConfigurationId: "model-config-1",
    modelConfiguration: {
      id: "model-config-1",
      name: "Config",
      configuration: { apiKey: "secret", foo: "bar" },
      createdAt: new Date("2024-01-01T00:00:00.000Z"),
      updatedAt: new Date("2024-01-01T00:00:00.000Z"),
    } as any,
    createdAt: new Date("2024-01-01T00:00:00.000Z"),
    updatedAt: new Date("2024-01-02T00:00:00.000Z"),
  } as PromptVersion;

  let service: ExperimentJobsService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ExperimentJobsService(
      mockExperimentResultRepository as any,
      mockDatasetRowRepository as any,
      mockDatasetRepository as any,
      mockPromptVersionRepository as any,
      mockExperimentQueueService as any,
    );
  });

  it("should return early when there are no dataset rows", async () => {
    mockDatasetRowRepository.find.mockResolvedValueOnce([]);
    mockPromptVersionRepository.findOne.mockResolvedValue(basePromptVersion);
    mockDatasetRepository.findOne.mockResolvedValue(baseDataset);

    await service.queueForExperiment(baseExperiment);

    expect(mockExperimentResultRepository.save).not.toHaveBeenCalled();
    expect(mockExperimentQueueService.addJobs).not.toHaveBeenCalled();
  });

  it("should create pending results and enqueue jobs for a single batch", async () => {
    const rows: DatasetRow[] = [
      {
        id: "row-1",
        values: ["v1", "v2", "v3"],
        datasetId: baseDataset.id,
      } as DatasetRow,
      {
        id: "row-2",
        values: ["a1", "a2", undefined],
        datasetId: baseDataset.id,
      } as DatasetRow,
    ];

    mockDatasetRowRepository.find
      .mockResolvedValueOnce(rows)
      .mockResolvedValueOnce([]);
    mockExperimentResultRepository.create.mockImplementation((input) => input);
    mockExperimentResultRepository.save.mockResolvedValue([]);
    mockPromptVersionRepository.findOne.mockResolvedValue(basePromptVersion);
    mockDatasetRepository.findOne.mockResolvedValue(baseDataset);
    mockExperimentQueueService.addJobs.mockResolvedValue(["job-1", "job-2"]);

    await service.queueForExperiment(baseExperiment);

    expect(mockDatasetRowRepository.find).toHaveBeenCalledWith({
      where: { datasetId: baseExperiment.datasetId },
      skip: 0,
      take: 1000,
    });
    expect(mockExperimentResultRepository.save).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          experimentId: baseExperiment.id,
          datasetRowId: "row-1",
        }),
        expect.objectContaining({
          experimentId: baseExperiment.id,
          datasetRowId: "row-2",
        }),
      ]),
    );
    expect(mockExperimentQueueService.addJobs).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          experimentId: baseExperiment.id,
          datasetRowId: "row-1",
          inputs: { input1: "v1", input2: "v2" },
          promptId: "prompt-1",
        }),
      ]),
    );
  });

  it("should process multiple batches when dataset has more than BATCH_SIZE rows", async () => {
    const batch1: DatasetRow[] = Array.from({ length: 1000 }, (_, i) => ({
      id: `row-${i + 1}`,
      values: [`v${i + 1}-1`, `v${i + 1}-2`],
      datasetId: baseDataset.id,
    })) as DatasetRow[];

    const batch2: DatasetRow[] = Array.from({ length: 500 }, (_, i) => ({
      id: `row-${i + 1001}`,
      values: [`v${i + 1001}-1`, `v${i + 1001}-2`],
      datasetId: baseDataset.id,
    })) as DatasetRow[];

    mockDatasetRowRepository.find
      .mockResolvedValueOnce(batch1)
      .mockResolvedValueOnce(batch2)
      .mockResolvedValueOnce([]);
    mockExperimentResultRepository.create.mockImplementation((input) => input);
    mockExperimentResultRepository.save.mockResolvedValue([]);
    mockPromptVersionRepository.findOne.mockResolvedValue(basePromptVersion);
    mockDatasetRepository.findOne.mockResolvedValue(baseDataset);
    mockExperimentQueueService.addJobs.mockResolvedValue([]);

    await service.queueForExperiment(baseExperiment);

    expect(mockDatasetRowRepository.find).toHaveBeenCalledTimes(3);
    expect(mockDatasetRowRepository.find).toHaveBeenNthCalledWith(1, {
      where: { datasetId: baseExperiment.datasetId },
      skip: 0,
      take: 1000,
    });
    expect(mockDatasetRowRepository.find).toHaveBeenNthCalledWith(2, {
      where: { datasetId: baseExperiment.datasetId },
      skip: 1000,
      take: 1000,
    });
    expect(mockDatasetRowRepository.find).toHaveBeenNthCalledWith(3, {
      where: { datasetId: baseExperiment.datasetId },
      skip: 2000,
      take: 1000,
    });

    expect(mockExperimentResultRepository.save).toHaveBeenCalledTimes(2);
    expect(mockExperimentResultRepository.save).toHaveBeenNthCalledWith(
      1,
      expect.arrayContaining(
        batch1.map((row) => expect.objectContaining({ datasetRowId: row.id })),
      ),
    );
    expect(mockExperimentResultRepository.save).toHaveBeenNthCalledWith(
      2,
      expect.arrayContaining(
        batch2.map((row) => expect.objectContaining({ datasetRowId: row.id })),
      ),
    );

    expect(mockExperimentQueueService.addJobs).toHaveBeenCalledTimes(2);
  });

  it("should throw when prompt version is missing", async () => {
    mockPromptVersionRepository.findOne.mockResolvedValue(null);

    await expect(service.queueForExperiment(baseExperiment)).rejects.toThrow(
      new NotFoundException(
        `Prompt version ${baseExperiment.promptVersionId} not found`,
      ),
    );
    expect(mockDatasetRowRepository.find).not.toHaveBeenCalled();
  });

  it("should throw when prompt version has no model configuration", async () => {
    const promptVersionNoModel = {
      ...basePromptVersion,
      modelConfiguration: null,
    };
    mockPromptVersionRepository.findOne.mockResolvedValue(promptVersionNoModel);

    await expect(service.queueForExperiment(baseExperiment)).rejects.toThrow(
      formatError(
        ERROR_MESSAGES.MODEL_CONFIGURATION_NOT_FOUND_FOR_PROMPT_VERSION,
        baseExperiment.promptVersionId,
      ),
    );
    expect(mockDatasetRowRepository.find).not.toHaveBeenCalled();
  });

  it("should throw when dataset is missing", async () => {
    mockPromptVersionRepository.findOne.mockResolvedValue(basePromptVersion);
    mockDatasetRepository.findOne.mockResolvedValue(null);

    await expect(service.queueForExperiment(baseExperiment)).rejects.toThrow(
      formatError(ERROR_MESSAGES.DATASET_NOT_FOUND, baseDataset.id),
    );
    expect(mockDatasetRowRepository.find).not.toHaveBeenCalled();
  });
});
