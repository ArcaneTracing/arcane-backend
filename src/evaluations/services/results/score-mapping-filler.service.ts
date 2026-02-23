import { Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Dataset } from "../../../datasets/entities/dataset.entity";
import { DatasetRow } from "../../../datasets/entities/dataset-row.entity";
import { Experiment } from "../../../experiments/entities/experiment.entity";
import { ExperimentResult } from "../../../experiments/entities/experiment-result.entity";
import { Score, ScoringType } from "../../../scores/entities/score.entity";
import { EvaluationScope } from "../../entities/evaluation.entity";

export interface RowResultPair {
  datasetRowId: string;
  experimentResultId: string | null;
}

@Injectable()
export class ScoreMappingFillerService {
  private readonly logger = new Logger(ScoreMappingFillerService.name);

  constructor(
    @InjectRepository(DatasetRow)
    private readonly datasetRowRepository: Repository<DatasetRow>,
    @InjectRepository(ExperimentResult)
    private readonly experimentResultRepository: Repository<ExperimentResult>,
    @InjectRepository(Dataset)
    private readonly datasetRepository: Repository<Dataset>,
  ) {}

  async fillScoreMappingsForDataset(
    scoreMappingsTemplate: Record<string, Record<string, unknown>>,
    dataset: Dataset,
    scores: Score[],
  ): Promise<Record<string, unknown>[]> {
    if (
      !scoreMappingsTemplate ||
      Object.keys(scoreMappingsTemplate).length === 0
    ) {
      return [];
    }

    const datasetRows = await this.datasetRowRepository.find({
      where: { datasetId: dataset.id },
    });

    const filledMappings: Record<string, unknown>[] = [];

    for (const score of scores) {
      const mappingTemplate = scoreMappingsTemplate[score.id];

      if (
        !mappingTemplate ||
        typeof mappingTemplate !== "object" ||
        Array.isArray(mappingTemplate)
      ) {
        this.logger.warn(`No mapping template found for score ${score.id}`);
        continue;
      }

      const template = mappingTemplate as Record<string, string>;

      if (!template || Object.keys(template).length === 0) {
        this.logger.warn(`Empty mapping template for score ${score.id}`);
        continue;
      }

      for (const datasetRow of datasetRows) {
        const filledMapping = this.fillMappingFromDatasetRow(
          template,
          datasetRow,
          dataset,
          score,
        );
        filledMappings.push(filledMapping);
      }
    }

    return filledMappings;
  }

  async fillScoreMappingsForExperiments(
    scoreMappingsTemplate: Record<string, Record<string, unknown>>,
    experiments: Experiment[],
    scores: Score[],
  ): Promise<Record<string, unknown>[]> {
    if (
      !scoreMappingsTemplate ||
      Object.keys(scoreMappingsTemplate).length === 0
    )
      return [];
    if (!experiments?.length) {
      this.logger.warn("No experiments provided for filling score mappings");
      return [];
    }

    const filledMappings: Record<string, unknown>[] = [];
    for (const experiment of experiments) {
      const experimentMappings = await this.fillMappingsForExperiment(
        experiment,
        scoreMappingsTemplate,
        scores,
      );
      filledMappings.push(...experimentMappings);
    }
    return filledMappings;
  }

  async getRowResultPairsForScope(
    evaluationScope: EvaluationScope,
    dataset: Dataset | null,
    experiments: Experiment[],
  ): Promise<RowResultPair[]> {
    if (evaluationScope === EvaluationScope.DATASET && dataset) {
      const datasetRows = await this.datasetRowRepository.find({
        where: { datasetId: dataset.id },
      });
      return datasetRows.map((row) => ({
        datasetRowId: row.id,
        experimentResultId: null,
      }));
    }
    if (
      evaluationScope === EvaluationScope.EXPERIMENT &&
      experiments.length > 0
    ) {
      const pairs: RowResultPair[] = [];
      for (const experiment of experiments) {
        const experimentResults = await this.experimentResultRepository.find({
          where: { experimentId: experiment.id },
          relations: ["datasetRow"],
        });
        for (const result of experimentResults) {
          if (result.datasetRow) {
            pairs.push({
              datasetRowId: result.datasetRow.id,
              experimentResultId: result.id,
            });
          }
        }
      }
      return pairs;
    }
    return [];
  }

