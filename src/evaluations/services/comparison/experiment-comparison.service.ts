import { BadRequestException, Injectable, Logger } from "@nestjs/common";
import {
  ERROR_MESSAGES,
  formatError,
} from "../../../common/constants/error-messages.constants";
import { Evaluation } from "../../entities/evaluation.entity";
import { ScoringType } from "../../../scores/entities/score.entity";
import { ExperimentComparisonRequestDto } from "../../dto/request/experiment-comparison-request.dto";
import { ExperimentComparisonResponseDto } from "../../dto/response/experiment-comparison-response.dto";
import { NominalComparisonUtil } from "../../utils/nominal-comparison.util";
import { OrdinalComparisonUtil } from "../../utils/ordinal-comparison.util";
import { NumericComparisonUtil } from "../../utils/numeric-comparison.util";
import { ExperimentComparisonDataBuilder } from "./experiment-comparison-data-builder.service";
import { EvaluationStatisticsStreamingService } from "../statistics/evaluation-statistics-streaming.service";

@Injectable()
export class ExperimentComparisonService {
  private readonly logger = new Logger(ExperimentComparisonService.name);

  constructor(
    private readonly dataBuilder: ExperimentComparisonDataBuilder,
    private readonly streamingService: EvaluationStatisticsStreamingService,
  ) {}

  async compareExperiments(
    evaluation: Evaluation,
    dto: ExperimentComparisonRequestDto,
  ): Promise<ExperimentComparisonResponseDto> {
    this.ensureExperimentsInEvaluation(evaluation, dto);
    const score = this.getScoreOrThrow(evaluation, dto.scoreId);

    if (score.scoringType === ScoringType.NOMINAL) {
      return this.compareNominalExperiments(evaluation, dto);
    }
    if (score.scoringType === ScoringType.ORDINAL) {
      return this.compareOrdinalExperiments(evaluation, dto);
    }

    const agg = await this.dataBuilder.getPairedNumericAggregates(
      dto.evaluationId,
      dto.scoreId,
      dto.experimentIdA,
      dto.experimentIdB,
    );
    if (agg) {
      return NumericComparisonUtil.compareFromAggregates(agg);
    }
    return this.emptyNumericComparison();
  }

  async compareNominalExperiments(
    evaluation: Evaluation,
    dto: ExperimentComparisonRequestDto,
  ): Promise<ExperimentComparisonResponseDto> {
    this.ensureExperimentsInEvaluation(evaluation, dto);
    const score = this.getScoreOrThrow(evaluation, dto.scoreId);
    if (score.scoringType !== ScoringType.NOMINAL) {
      throw new BadRequestException(
        formatError(ERROR_MESSAGES.SCORE_MUST_BE_OF_TYPE, "NOMINAL"),
      );
    }

    const changeTable = await this.dataBuilder.getPairedChangeTable(
      dto.evaluationId,
      dto.scoreId,
      dto.experimentIdA,
      dto.experimentIdB,
    );
    const n_paired = changeTable.reduce((s, r) => s + r.n, 0);

    if (n_paired === 0) {
      const nominalResult = NominalComparisonUtil.compareFromChangeTable([], 0);
      return {
        numeric: null,
        nominal: nominalResult,
        ordinal: null,
      };
    }

    const nominalResult = NominalComparisonUtil.compareFromChangeTable(
      changeTable,
      n_paired,
    );
    return {
      numeric: null,
      nominal: nominalResult,
      ordinal: null,
    };
  }

  async compareOrdinalExperiments(
    evaluation: Evaluation,
    dto: ExperimentComparisonRequestDto,
  ): Promise<ExperimentComparisonResponseDto> {
    this.ensureExperimentsInEvaluation(evaluation, dto);
    const score = this.getScoreOrThrow(evaluation, dto.scoreId);
    if (score.scoringType !== ScoringType.ORDINAL) {
      throw new BadRequestException(
        formatError(ERROR_MESSAGES.SCORE_MUST_BE_OF_TYPE, "ORDINAL"),
      );
    }

    const valuesA: string[] = [];
    const valuesB: string[] = [];

    for await (const batch of this.streamingService.streamPairedRows(
      dto.evaluationId,
      dto.scoreId,
      dto.experimentIdA,
      dto.experimentIdB,
    )) {
      for (const pair of batch) {
        valuesA.push(pair.valueA);
        valuesB.push(pair.valueB);
      }
    }

    const n_paired = valuesA.length;

    if (n_paired === 0) {
      const ordinalResult = OrdinalComparisonUtil.compare(
        [],
        [],
        0,
        score.scale || null,
        score.ordinalConfig || null,
        this.logger,
      );
      return {
        numeric: null,
        nominal: null,
        ordinal: ordinalResult,
      };
    }

    const ordinalResult = OrdinalComparisonUtil.compare(
      valuesA,
      valuesB,
      n_paired,
      score.scale || null,
      score.ordinalConfig || null,
      this.logger,
    );
    return {
      numeric: null,
      nominal: null,
      ordinal: ordinalResult,
    };
  }

  private ensureExperimentsInEvaluation(
    evaluation: Evaluation,
    dto: ExperimentComparisonRequestDto,
  ): void {
    const evaluationExperiments = evaluation.experiments || [];
    const experimentIds = new Set(evaluationExperiments.map((e) => e.id));
    if (
      !experimentIds.has(dto.experimentIdA) ||
      !experimentIds.has(dto.experimentIdB)
    ) {
      throw new BadRequestException(
        formatError(ERROR_MESSAGES.BOTH_EXPERIMENTS_MUST_BELONG_TO_EVALUATION),
      );
    }
  }

  private getScoreOrThrow(evaluation: Evaluation, scoreId: string) {
    const evaluationScores = evaluation.scores || [];
    const scoreIds = evaluationScores.map((s) => s.id);
    if (!scoreIds.includes(scoreId)) {
      throw new BadRequestException(
        formatError(ERROR_MESSAGES.SCORE_MUST_BELONG_TO_EVALUATION),
      );
    }
    const score = evaluationScores.find((s) => s.id === scoreId);
    if (!score) {
      throw new BadRequestException(
        formatError(ERROR_MESSAGES.SCORE_NOT_FOUND_IN_EVALUATION),
      );
    }
    return score;
  }

  private emptyNumericComparison(): ExperimentComparisonResponseDto {
    return {
      numeric: {
        n_paired: 0,
        mean_a: null,
        mean_b: null,
        delta_mean: null,
        ci95_delta: { lower: null, upper: null },
        p_value_permutation: null,
        cohens_dz: null,
        win_rate: null,
        loss_rate: null,
        tie_rate: null,
      },
      nominal: null,
      ordinal: null,
    };
  }
}
