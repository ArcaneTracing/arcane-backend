import {
  Inject,
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { CACHE_MANAGER } from "@nestjs/cache-manager";
import { Cache } from "cache-manager";
import {
  ERROR_MESSAGES,
  formatError,
} from "../../../common/constants/error-messages.constants";
import { InjectRepository } from "@nestjs/typeorm";
import { In, IsNull, Not, Repository } from "typeorm";
import { Evaluation, EvaluationScope } from "../../entities/evaluation.entity";
import {
  ScoreResult,
  ScoreResultStatus,
} from "../../entities/score-result.entity";
import { ExperimentResult } from "../../../experiments/entities/experiment-result.entity";
import { DatasetRow } from "../../../datasets/entities/dataset-row.entity";
import { CreateEvaluationResultRequestDto } from "../../dto/request/create-evaluation-request.dto";
import { ImportScoreResultsRequestDto } from "../../dto/request/import-score-results-request.dto";
import {
  EvaluationResultResponseDto,
  ImportScoreResultsResponseDto,
} from "../../dto/response/evaluation-response.dto";
import { ExperimentScoresResponseDto } from "../../dto/response/experiment-scores-response.dto";
import { EvaluationMapper } from "../../mappers/evaluation.mapper";
import { EvaluationLoaderService } from "../core/evaluation-loader.service";
import { EvaluationResultGroupingService } from "./evaluation-result-grouping.service";
import { PaginationQueryDto } from "../../../common/dto/pagination.dto";
import {
  PaginatedEvaluationResultsResponseDto,
  PaginatedPendingScoreResultsResponseDto,
} from "../../dto/response/paginated-evaluation-result.dto";

@Injectable()
export class EvaluationResultsService {
  constructor(
    @InjectRepository(ScoreResult)
    private readonly scoreResultRepository: Repository<ScoreResult>,
    @InjectRepository(ExperimentResult)
    private readonly experimentResultRepository: Repository<ExperimentResult>,
    @InjectRepository(DatasetRow)
    private readonly datasetRowRepository: Repository<DatasetRow>,
    private readonly evaluationLoaderService: EvaluationLoaderService,
    private readonly groupingService: EvaluationResultGroupingService,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
  ) {}

  async createResult(
    organisationId: string,
    projectId: string,
    evaluationId: string,
    dto: CreateEvaluationResultRequestDto,
  ): Promise<EvaluationResultResponseDto> {
    const evaluation = await this.evaluationLoaderService.loadEvaluationOrFail(
      organisationId,
      projectId,
      evaluationId,
    );
    this.ensureScoreOwnership(
      evaluation,
      dto.scoreResults.map((result) => result.scoreId),
    );

    const datasetRow = await this.resolveDatasetRowForResult(
      evaluation,
      dto.datasetRowId,
    );
    const experimentResult = await this.resolveExperimentResultForResult(
      evaluation,
      dto.experimentResultId,
    );

    if (!datasetRow && !experimentResult) {
      throw new BadRequestException(
        formatError(
          ERROR_MESSAGES.EVALUATION_RESULT_MUST_REFERENCE_DATASET_OR_EXPERIMENT,
        ),
      );
    }

    if (evaluation.evaluationScope === EvaluationScope.DATASET && !datasetRow) {
      throw new BadRequestException(
        formatError(ERROR_MESSAGES.DATASET_ROW_REQUIRED),
      );
    }

    if (
      evaluation.evaluationScope === EvaluationScope.EXPERIMENT &&
      !experimentResult
    ) {
      throw new BadRequestException(
        formatError(ERROR_MESSAGES.EXPERIMENT_RESULT_REQUIRED),
      );
    }

    const scoreResults = dto.scoreResults.map((scoreInput) =>
      this.scoreResultRepository.create({
        evaluationId: evaluation.id,
        scoreId: scoreInput.scoreId,
        datasetRowId: datasetRow?.id ?? null,
        experimentResultId: experimentResult?.id ?? null,
        value: scoreInput.value,
        reasoning: scoreInput.reasoning,
        status: ScoreResultStatus.DONE,
      }),
    );

    const savedScoreResults =
      await this.scoreResultRepository.save(scoreResults);
    const createdAt = savedScoreResults[0]?.createdAt ?? new Date();

    await this.invalidateEvaluationStatisticsCache(evaluation.id);

    return EvaluationMapper.toEvaluationResultDto(
      savedScoreResults,
      datasetRow?.id ?? null,
      experimentResult?.id ?? null,
      createdAt,
      datasetRow ?? null,
      experimentResult?.result ?? null,
    );
  }

  async importScoreResults(
    organisationId: string,
    projectId: string,
    evaluationId: string,
    scoreId: string,
    dto: ImportScoreResultsRequestDto,
  ): Promise<ImportScoreResultsResponseDto> {
    const evaluation = await this.evaluationLoaderService.loadEvaluationOrFail(
      organisationId,
      projectId,
      evaluationId,
    );
    this.ensureScoreOwnership(evaluation, [scoreId]);

    const scope = evaluation.evaluationScope;
    const refIds = this.validateAndExtractImportRefIds(dto.results, scope);

    if (scope === EvaluationScope.DATASET) {
      await this.validateDatasetRowRefs(evaluation, refIds);
    } else {
      await this.validateExperimentResultRefs(evaluation, refIds);
    }

    const existing =
      scope === EvaluationScope.DATASET
        ? await this.scoreResultRepository.find({
            where: {
              evaluationId,
              scoreId,
              datasetRowId: In(refIds),
            },
          })
        : await this.scoreResultRepository.find({
            where: {
              evaluationId,
              scoreId,
              experimentResultId: In(refIds),
            },
          });

    const existingByRef = new Map(
      existing.map((sr) => [
        (scope === EvaluationScope.DATASET
          ? sr.datasetRowId
          : sr.experimentResultId) ?? "",
        sr,
      ]),
    );

    const toSave: ScoreResult[] = [];
    for (const row of dto.results) {
      const refId =
        (scope === EvaluationScope.DATASET
          ? row.datasetRowId
          : row.experimentResultId) ?? "";
      const existingResult = existingByRef.get(refId);
      if (existingResult) {
        existingResult.value = row.value;
        existingResult.reasoning = row.reasoning ?? null;
        existingResult.status = ScoreResultStatus.DONE;
        toSave.push(existingResult);
      } else {
        toSave.push(
          this.scoreResultRepository.create({
            evaluationId: evaluation.id,
            scoreId,
            datasetRowId: row.datasetRowId ?? null,
            experimentResultId: row.experimentResultId ?? null,
            value: row.value,
            reasoning: row.reasoning ?? null,
            status: ScoreResultStatus.DONE,
          }),
        );
      }
    }

    await this.scoreResultRepository.save(toSave);
    await this.invalidateEvaluationStatisticsCache(evaluation.id);

    return { importedCount: toSave.length };
  }

  private validateAndExtractImportRefIds(
    results: ImportScoreResultsRequestDto["results"],
    scope: EvaluationScope,
  ): string[] {
    const refIds: string[] = [];
    for (const row of results) {
      const hasDataset = !!row.datasetRowId;
      const hasExperiment = !!row.experimentResultId;
      if (hasDataset === hasExperiment) {
        throw new BadRequestException(
          formatError(
            ERROR_MESSAGES.IMPORT_ROW_MUST_HAVE_DATASET_ROW_OR_EXPERIMENT_RESULT,
          ),
        );
      }
      const id = hasDataset ? row.datasetRowId : row.experimentResultId;
      if (id == null) {
        throw new BadRequestException(
          formatError(
            ERROR_MESSAGES.IMPORT_ROW_MUST_HAVE_DATASET_ROW_OR_EXPERIMENT_RESULT,
          ),
        );
      }
      if (scope === EvaluationScope.DATASET && !hasDataset) {
        throw new BadRequestException(
          formatError(
            ERROR_MESSAGES.IMPORT_ROW_MUST_HAVE_DATASET_ROW_OR_EXPERIMENT_RESULT,
          ),
        );
      }
      if (scope === EvaluationScope.EXPERIMENT && !hasExperiment) {
        throw new BadRequestException(
          formatError(
            ERROR_MESSAGES.IMPORT_ROW_MUST_HAVE_DATASET_ROW_OR_EXPERIMENT_RESULT,
          ),
        );
      }
      refIds.push(id);
    }

    if (new Set(refIds).size !== refIds.length) {
      throw new BadRequestException(
        formatError(ERROR_MESSAGES.IMPORT_CONTAINS_DUPLICATE_ROW_REF),
      );
    }
    return refIds;
  }

  private async validateDatasetRowRefs(
    evaluation: Evaluation,
    refIds: string[],
  ): Promise<void> {
    if (
      evaluation.evaluationScope !== EvaluationScope.DATASET ||
      !evaluation.datasetId
    ) {
      throw new BadRequestException(
        formatError(ERROR_MESSAGES.DATASET_ROW_RESULTS_ONLY_FOR_DATASET_SCOPE),
      );
    }
    const datasetRows = await this.datasetRowRepository.find({
      where: { id: In(refIds) },
    });
    const rowMap = new Map(datasetRows.map((r) => [r.id, r]));
    for (const id of refIds) {
      const row = rowMap.get(id);
      if (!row || row.datasetId !== evaluation.datasetId) {
        throw new NotFoundException(
          formatError(ERROR_MESSAGES.DATASET_ROW_NOT_FOUND),
        );
      }
    }
  }

  private async validateExperimentResultRefs(
    evaluation: Evaluation,
    refIds: string[],
  ): Promise<void> {
    const experimentResults = await this.experimentResultRepository.find({
      where: { id: In(refIds) },
      relations: ["experiment"],
    });
    const expIds = new Set((evaluation.experiments || []).map((e) => e.id));
    const resultMap = new Map(experimentResults.map((r) => [r.id, r]));
    for (const id of refIds) {
      const er = resultMap.get(id);
      if (!er || !expIds.has(er.experimentId)) {
        throw new NotFoundException(
          formatError(ERROR_MESSAGES.EXPERIMENT_RESULT_NOT_FOUND),
        );
      }
    }
  }

  private async invalidateEvaluationStatisticsCache(
    evaluationId: string,
  ): Promise<void> {
    const cacheKeys = [
      `eval:stats:dataset:${evaluationId}`,
      `eval:stats:dataset:nominal:${evaluationId}`,
      `eval:stats:dataset:ordinal:${evaluationId}`,
      `eval:stats:experiment:${evaluationId}`,
      `eval:stats:experiment:nominal:${evaluationId}`,
      `eval:stats:experiment:ordinal:${evaluationId}`,
    ];

    await Promise.all(cacheKeys.map((key) => this.cacheManager.del(key)));
  }

  async listResultsForDataset(
    organisationId: string,
    projectId: string,
    evaluationId: string,
  ): Promise<EvaluationResultResponseDto[]> {
    const evaluation = await this.evaluationLoaderService.loadEvaluationOrFail(
      organisationId,
      projectId,
      evaluationId,
    );

    if (evaluation.evaluationScope !== EvaluationScope.DATASET) {
      throw new BadRequestException(
        formatError(ERROR_MESSAGES.EVALUATION_SCOPE_MISMATCH, "dataset"),
      );
    }
    const scoreResults = await this.scoreResultRepository.find({
      where: { evaluationId },
      relations: ["score", "datasetRow"],
      order: { id: "DESC" },
    });

    const groupedResults =
      this.groupingService.groupResultsByDatasetRow(scoreResults);

    const results: EvaluationResultResponseDto[] = Array.from(
      groupedResults.entries(),
    )
      .filter(([datasetRowId]) => datasetRowId !== "null")
      .map(([datasetRowId, groupedScoreResults]) => {
        const firstResult = groupedScoreResults[0];
        const datasetRow = firstResult.datasetRow || null;
        return EvaluationMapper.toEvaluationResultDto(
          groupedScoreResults,
          datasetRowId,
          null,
          firstResult.createdAt,
          datasetRow,
        );
      });

    return results.sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
    );
  }

  async listResultsForDatasetPaginated(
    organisationId: string,
    projectId: string,
    evaluationId: string,
    query: PaginationQueryDto,
  ): Promise<PaginatedEvaluationResultsResponseDto> {
    const { page = 1, limit = 20, search, sortOrder = "desc" } = query;

    const evaluation = await this.evaluationLoaderService.loadEvaluationOrFail(
      organisationId,
      projectId,
      evaluationId,
    );

    if (evaluation.evaluationScope !== EvaluationScope.DATASET) {
      throw new BadRequestException(
        formatError(ERROR_MESSAGES.EVALUATION_SCOPE_MISMATCH, "dataset"),
      );
    }

    const skip = (page - 1) * limit;
    const searchPattern = search ? `%${search}%` : null;
    const sortKey = sortOrder === "asc" ? "ASC" : "DESC";

    const baseSubQb = this.scoreResultRepository
      .createQueryBuilder("sr")
      .select("sr.dataset_row_id", "datasetRowId")
      .leftJoin("sr.datasetRow", "dr")
      .where("sr.evaluation_id = :evaluationId", { evaluationId })
      .andWhere("sr.dataset_row_id IS NOT NULL");

    if (searchPattern) {
      baseSubQb.andWhere(
        "(sr.value::text ILIKE :searchPattern OR sr.reasoning ILIKE :searchPattern OR dr.values::text ILIKE :searchPattern)",
        { searchPattern },
      );
    }

    baseSubQb.groupBy("sr.dataset_row_id");

    const countQb = this.scoreResultRepository.manager
      .createQueryBuilder()
      .select("COUNT(*)", "count")
      .from(`(${baseSubQb.getQuery()})`, "sub")
      .setParameters(baseSubQb.getParameters());
    const { count: totalStr } = await countQb.getRawOne<{ count: string }>();
    const total = Number.parseInt(totalStr, 10);

    const pairsQb = this.scoreResultRepository
      .createQueryBuilder("sr")
      .select("sr.dataset_row_id", "datasetRowId")
      .leftJoin("sr.datasetRow", "dr")
      .where("sr.evaluation_id = :evaluationId", { evaluationId })
      .andWhere("sr.dataset_row_id IS NOT NULL");

    if (searchPattern) {
      pairsQb.andWhere(
        "(sr.value::text ILIKE :searchPattern OR sr.reasoning ILIKE :searchPattern OR dr.values::text ILIKE :searchPattern)",
        { searchPattern },
      );
    }

    const rows = await pairsQb
      .groupBy("sr.dataset_row_id")
      .orderBy("MAX(sr.created_at)", sortKey)
      .offset(skip)
      .limit(limit)
      .getRawMany<{ datasetRowId: string }>();

    if (rows.length === 0) {
      const totalPages = Math.ceil(total / limit);
      return {
        data: [],
        pagination: {
          page,
          limit,
          total,
          totalPages,
          hasNextPage: page < totalPages,
          hasPreviousPage: page > 1,
        },
      };
    }

    const datasetRowIds = rows.map((r) => r.datasetRowId);
    const scoreResults = await this.scoreResultRepository.find({
      where: datasetRowIds.map((datasetRowId) => ({
        evaluationId,
        datasetRowId,
      })),
      relations: ["score", "datasetRow"],
      order: { id: "DESC" },
    });

    const groupedResults =
      this.groupingService.groupResultsByDatasetRow(scoreResults);

    const results: EvaluationResultResponseDto[] = rows
      .map(({ datasetRowId }) => {
        const groupedScoreResults = groupedResults.get(datasetRowId);
        if (!groupedScoreResults) return null;
        const firstResult = groupedScoreResults[0];
        const datasetRow = firstResult.datasetRow || null;
        return EvaluationMapper.toEvaluationResultDto(
          groupedScoreResults,
          datasetRowId,
          null,
          firstResult.createdAt,
          datasetRow,
        );
      })
      .filter((r): r is EvaluationResultResponseDto => r !== null);

    const totalPages = Math.ceil(total / limit);

    return {
      data: results,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
      },
    };
  }

  async listResultsForExperiments(
    organisationId: string,
    projectId: string,
    evaluationId: string,
  ): Promise<EvaluationResultResponseDto[]> {
    const evaluation = await this.evaluationLoaderService.loadEvaluationOrFail(
      organisationId,
      projectId,
      evaluationId,
    );

    if (evaluation.evaluationScope !== EvaluationScope.EXPERIMENT) {
      throw new BadRequestException(
        formatError(ERROR_MESSAGES.EVALUATION_SCOPE_MISMATCH, "experiment"),
      );
    }
    const scoreResults = await this.scoreResultRepository.find({
      where: { evaluationId },
      relations: ["score", "datasetRow", "experimentResult"],
      order: { id: "DESC" },
    });

    const groupedResults =
      this.groupingService.groupResultsByDatasetRowAndExperiment(scoreResults);

    const results: EvaluationResultResponseDto[] = Array.from(
      groupedResults.entries(),
    )
      .map(([key, groupedScoreResults]) => {
        const [datasetRowId, experimentResultId] = key.split("::");
        return { datasetRowId, experimentResultId, groupedScoreResults };
      })
      .filter(
        ({ datasetRowId, experimentResultId }) =>
          datasetRowId !== "null" && experimentResultId !== "null",
      )
      .map(({ datasetRowId, experimentResultId, groupedScoreResults }) => {
        const firstResult = groupedScoreResults[0];
        const datasetRow = firstResult.datasetRow || null;
        const experimentResult = firstResult.experimentResult?.result ?? null;
        return EvaluationMapper.toEvaluationResultDto(
          groupedScoreResults,
          datasetRowId,
          experimentResultId,
          firstResult.createdAt,
          datasetRow,
          experimentResult,
        );
      });

    return results.sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
    );
  }

  async listResultsForExperimentsPaginated(
    organisationId: string,
    projectId: string,
    evaluationId: string,
    experimentId: string,
    query: PaginationQueryDto,
  ): Promise<PaginatedEvaluationResultsResponseDto> {
    const { page = 1, limit = 20, search, sortOrder = "desc" } = query;

    const evaluation = await this.evaluationLoaderService.loadEvaluationOrFail(
      organisationId,
      projectId,
      evaluationId,
    );

    if (evaluation.evaluationScope !== EvaluationScope.EXPERIMENT) {
      throw new BadRequestException(
        formatError(ERROR_MESSAGES.EVALUATION_SCOPE_MISMATCH, "experiment"),
      );
    }

    const skip = (page - 1) * limit;
    const searchPattern = search ? `%${search}%` : null;
    const sortKey = sortOrder === "asc" ? "ASC" : "DESC";

    const baseSubQb = this.scoreResultRepository
      .createQueryBuilder("sr")
      .select("sr.dataset_row_id", "datasetRowId")
      .addSelect("sr.experiment_result_id", "experimentResultId")
      .innerJoin("sr.experimentResult", "er")
      .leftJoin("sr.datasetRow", "dr")
      .where("sr.evaluation_id = :evaluationId", { evaluationId })
      .andWhere("er.experiment_id = :experimentId", { experimentId })
      .andWhere("sr.dataset_row_id IS NOT NULL")
      .andWhere("sr.experiment_result_id IS NOT NULL");

    if (searchPattern) {
      baseSubQb.andWhere(
        "(sr.value::text ILIKE :searchPattern OR sr.reasoning ILIKE :searchPattern OR dr.values::text ILIKE :searchPattern)",
        { searchPattern },
      );
    }

    baseSubQb
      .groupBy("sr.dataset_row_id")
      .addGroupBy("sr.experiment_result_id");

    const countQb = this.scoreResultRepository.manager
      .createQueryBuilder()
      .select("COUNT(*)", "count")
      .from(`(${baseSubQb.getQuery()})`, "sub")
      .setParameters(baseSubQb.getParameters());
    const { count: totalStr } = await countQb.getRawOne<{ count: string }>();
    const total = Number.parseInt(totalStr, 10);

    const pairsQb = this.scoreResultRepository
      .createQueryBuilder("sr")
      .select("sr.dataset_row_id", "datasetRowId")
      .addSelect("sr.experiment_result_id", "experimentResultId")
      .innerJoin("sr.experimentResult", "er")
      .leftJoin("sr.datasetRow", "dr")
      .where("sr.evaluation_id = :evaluationId", { evaluationId })
      .andWhere("er.experiment_id = :experimentId", { experimentId })
      .andWhere("sr.dataset_row_id IS NOT NULL")
      .andWhere("sr.experiment_result_id IS NOT NULL");

    if (searchPattern) {
      pairsQb.andWhere(
        "(sr.value::text ILIKE :searchPattern OR sr.reasoning ILIKE :searchPattern OR dr.values::text ILIKE :searchPattern)",
        { searchPattern },
      );
    }

    const pairs = await pairsQb
      .groupBy("sr.dataset_row_id")
      .addGroupBy("sr.experiment_result_id")
      .orderBy("MAX(sr.created_at)", sortKey)
      .offset(skip)
      .limit(limit)
      .getRawMany<{ datasetRowId: string; experimentResultId: string }>();

    if (pairs.length === 0) {
      const totalPages = Math.ceil(total / limit);
      return {
        data: [],
        pagination: {
          page,
          limit,
          total,
          totalPages,
          hasNextPage: page < totalPages,
          hasPreviousPage: page > 1,
        },
      };
    }

    const scoreResults = await this.scoreResultRepository.find({
      where: pairs.map((p) => ({
        evaluationId,
        datasetRowId: p.datasetRowId,
        experimentResultId: p.experimentResultId,
      })),
      relations: ["score", "datasetRow", "experimentResult"],
      order: { id: "DESC" },
    });

    const groupedResults =
      this.groupingService.groupResultsByDatasetRowAndExperiment(scoreResults);

    const results: EvaluationResultResponseDto[] = pairs
      .map(({ datasetRowId, experimentResultId }) => {
        const key = `${datasetRowId}::${experimentResultId}`;
        const groupedScoreResults = groupedResults.get(key);
        if (!groupedScoreResults) return null;
        const firstResult = groupedScoreResults[0];
        const datasetRow = firstResult.datasetRow || null;
        const experimentResult = firstResult.experimentResult?.result ?? null;
        return EvaluationMapper.toEvaluationResultDto(
          groupedScoreResults,
          datasetRowId,
          experimentResultId,
          firstResult.createdAt,
          datasetRow,
          experimentResult,
        );
      })
      .filter((r): r is EvaluationResultResponseDto => r !== null);

    const totalPages = Math.ceil(total / limit);

    return {
      data: results,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
      },
    };
  }

  async getExperimentScores(
    organisationId: string,
    projectId: string,
    evaluationId: string,
    experimentId: string,
  ): Promise<ExperimentScoresResponseDto> {
    const evaluation = await this.evaluationLoaderService.loadEvaluationOrFail(
      organisationId,
      projectId,
      evaluationId,
    );

    const evaluationExperiments = evaluation.experiments || [];
    const experimentIds = evaluationExperiments.map((e) => e.id);
    if (!experimentIds.includes(experimentId)) {
      throw new BadRequestException(
        formatError(ERROR_MESSAGES.EXPERIMENT_MUST_BELONG_TO_EVALUATION),
      );
    }

    const experimentResults = await this.experimentResultRepository.find({
      where: { experimentId },
    });

    if (experimentResults.length === 0) {
      return {
        experimentId,
        evaluationId,
        scoreResults: [],
        totalCount: 0,
      };
    }

    const experimentResultIds = experimentResults.map((er) => er.id);

    const scoreResults = await this.scoreResultRepository.find({
      where: {
        evaluationId,
        experimentResultId: In(experimentResultIds),
      },
      relations: ["score", "experimentResult", "datasetRow"],
      order: { createdAt: "DESC" },
    });

    return {
      experimentId,
      evaluationId,
      scoreResults: scoreResults.map((sr) =>
        EvaluationMapper.toScoreResultDto(sr),
      ),
      totalCount: scoreResults.length,
    };
  }

  async listPendingScoreResults(
    organisationId: string,
    projectId: string,
    evaluationId: string,
    scoreId: string,
    options: { experimentId?: string; page?: number; limit?: number },
  ): Promise<PaginatedPendingScoreResultsResponseDto> {
    const { experimentId, page = 1, limit = 100 } = options;

    const evaluation = await this.evaluationLoaderService.loadEvaluationOrFail(
      organisationId,
      projectId,
      evaluationId,
    );
    this.ensureScoreOwnership(evaluation, [scoreId]);

    const skip = (page - 1) * limit;

    if (evaluation.evaluationScope === EvaluationScope.DATASET) {
      if (experimentId) {
        throw new BadRequestException(
          formatError(ERROR_MESSAGES.EVALUATION_SCOPE_MISMATCH, "dataset"),
        );
      }
      const [scoreResults, total] =
        await this.scoreResultRepository.findAndCount({
          where: {
            evaluationId,
            scoreId,
            status: ScoreResultStatus.PENDING,
            datasetRowId: Not(IsNull()),
          },
          order: { createdAt: "ASC" },
          skip,
          take: limit,
        });
      const totalPages = Math.ceil(total / limit);
      return {
        data: scoreResults.map((sr) => EvaluationMapper.toScoreResultDto(sr)),
        pagination: {
          page,
          limit,
          total,
          totalPages,
          hasNextPage: page < totalPages,
          hasPreviousPage: page > 1,
        },
      };
    }

    if (!experimentId) {
      throw new BadRequestException(
        formatError(ERROR_MESSAGES.EXPERIMENT_ID_REQUIRED_FOR_EXPERIMENT_SCOPE),
      );
    }
    const evaluationExperiments = evaluation.experiments || [];
    if (!evaluationExperiments.some((e) => e.id === experimentId)) {
      throw new BadRequestException(
        formatError(ERROR_MESSAGES.EXPERIMENT_MUST_BELONG_TO_EVALUATION),
      );
    }

    const experimentResults = await this.experimentResultRepository.find({
      where: { experimentId },
      select: ["id"],
    });
    const experimentResultIds = experimentResults.map((er) => er.id);
    if (experimentResultIds.length === 0) {
      return {
        data: [],
        pagination: {
          page,
          limit,
          total: 0,
          totalPages: 0,
          hasNextPage: false,
          hasPreviousPage: false,
        },
      };
    }

    const qb = this.scoreResultRepository
      .createQueryBuilder("sr")
      .where("sr.evaluation_id = :evaluationId", { evaluationId })
      .andWhere("sr.score_id = :scoreId", { scoreId })
      .andWhere("sr.status = :status", { status: ScoreResultStatus.PENDING })
      .andWhere("sr.experiment_result_id IN (:...ids)", {
        ids: experimentResultIds,
      });

    const [scoreResults, total] = await qb
      .orderBy("sr.created_at", "ASC")
      .skip(skip)
      .take(limit)
      .getManyAndCount();

    const totalPages = Math.ceil(total / limit);
    return {
      data: scoreResults.map((sr) => EvaluationMapper.toScoreResultDto(sr)),
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
      },
    };
  }

  private ensureScoreOwnership(
    evaluation: Evaluation,
    scoreIds: string[],
  ): void {
    const evaluationScoreIds = new Set(
      (evaluation.scores || []).map((score) => score.id),
    );
    const missing = scoreIds.filter((id) => !evaluationScoreIds.has(id));
    if (missing.length > 0) {
      throw new BadRequestException(
        formatError(ERROR_MESSAGES.SCORE_RESULTS_CONTAIN_INVALID_SCORES),
      );
    }
  }

  private async resolveDatasetRowForResult(
    evaluation: Evaluation,
    datasetRowId?: string,
  ): Promise<DatasetRow | null> {
    if (!datasetRowId) {
      return null;
    }

    if (
      evaluation.evaluationScope !== EvaluationScope.DATASET ||
      !evaluation.datasetId
    ) {
      throw new BadRequestException(
        formatError(ERROR_MESSAGES.DATASET_ROW_RESULTS_ONLY_FOR_DATASET_SCOPE),
      );
    }

    const datasetRow = await this.datasetRowRepository.findOne({
      where: { id: datasetRowId },
    });

    if (!datasetRow || datasetRow.datasetId !== evaluation.datasetId) {
      throw new NotFoundException(
        formatError(ERROR_MESSAGES.DATASET_ROW_NOT_FOUND),
      );
    }

    return datasetRow;
  }

  private async resolveExperimentResultForResult(
    evaluation: Evaluation,
    experimentResultId?: string,
  ): Promise<ExperimentResult | null> {
    if (!experimentResultId) {
      return null;
    }

    if (evaluation.evaluationScope !== EvaluationScope.EXPERIMENT) {
      throw new BadRequestException(
        formatError(
          ERROR_MESSAGES.EXPERIMENT_RESULTS_ONLY_FOR_EXPERIMENT_SCOPE,
        ),
      );
    }

    const experimentResult = await this.experimentResultRepository.findOne({
      where: { id: experimentResultId },
      relations: ["experiment"],
    });

    if (
      !experimentResult ||
      !(evaluation.experiments || []).some(
        (exp) => exp.id === experimentResult.experimentId,
      )
    ) {
      throw new NotFoundException(
        formatError(ERROR_MESSAGES.EXPERIMENT_RESULT_NOT_FOUND),
      );
    }

    return experimentResult;
  }
}
