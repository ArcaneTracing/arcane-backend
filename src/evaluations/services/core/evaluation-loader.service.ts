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
import { In, IsNull, Repository } from "typeorm";
import { Evaluation, EvaluationScope } from "../../entities/evaluation.entity";
import { Score } from "../../../scores/entities/score.entity";
import { Experiment } from "../../../experiments/entities/experiment.entity";
import { Dataset } from "../../../datasets/entities/dataset.entity";

@Injectable()
export class EvaluationLoaderService {
  private readonly logger = new Logger(EvaluationLoaderService.name);

  constructor(
    @InjectRepository(Evaluation)
    private readonly evaluationRepository: Repository<Evaluation>,
    @InjectRepository(Score)
    private readonly scoreRepository: Repository<Score>,
    @InjectRepository(Experiment)
    private readonly experimentRepository: Repository<Experiment>,
    @InjectRepository(Dataset)
    private readonly datasetRepository: Repository<Dataset>,
  ) {}

  async loadScores(projectId: string, scoreIds: string[]): Promise<Score[]> {
    const scores = await this.scoreRepository.find({
      where: [
        {
          id: In(scoreIds),
          projectId,
        },
        {
          id: In(scoreIds),
          projectId: IsNull(),
        },
      ],
    });

    if (scores.length !== scoreIds.length) {
      throw new NotFoundException(formatError(ERROR_MESSAGES.SCORES_NOT_FOUND));
    }

    const projectScores = scores.filter((s) => s.projectId !== null);
    const invalidScores = projectScores.filter(
      (s) => s.projectId !== projectId,
    );
    if (invalidScores.length > 0) {
      throw new NotFoundException(
        formatError(ERROR_MESSAGES.SCORES_DOES_NOT_BELONG_TO_PROJECT),
      );
    }

    return scores;
  }

  async loadExperiments(
    projectId: string,
    experimentIds: string[],
  ): Promise<Experiment[]> {
    if (!experimentIds?.length) {
      return [];
    }

    const experiments = await this.experimentRepository.find({
      where: {
        id: In(experimentIds),
        projectId,
      },
    });

    if (experiments.length !== experimentIds.length) {
      throw new NotFoundException(
        formatError(ERROR_MESSAGES.EXPERIMENTS_NOT_FOUND),
      );
    }

    return experiments;
  }

  async loadDataset(
    projectId: string,
    datasetId?: string,
  ): Promise<Dataset | null> {
    if (!datasetId) {
      return null;
    }

    const dataset = await this.datasetRepository.findOne({
      where: { id: datasetId, projectId },
    });

    if (!dataset) {
      throw new NotFoundException(
        formatError(
          ERROR_MESSAGES.DATASET_NOT_FOUND_IN_PROJECT,
          datasetId,
          projectId,
        ),
      );
    }

    return dataset;
  }

  ensureScopeConfiguration(
    scope: EvaluationScope,
    dataset: Dataset | null,
    experiments: Experiment[],
  ): void {
    if (scope === EvaluationScope.DATASET && !dataset) {
      throw new BadRequestException("Dataset evaluations require a datasetId");
    }

    if (scope === EvaluationScope.EXPERIMENT && experiments.length === 0) {
      throw new BadRequestException(
        "Experiment evaluations require experimentIds",
      );
    }

    if (scope === EvaluationScope.EXPERIMENT && experiments.length > 0) {
      const datasetIds = new Set(experiments.map((exp) => exp.datasetId));
      if (datasetIds.size > 1) {
        throw new BadRequestException(
          "All experiments in an evaluation must have the same datasetId",
        );
      }
    }
  }

  async loadEvaluationOrFail(
    organisationId: string,
    projectId: string,
    evaluationId: string,
  ): Promise<Evaluation> {
    const evaluation = await this.evaluationRepository.findOne({
      where: { id: evaluationId, projectId },
      relations: ["scores", "experiments", "project"],
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

    return evaluation;
  }
}
