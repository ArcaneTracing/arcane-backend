import { ExperimentMapper } from "../../../src/experiments/mappers/experiment.mapper";
import { Experiment } from "../../../src/experiments/entities/experiment.entity";
import {
  ExperimentResult,
  ExperimentResultStatus,
} from "../../../src/experiments/entities/experiment-result.entity";
import { PromptVersion } from "../../../src/prompts/entities/prompt-version.entity";
import { Dataset } from "../../../src/datasets/entities/dataset.entity";

describe("ExperimentMapper", () => {
  const promptVersion: PromptVersion = {
    id: "prompt-version-1",
    promptId: "prompt-1",
  } as PromptVersion;

  const dataset: Dataset = {
    id: "dataset-1",
  } as Dataset;

  it("should map to entity", () => {
    const result = ExperimentMapper.toEntity({
      projectId: "project-1",
      promptVersion,
      dataset,
      userId: "user-1",
      name: "Experiment",
      description: "desc",
      promptInputMappings: { col1: "input1" },
    });

    expect(result).toEqual(
      expect.objectContaining({
        name: "Experiment",
        description: "desc",
        promptVersionId: "prompt-version-1",
        datasetId: "dataset-1",
        projectId: "project-1",
        promptInputMappings: { col1: "input1" },
        createdById: "user-1",
      }),
    );
  });

  it("should map to dto without results", () => {
    const experiment: Experiment = {
      id: "experiment-1",
      projectId: "project-1",
      name: "Experiment",
      description: null,
      promptVersionId: "prompt-version-1",
      datasetId: "dataset-1",
      promptInputMappings: {},
      createdAt: new Date(),
      updatedAt: new Date(),
    } as Experiment;

    const dto = ExperimentMapper.toDto(experiment);

    expect(dto.results).toBeUndefined();
    expect(dto.id).toBe("experiment-1");
  });

  it("should map to dto with results", () => {
    const result: ExperimentResult = {
      id: "result-1",
      datasetRowId: "row-1",
      result: "ok",
      status: ExperimentResultStatus.DONE,
      createdAt: new Date(),
    } as ExperimentResult;
    const experiment: Experiment = {
      id: "experiment-1",
      projectId: "project-1",
      name: "Experiment",
      description: null,
      promptVersionId: "prompt-version-1",
      datasetId: "dataset-1",
      promptInputMappings: {},
      results: [result],
      createdAt: new Date(),
      updatedAt: new Date(),
    } as Experiment;

    const dto = ExperimentMapper.toDto(experiment, true);

    expect(dto.results).toHaveLength(1);
    expect(dto.results?.[0].id).toBe("result-1");
  });
});
