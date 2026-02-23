import { Prompt } from "../entities/prompt.entity";
import { PromptResponseDto } from "../dto/response/prompt-response.dto";

export class PromptMapper {
  static toEntity(params: {
    name: string;
    description: string | null;
    metadata: Record<string, unknown>;
    projectId: string;
  }): Partial<Prompt> {
    return {
      name: params.name,
      description: params.description,
      metadata: params.metadata,
      projectId: params.projectId,
    };
  }
  static toDto(prompt: Prompt): PromptResponseDto {
    return {
      id: prompt.id,
      name: prompt.name,
      description: prompt.description,
      metadata: prompt.metadata,
      promotedVersionId: prompt.promotedVersionId ?? null,
      createdAt: prompt.createdAt.toISOString(),
      updatedAt: prompt.updatedAt.toISOString(),
    };
  }
}
