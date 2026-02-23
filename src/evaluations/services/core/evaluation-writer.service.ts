import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import {
  ERROR_MESSAGES,
  formatError,
} from "../../../common/constants/error-messages.constants";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Evaluation, EvaluationScope } from "../../entities/evaluation.entity";
import { ScoringType } from "../../../scores/entities/score.entity";
import { CreateEvaluationRequestDto } from "../../dto/request/create-evaluation-request.dto";
import { EvaluationLoaderService } from "./evaluation-loader.service";
import { EvaluationJobsService } from "./evaluation-jobs.service";
import { AuditService } from "../../../audit/audit.service";
import { Dataset } from "../../../datasets/entities/dataset.entity";

@Injectable()
export class EvaluationWriterService {
  private readonly logger = new Logger(EvaluationWriterService.name);

  constructor(
    @InjectRepository(Evaluation)
    private readonly evaluationRepository: Repository<Evaluation>,
    private readonly evaluationLoaderService: EvaluationLoaderService,
    private readonly evaluationJobsService: EvaluationJobsService,
    private readonly auditService: AuditService,
  ) {}

  private toAuditState(e: Evaluation): Record<string, unknown> {
    return {
      id: e.id,
      name: e.name,
      description: e.description ?? null,
      projectId: e.projectId,
      evaluationType: e.evaluationType,
      evaluationScope: e.evaluationScope,
      datasetId: e.datasetId ?? null,
      createdById: e.createdById ?? null,
      ragasModelConfigurationId: e.ragasModelConfigurationId ?? null,
    };
  }

