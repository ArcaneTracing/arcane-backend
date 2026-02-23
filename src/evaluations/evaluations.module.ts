import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { TypeOrmModule } from "@nestjs/typeorm";
import { MessageBrokerModule } from "../common/message-broker/message-broker.module";
import { EvaluationsService } from "./services/core/evaluations.service";
import { EvaluationsController } from "./evaluations.controller";
import { EvaluationsPublicController } from "./controllers/evaluations-public.controller";
import { Evaluation } from "./entities/evaluation.entity";
import { ScoreResult } from "./entities/score-result.entity";
import { Score } from "../scores/entities/score.entity";
import { Experiment } from "../experiments/entities/experiment.entity";
import { ExperimentResult } from "../experiments/entities/experiment-result.entity";
import { Dataset } from "../datasets/entities/dataset.entity";
import { DatasetRow } from "../datasets/entities/dataset-row.entity";
import { PromptVersion } from "../prompts/entities/prompt-version.entity";
import { Project } from "../projects/entities/project.entity";
import { RbacModule } from "../rbac/rbac.module";
import { AuditModule } from "../audit/audit.module";
import { EvaluationQueueService } from "./queue/evaluation-queue.service";
import { EvaluationResultsProcessor } from "./queue/evaluation-results.processor";
import { EvaluationJobsService } from "./services/core/evaluation-jobs.service";
import { EvaluationStatisticsService } from "./services/statistics/evaluation-statistics.service";
import { ExperimentComparisonService } from "./services/comparison/experiment-comparison.service";
import { EvaluationLoaderService } from "./services/core/evaluation-loader.service";
import { EvaluationWriterService } from "./services/core/evaluation-writer.service";
import { EvaluationResultsService } from "./services/results/evaluation-results.service";
import { EvaluationStatisticsQueryService } from "./services/statistics/evaluation-statistics-query.service";
import { EvaluationStatisticsSqlService } from "./services/statistics/evaluation-statistics-sql.service";
import { EvaluationStatisticsStreamingService } from "./services/statistics/evaluation-statistics-streaming.service";
import { StatisticsCalculationOrchestrator } from "./services/statistics/statistics-calculation-orchestrator.service";
import { DatasetStatisticsService } from "./services/statistics/dataset-statistics.service";
import { ExperimentStatisticsService } from "./services/statistics/experiment-statistics.service";
import { ScoreMappingFillerService } from "./services/results/score-mapping-filler.service";
import { EvaluationQueueOrchestrator } from "./services/queue-orchestration/evaluation-queue-orchestrator.service";
import { ExperimentComparisonDataBuilder } from "./services/comparison/experiment-comparison-data-builder.service";
import { EvaluationResultGroupingService } from "./services/results/evaluation-result-grouping.service";
import { PromptsModule } from "../prompts/prompts.module";
import { ProjectsModule } from "../projects/projects.module";

@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([
      Evaluation,
      ScoreResult,
      Score,
      Experiment,
      ExperimentResult,
      Dataset,
      DatasetRow,
      PromptVersion,
      Project,
    ]),
    MessageBrokerModule.forRoot(),
    RbacModule,
    AuditModule,
    PromptsModule,
    ProjectsModule,
  ],
  controllers: [EvaluationsController, EvaluationsPublicController],
  providers: [
    EvaluationsService,
    EvaluationQueueService,
    EvaluationJobsService,
    EvaluationStatisticsService,
    ExperimentComparisonService,
    EvaluationLoaderService,
    EvaluationWriterService,
    EvaluationResultsService,
    EvaluationStatisticsQueryService,
    EvaluationStatisticsSqlService,
    EvaluationStatisticsStreamingService,
    StatisticsCalculationOrchestrator,
    DatasetStatisticsService,
    ExperimentStatisticsService,
    ScoreMappingFillerService,
    EvaluationQueueOrchestrator,
    ExperimentComparisonDataBuilder,
    EvaluationResultGroupingService,
    EvaluationResultsProcessor,
  ],
})
export class EvaluationsModule {}
