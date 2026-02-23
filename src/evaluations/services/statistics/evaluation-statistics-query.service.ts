import { Injectable } from "@nestjs/common";
import { DatasetStatisticsResponseDto } from "../../dto/response/dataset-statistics-response.dto";
import { EvaluationStatisticsResponseDto } from "../../dto/response/evaluation-statistics-response.dto";
import { DatasetStatisticsService } from "./dataset-statistics.service";
import { ExperimentStatisticsService } from "./experiment-statistics.service";

@Injectable()
export class EvaluationStatisticsQueryService {
  constructor(
    private readonly datasetStatisticsService: DatasetStatisticsService,
    private readonly experimentStatisticsService: ExperimentStatisticsService,
  ) {}

  async getStatisticsForDataset(
    organisationId: string,
    projectId: string,
    evaluationId: string,
  ): Promise<DatasetStatisticsResponseDto[]> {
    return this.datasetStatisticsService.getStatistics(
      organisationId,
      projectId,
      evaluationId,
    );
  }

  async getStatisticsForExperiments(
    organisationId: string,
    projectId: string,
    evaluationId: string,
  ): Promise<EvaluationStatisticsResponseDto[]> {
    return this.experimentStatisticsService.getStatistics(
      organisationId,
      projectId,
      evaluationId,
    );
  }
}