  async create(
    organisationId: string,
    projectId: string,
    dto: CreateEvaluationRequestDto,
    userId: string,
  ): Promise<Evaluation> {
    const scores = await this.evaluationLoaderService.loadScores(
      projectId,
      dto.scoreIds,
    );
    const hasRagasScores = scores.some(
      (score) => score.scoringType === ScoringType.RAGAS,
    );
    if (hasRagasScores && !dto.ragasModelConfigurationId) {
      throw new BadRequestException(
        formatError(ERROR_MESSAGES.RAGAS_MODEL_CONFIGURATION_REQUIRED),
      );
    }
    const experiments = await this.evaluationLoaderService.loadExperiments(
      projectId,
      dto.experimentIds || [],
    );
    let dataset: Dataset | null = null;
    if (dto.evaluationScope === EvaluationScope.DATASET && dto.datasetId) {
      dataset = await this.evaluationLoaderService.loadDataset(
        projectId,
        dto.datasetId,
      );
    } else if (
      dto.evaluationScope === EvaluationScope.EXPERIMENT &&
      experiments.length > 0
    ) {
      dataset = await this.evaluationLoaderService.loadDataset(
        projectId,
        experiments[0].datasetId,
      );
    }
    this.evaluationLoaderService.ensureScopeConfiguration(
      dto.evaluationScope,
      dataset,
      experiments,
    );

    const evaluation = this.evaluationRepository.create({
      projectId,
      evaluationType: dto.evaluationType,
      evaluationScope: dto.evaluationScope,
      name: dto.name,
      description: dto.description || null,
      datasetId: dataset?.id ?? null,
      dataset: dataset ?? undefined,
      scores,
      experiments,
      metadata: dto.metadata || null,
      scoreMappings: dto.scoreMappings || null,
      ragasModelConfigurationId: dto.ragasModelConfigurationId || null,
      createdById: userId,
    });

    const saved = await this.evaluationRepository.save(evaluation);

    await this.auditService.record({
      action: "evaluation.created",
      actorId: userId,
      actorType: "user",
      resourceType: "evaluation",
      resourceId: saved.id,
      organisationId,
      projectId,
      afterState: this.toAuditState(saved),
      metadata: { creatorId: userId, organisationId, projectId },
    });

    const withRelations =
      await this.evaluationLoaderService.loadEvaluationOrFail(
        organisationId,
        projectId,
        saved.id,
      );

    try {
      await this.evaluationJobsService.postScoreMappingsToQueue(
        withRelations,
        dataset,
        experiments,
      );
    } catch (error) {
      this.logger.error(
        `Failed to queue evaluation jobs for evaluation ${saved.id}: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }

    return withRelations;
  }

  async rerun(
    organisationId: string,
    projectId: string,
    evaluationId: string,
    userId: string,
  ): Promise<Evaluation> {
    const originalEvaluation = await this.evaluationRepository.findOne({
      where: { id: evaluationId, projectId },
      relations: ["scores", "experiments", "dataset", "project"],
    });

    if (!originalEvaluation) {
      throw new NotFoundException(
        formatError(
          ERROR_MESSAGES.EVALUATION_NOT_FOUND_IN_PROJECT,
          evaluationId,
        ),
      );
    }

    if (originalEvaluation.project.organisationId !== organisationId) {
      throw new NotFoundException(
        formatError(
          ERROR_MESSAGES.EVALUATION_NOT_FOUND_IN_ORGANISATION,
          evaluationId,
        ),
      );
    }

    const now = new Date();
    const rerunName = `Re-run ${originalEvaluation.name} ${now.toISOString()}`;

    const newEvaluation = this.evaluationRepository.create({
      name: rerunName,
      description: originalEvaluation.description,
      evaluationType: originalEvaluation.evaluationType,
      evaluationScope: originalEvaluation.evaluationScope,
      projectId: originalEvaluation.projectId,
      datasetId: originalEvaluation.datasetId,
      dataset: originalEvaluation.dataset,
      scores: originalEvaluation.scores,
      experiments: originalEvaluation.experiments,
      metadata: originalEvaluation.metadata,
      scoreMappings: originalEvaluation.scoreMappings,
      ragasModelConfigurationId: originalEvaluation.ragasModelConfigurationId,
      createdById: userId,
    });

    const saved = await this.evaluationRepository.save(newEvaluation);

    await this.auditService.record({
      action: "evaluation.rerun",
      actorId: userId,
      actorType: "user",
      resourceType: "evaluation",
      resourceId: saved.id,
      organisationId,
      projectId: saved.projectId,
      afterState: this.toAuditState(saved),
      metadata: {
        sourceEvaluationId: evaluationId,
        organisationId,
        projectId: saved.projectId,
        creatorId: userId,
      },
    });

    const withRelations =
      await this.evaluationLoaderService.loadEvaluationOrFail(
        organisationId,
        projectId,
        saved.id,
      );

    try {
      await this.evaluationJobsService.postScoreMappingsToQueue(
        withRelations,
        originalEvaluation.dataset,
        originalEvaluation.experiments || [],
      );
    } catch (error) {
      this.logger.error(
        `Failed to queue evaluation jobs for rerun ${saved.id}: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }

    return withRelations;
  }

  async remove(
    organisationId: string,
    projectId: string,
    evaluationId: string,
    userId?: string,
  ): Promise<void> {
    const evaluation = await this.evaluationRepository.findOne({
      where: { id: evaluationId, projectId },
      relations: ["project"],
    });

    if (!evaluation) {
      throw new NotFoundException(
        formatError(
          ERROR_MESSAGES.EVALUATION_NOT_FOUND_IN_PROJECT,
          evaluationId,
        ),
      );
    }

    if (evaluation.project.organisationId !== organisationId) {
      throw new NotFoundException(
        formatError(
          ERROR_MESSAGES.EVALUATION_NOT_FOUND_IN_ORGANISATION,
          evaluationId,
        ),
      );
    }

    const beforeState = this.toAuditState(evaluation);

    await this.evaluationRepository.remove(evaluation);

    await this.auditService.record({
      action: "evaluation.deleted",
      actorId: userId,
      actorType: "user",
      resourceType: "evaluation",
      resourceId: evaluationId,
      organisationId,
      projectId: evaluation.projectId,
      beforeState,
      afterState: null,
      metadata: { organisationId, projectId: evaluation.projectId },
    });
  }
}
