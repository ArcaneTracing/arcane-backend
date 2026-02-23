import { BadRequestException } from "@nestjs/common";
import { UpdateScoreRequestDto } from "../dto/request/update-score-request.dto";
import { Score, ScoringType } from "../entities/score.entity";

export class ScoreUpdater {
  static apply(score: Score, dto: UpdateScoreRequestDto): Score {
    ScoreUpdater.applyBasicFields(score, dto);
    ScoreUpdater.applyScale(score, dto);
    ScoreUpdater.applyOrdinalConfig(score, dto);
    return score;
  }

  private static applyBasicFields(
    score: Score,
    dto: UpdateScoreRequestDto,
  ): void {
    if (dto.name !== undefined) {
      score.name = dto.name;
    }

    if (dto.description !== undefined) {
      score.description = dto.description;
    }
  }

  private static applyScale(score: Score, dto: UpdateScoreRequestDto): void {
    if (dto.scale !== undefined) {
      if (
        score.scoringType !== ScoringType.NOMINAL &&
        score.scoringType !== ScoringType.ORDINAL
      ) {
        throw new BadRequestException(
          "Scale can only be updated for nominal or ordinal scores",
        );
      }

      if (Array.isArray(dto.scale) && dto.scale.length === 0) {
        throw new BadRequestException("Scale must contain at least 1 elements");
      }
      score.scale = dto.scale;
    }
  }

  private static applyOrdinalConfig(
    score: Score,
    dto: UpdateScoreRequestDto,
  ): void {
    if (dto.ordinalConfig !== undefined) {
      if (score.scoringType !== ScoringType.ORDINAL) {
        if (dto.ordinalConfig !== null) {
          throw new BadRequestException(
            "OrdinalConfig can only be updated for ordinal scores",
          );
        }

        return;
      }
      score.ordinalConfig = dto.ordinalConfig || null;
    }
  }
}
