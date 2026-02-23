import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { IsNull, Repository } from "typeorm";
import { RAGAS_SCORES } from "../constants/ragas.constants";
import { Score, ScoringType } from "../entities/score.entity";

@Injectable()
export class ScoresRagasService implements OnModuleInit {
  private readonly logger = new Logger(ScoresRagasService.name);

  constructor(
    @InjectRepository(Score)
    private readonly scoreRepository: Repository<Score>,
  ) {}

  async upsertGlobalRagasScores(): Promise<void> {
    this.logger.debug("Upserting global ragas scores");

    const existingRagasScores = await this.scoreRepository.find({
      where: {
        projectId: IsNull(),
        scoringType: ScoringType.RAGAS,
      },
    });

    const existingKeys = new Set(
      existingRagasScores
        .map((s) => s.ragasScoreKey)
        .filter((key) => key !== null),
    );

    const scoresToUpsert = Object.entries(RAGAS_SCORES).map(
      ([name, ragasScore]) => {
        const existingScore = existingRagasScores.find(
          (s) => s.ragasScoreKey === ragasScore.id,
        );

        if (existingScore) {
          existingScore.name = name;
          existingScore.description = `Ragas metric: ${name}`;
          return existingScore;
        }

        return this.scoreRepository.create({
          projectId: null,
          project: null,
          name,
          description: `Ragas metric: ${name}`,
          scoringType: ScoringType.RAGAS,
          ragasScoreKey: ragasScore.id,
          scale: null,
          evaluatorPromptId: null,
          createdById: null,
        });
      },
    );

    if (scoresToUpsert.length > 0) {
      await this.scoreRepository.save(scoresToUpsert);
      const createdCount = scoresToUpsert.filter(
        (s) => !existingKeys.has(s.ragasScoreKey),
      ).length;
      const updatedCount = scoresToUpsert.length - createdCount;
      this.logger.log(
        `Upserted ${scoresToUpsert.length} global ragas scores (${createdCount} created, ${updatedCount} updated)`,
      );
    }
  }

  async onModuleInit(): Promise<void> {
    try {
      await this.upsertGlobalRagasScores();
    } catch (error: any) {
      this.logger.error(
        `Failed to upsert global ragas scores at startup: ${error.message}`,
        error.stack,
      );
    }
  }
}
