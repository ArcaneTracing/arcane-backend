import { CreateScoreRequestDto } from "../dto/request/create-score-request.dto";
import { ScoreResponseDto } from "../dto/response/score-response.dto";
import { Score, ScoringType } from "../entities/score.entity";
import { Prompt } from "../../prompts/entities/prompt.entity";

export class ScoreMapper {
  static toEntity(
    dto: CreateScoreRequestDto,
    projectId: string,
    userId: string,
    evaluatorPrompt?: Prompt | null,
  ): Partial<Score> {
    return {
      name: dto.name,
      description: dto.description,
      scoringType: dto.scoringType,
      scale:
        dto.scoringType === ScoringType.NOMINAL ||
        dto.scoringType === ScoringType.ORDINAL
          ? dto.scale || null
          : null,
      ordinalConfig:
        dto.scoringType === ScoringType.ORDINAL
          ? dto.ordinalConfig || null
          : null,
      evaluatorPromptId: evaluatorPrompt?.id ?? null,
      evaluatorPrompt: evaluatorPrompt ?? undefined,
      projectId: projectId,
      createdById: userId,
    };
  }

  static toDto(score: Score): ScoreResponseDto {
    return {
      id: score.id,
      projectId: score.projectId ?? null,
      name: score.name,
      description: score.description,
      scoringType: score.scoringType,
      scale: score.scale || null,
      ordinalConfig: score.ordinalConfig || null,
      ragasScoreKey: score.ragasScoreKey || null,
      evaluatorPrompt: score.evaluatorPrompt
        ? {
            id: score.evaluatorPrompt.id,
            name: score.evaluatorPrompt.name,
          }
        : null,
      createdAt: score.createdAt,
      updatedAt: score.updatedAt,
    };
  }
}
