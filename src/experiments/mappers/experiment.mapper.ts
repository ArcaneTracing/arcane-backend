import { Experiment, PromptInputMappings } from "../entities/experiment.entity";
import { ExperimentResult } from "../entities/experiment-result.entity";
import {
  ExperimentResponseDto,
  ExperimentResultResponseDto,
} from "../dto/response/experiment-response.dto";
import { PromptVersion } from "../../prompts/entities/prompt-version.entity";
import { Dataset } from "../../datasets/entities/dataset.entity";

export class ExperimentMapper {
  static toEntity(params: {
    projectId: string;
    promptVersion: PromptVersion;
    dataset: Dataset;
    userId: string;
    name: string;
    description?: string | null;
    promptInputMappings?: PromptInputMappings;
  }): Partial<Experiment> {
    return {
      name: params.name,
      description: params.description,
      promptVersionId: params.promptVersion.id,
      promptVersion: params.promptVersion,
      datasetId: params.dataset.id,
      dataset: params.dataset,
      projectId: params.projectId,
      promptInputMappings: params.promptInputMappings || {},
      createdById: params.userId,
    };
  }

  static toResultDto(result: ExperimentResult): ExperimentResultResponseDto {
    return {
      id: result.id,
      datasetRowId: result.datasetRowId,
      result: result.result,
      status: result.status,
      createdAt: result.createdAt,
    };
  }

  static toDto(
    experiment: Experiment,
    includeResults = false,
  ): ExperimentResponseDto {
    return {
      id: experiment.id,
      projectId: experiment.projectId,
      name: experiment.name,
      description: experiment.description,
      promptVersionId: experiment.promptVersionId,
      datasetId: experiment.datasetId,
      promptInputMappings: experiment.promptInputMappings || {},
      createdAt: experiment.createdAt,
      updatedAt: experiment.updatedAt,
      results: includeResults
        ? (experiment.results || []).map((result) => this.toResultDto(result))
        : undefined,
    };
  }
}