  private async fillMappingsForExperiment(
    experiment: Experiment,
    scoreMappingsTemplate: Record<string, Record<string, unknown>>,
    scores: Score[],
  ): Promise<Record<string, unknown>[]> {
    const dataset = await this.datasetRepository.findOne({
      where: { id: experiment.datasetId },
    });
    if (!dataset) {
      this.logger.warn(
        `Dataset ${experiment.datasetId} not found for experiment ${experiment.id}`,
      );
      return [];
    }
    const experimentResults = await this.experimentResultRepository.find({
      where: { experimentId: experiment.id },
      relations: ["datasetRow"],
    });
    const filledMappings: Record<string, unknown>[] = [];
    for (const experimentResult of experimentResults) {
      const mappings = this.fillMappingsForExperimentResult(
        experimentResult,
        dataset,
        scoreMappingsTemplate,
        scores,
      );
      filledMappings.push(...mappings);
    }
    return filledMappings;
  }

  private fillMappingsForExperimentResult(
    experimentResult: ExperimentResult,
    dataset: Dataset,
    scoreMappingsTemplate: Record<string, Record<string, unknown>>,
    scores: Score[],
  ): Record<string, unknown>[] {
    const datasetRow = experimentResult.datasetRow;
    if (!datasetRow) {
      this.logger.warn(
        `Dataset row not found for experiment result ${experimentResult.id}`,
      );
      return [];
    }
    const filledMappings: Record<string, unknown>[] = [];
    for (const [scoreId, mappingTemplate] of Object.entries(
      scoreMappingsTemplate,
    )) {
      const score = scores.find((s) => s.id === scoreId);
      if (!score) {
        this.logger.warn(`Score ${scoreId} not found in evaluation scores`);
        continue;
      }
      filledMappings.push(
        this.fillMappingFromExperimentResult(
          mappingTemplate as Record<string, string>,
          experimentResult,
          dataset,
          score,
        ),
      );
    }
    return filledMappings;
  }

  fillMappingFromDatasetRow(
    template: Record<string, string>,
    datasetRow: DatasetRow,
    dataset: Dataset,
    score: Score,
  ): Record<string, unknown> {
    const filledMapping: Record<string, unknown> = {
      scoreId: score.id,
      scoringType: score.scoringType,
      datasetRowId: datasetRow.id,
      experimentResultId: null,
    };

    if (score.scoringType === ScoringType.RAGAS) {
      filledMapping.ragasScoreKey = score.ragasScoreKey;
    }

    for (const [key, columnName] of Object.entries(template)) {
      if (typeof columnName === "string") {
        const columnIndex = dataset.header.indexOf(columnName);
        if (
          columnIndex !== -1 &&
          datasetRow.values[columnIndex] !== undefined
        ) {
          filledMapping[key] = datasetRow.values[columnIndex];
        } else {
          this.logger.warn(
            `Column ${columnName} not found in dataset header or value missing for row ${datasetRow.id}`,
          );
        }
      }
    }

    return filledMapping;
  }

  fillMappingFromExperimentResult(
    template: Record<string, string>,
    experimentResult: ExperimentResult,
    dataset: Dataset,
    score: Score,
  ): Record<string, unknown> {
    const datasetRow = experimentResult.datasetRow;
    if (!datasetRow) {
      throw new Error(
        `Dataset row not found for experiment result ${experimentResult.id}`,
      );
    }

    const filledMapping: Record<string, unknown> = {
      scoreId: score.id,
      scoringType: score.scoringType,
      datasetRowId: datasetRow.id,
      experimentResultId: experimentResult.id,
    };

    if (score.scoringType === ScoringType.RAGAS) {
      filledMapping.ragasScoreKey = score.ragasScoreKey;
    }

    for (const [key, columnName] of Object.entries(template)) {
      if (columnName === "experiment_result") {
        filledMapping[key] = experimentResult.result;
      } else {
        const columnIndex = dataset.header.indexOf(columnName);
        if (
          columnIndex !== -1 &&
          datasetRow.values[columnIndex] !== undefined
        ) {
          filledMapping[key] = datasetRow.values[columnIndex];
        } else {
          this.logger.warn(
            `Column ${columnName} not found in dataset header or value missing for result ${experimentResult.id}`,
          );
        }
      }
    }

    return filledMapping;
  }
}
