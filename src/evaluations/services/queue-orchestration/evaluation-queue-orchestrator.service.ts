import { Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { In, Repository } from "typeorm";
import { Evaluation, EvaluationScope } from "../../entities/evaluation.entity";
import { Score, ScoringType } from "../../../scores/entities/score.entity";
import {
  ScoreResult,
  ScoreResultStatus,
} from "../../entities/score-result.entity";
import { PromptVersion } from "../../../prompts/entities/prompt-version.entity";
import { Dataset } from "../../../datasets/entities/dataset.entity";
import { Experiment } from "../../../experiments/entities/experiment.entity";
import { EvaluationQueueService } from "../../queue/evaluation-queue.service";
import { PromptVersionsService } from "../../../prompts/services/prompt-versions.service";
import { ScoreMappingFillerService } from "../results/score-mapping-filler.service";
@Injectable()
export class EvaluationQueueOrchestrator {
  private readonly logger = new Logger(EvaluationQueueOrchestrator.name);

  constructor(
    @InjectRepository(ScoreResult)
    private readonly scoreResultRepository: Repository<ScoreResult>,
    @InjectRepository(Score)
    private readonly scoreRepository: Repository<Score>,
    private readonly promptVersionsService: PromptVersionsService,
    private readonly evaluationQueueService: EvaluationQueueService,
    private readonly scoreMappingFillerService: ScoreMappingFillerService,
  ) {}

  async postEvaluationToQueue(
    evaluation: Evaluation,
    dataset: Dataset | null,
    experiments: Experiment[],
  ): Promise<void> {
    if (!evaluation.scoreMappings) {
      return;
    }

    const hasRagasScores = (evaluation.scores || []).some(
      (score) => score.scoringType === ScoringType.RAGAS,
    );
    if (hasRagasScores && !evaluation.ragasModelConfigurationId) {
      this.logger.warn(
        `Evaluation ${evaluation.id} has RAGAS scores but no ragasModelConfigurationId - skipping queue posting`,
      );
      return;
    }

    try {
      const filledScoreMappings = await this.fillScoreMappings(
        evaluation,
        dataset,
        experiments,
      );

      const scoreIdsFromFilledMappings = new Set(
        filledScoreMappings.map((m) => m.scoreId as string),
      );
      const manualScores = (evaluation.scores || []).filter(
        (s) => !scoreIdsFromFilledMappings.has(s.id),
      );

      const manualPendingResultSpecs: Record<string, unknown>[] = [];
      if (manualScores.length > 0) {
        const rowResultPairs =
          await this.scoreMappingFillerService.getRowResultPairsForScope(
            evaluation.evaluationScope,
            dataset,
            experiments,
          );
        for (const score of manualScores) {
          for (const pair of rowResultPairs) {
            manualPendingResultSpecs.push({
              scoreId: score.id,
              scoringType: score.scoringType,
              datasetRowId: pair.datasetRowId,
              experimentResultId: pair.experimentResultId,
            });
          }
        }
      }

      const allPendingSpecs = [
        ...filledScoreMappings,
        ...manualPendingResultSpecs,
      ];
      if (allPendingSpecs.length === 0) {
        this.logger.warn(
          `No pending results to create for evaluation ${evaluation.id}`,
        );
        return;
      }

      await this.createPendingScoreResults(evaluation, allPendingSpecs);

      const { promptVersionMap } = await this.resolvePromptVersionsAndConfigs(
        evaluation.projectId,
        filledScoreMappings,
        evaluation.scores || [],
      );

      const queueableMappings = filledScoreMappings.filter((m) => {
        const scoreId = m.scoreId as string;
        const scoringType = m.scoringType as string;
        if (scoringType === ScoringType.RAGAS) return true;
        return promptVersionMap.has(scoreId);
      });

      if (queueableMappings.length > 0) {
        await this.buildAndPostQueueMessages(
          evaluation,
          queueableMappings,
          promptVersionMap,
        );
      }
    } catch (error: any) {
      this.logger.error(
        `Failed to post evaluation ${evaluation.id} to RabbitMQ: ${error.message}`,
        error.stack,
      );
    }
  }

  private async fillScoreMappings(
    evaluation: Evaluation,
    dataset: Dataset | null,
    experiments: Experiment[],
  ): Promise<Record<string, unknown>[]> {
    if (evaluation.evaluationScope === EvaluationScope.DATASET && dataset) {
      return this.scoreMappingFillerService.fillScoreMappingsForDataset(
        evaluation.scoreMappings || {},
        dataset,
        evaluation.scores || [],
      );
    }
    if (
      evaluation.evaluationScope === EvaluationScope.EXPERIMENT &&
      experiments.length > 0
    ) {
      return this.scoreMappingFillerService.fillScoreMappingsForExperiments(
        evaluation.scoreMappings || {},
        experiments,
        evaluation.scores || [],
      );
    }
    return [];
  }

  async createPendingScoreResults(
    evaluation: Evaluation,
    filledScoreMappings: Record<string, unknown>[],
  ): Promise<ScoreResult[]> {
    const pendingResults = filledScoreMappings.map((scoreMapping) => {
      const scoreId = scoreMapping.scoreId as string;
      const datasetRowId = (scoreMapping.datasetRowId as string) || null;
      const experimentResultId =
        (scoreMapping.experimentResultId as string) || null;

      return this.scoreResultRepository.create({
        evaluationId: evaluation.id,
        scoreId,
        datasetRowId,
        experimentResultId,
        value: null,
        reasoning: null,
        status: ScoreResultStatus.PENDING,
      });
    });

    const savedResults = await this.scoreResultRepository.save(pendingResults);
    this.logger.log(
      `Created ${savedResults.length} PENDING results for evaluation ${evaluation.id}`,
    );

    return savedResults;
  }

  async resolvePromptVersionsAndConfigs(
    projectId: string,
    filledScoreMappings: Record<string, unknown>[],
    scores: Score[],
  ): Promise<{
    promptVersionMap: Map<string, PromptVersion>;
  }> {
    const scoreIds = [
      ...new Set(filledScoreMappings.map((m) => m.scoreId as string)),
    ];
    const scoresWithPrompts = await this.scoreRepository.find({
      where: { id: In(scoreIds) },
      relations: ["evaluatorPrompt"],
    });

    const promptVersionMap = new Map<string, PromptVersion>();

    for (const score of scoresWithPrompts) {
      if (score.scoringType !== ScoringType.RAGAS) {
        if (!score.evaluatorPromptId || !score.evaluatorPrompt) {
          this.logger.warn(
            `Score ${score.id} (${score.scoringType}) does not have an evaluatorPrompt configured. ` +
              `This will cause an error when queuing the job.`,
          );
          continue;
        }

        let latestVersion: PromptVersion | null = null;
        try {
          latestVersion =
            await this.promptVersionsService.getLatestVersionEntity(
              projectId,
              score.evaluatorPrompt.id,
            );
        } catch {
          latestVersion = null;
        }

        if (!latestVersion) {
          this.logger.warn(
            `Score ${score.id} has evaluatorPrompt ${score.evaluatorPrompt.id} but no prompt versions found. ` +
              `This will cause an error when queuing the job.`,
          );
          continue;
        }

        if (
          !latestVersion.modelConfigurationId ||
          !latestVersion.modelConfiguration
        ) {
          this.logger.warn(
            `Prompt version ${latestVersion.id} for score ${score.id} does not have a modelConfiguration. ` +
              `This will cause an error when queuing the job.`,
          );
          continue;
        }

        promptVersionMap.set(score.id, latestVersion);
      }
    }

    return { promptVersionMap };
  }

  private async buildAndPostQueueMessages(
    evaluation: Evaluation,
    filledScoreMappings: Record<string, unknown>[],
    promptVersionMap: Map<string, PromptVersion>,
  ): Promise<void> {
    const messagePromises = filledScoreMappings.map(
      async (scoreMapping, index) => {
        const scoreId = scoreMapping.scoreId as string;
        const scoringType = scoreMapping.scoringType as string;
        const datasetRowId = (scoreMapping.datasetRowId as string) || null;
        const experimentResultId =
          (scoreMapping.experimentResultId as string) || null;
        const ragasScoreKey = (scoreMapping.ragasScoreKey as string) || null;

        const cleanScoreMapping: Record<string, unknown> = { ...scoreMapping };
        delete cleanScoreMapping.scoreId;
        delete cleanScoreMapping.scoringType;
        delete cleanScoreMapping.datasetRowId;
        delete cleanScoreMapping.experimentResultId;
        delete cleanScoreMapping.ragasScoreKey;

        let promptId: string | null = null;

        if (scoringType !== ScoringType.RAGAS) {
          const promptVersionEntity = promptVersionMap.get(scoreId);

          if (!promptVersionEntity?.modelConfigurationId) {
            this.logger.warn(
              `Skipping score ${scoreId} (${scoringType}) - no evaluatorPrompt or prompt version with model configuration. ` +
                `Manual scores are not queued; enter results in the evaluation detailed view.`,
            );
            return { success: true, messageId: null, index };
          }

          promptId = promptVersionEntity.promptId;
        }

        return this.evaluationQueueService
          .addJob({
            evaluationId: evaluation.id,
            ragasModelConfigurationId:
              evaluation.ragasModelConfigurationId || null,
            scoreId,
            scoringType,
            datasetRowId,
            experimentResultId,
            ragasScoreKey: ragasScoreKey || null,
            scoreMapping: cleanScoreMapping,
            promptId,
          })
          .then((messageId) => {
            this.logger.debug(
              `Successfully queued message ${index + 1}/${filledScoreMappings.length}: ${messageId}`,
            );
            return { success: true, messageId, index };
          })
          .catch((error: any) => {
            this.logger.error(
              `Failed to queue message ${index + 1}/${filledScoreMappings.length} for evaluation ${evaluation.id}: ${error.message}`,
              error.stack,
            );
            return { success: false, error: error.message, index };
          });
      },
    );

    const results = await Promise.allSettled(messagePromises);
    const successful = results.filter(
      (r) => r.status === "fulfilled" && r.value.success,
    ).length;
    const failed = results.length - successful;

    if (successful > 0) {
      this.logger.log(
        `Posted ${successful}/${filledScoreMappings.length} messages to RabbitMQ for evaluation ${evaluation.id}`,
      );
    }

    if (failed > 0) {
      this.logger.error(
        `Failed to post ${failed}/${filledScoreMappings.length} messages to RabbitMQ for evaluation ${evaluation.id}`,
      );
      results.forEach((result, index) => {
        const scoreMapping = filledScoreMappings[index];
        const scoreId = scoreMapping.scoreId as string;
        const datasetRowId = scoreMapping.datasetRowId as string | null;
        const experimentResultId = scoreMapping.experimentResultId as
          | string
          | null;

        if (
          result.status === "fulfilled" &&
          !result.value.success &&
          "error" in result.value
        ) {
          this.logger.error(
            `Failed message details - scoreId: ${scoreId}, datasetRowId: ${datasetRowId}, experimentResultId: ${experimentResultId}, error: ${result.value.error}`,
          );
        } else if (result.status === "rejected") {
          this.logger.error(
            `Failed message details - scoreId: ${scoreId}, datasetRowId: ${datasetRowId}, experimentResultId: ${experimentResultId}, error: ${result.reason}`,
          );
        }
      });
    }
  }
}
