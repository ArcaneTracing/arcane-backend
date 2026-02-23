import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { TypeOrmModule } from "@nestjs/typeorm";
import { MessageBrokerModule } from "../common/message-broker/message-broker.module";
import { ExperimentsService } from "./services/experiments.service";
import { ExperimentsController } from "./controllers/experiments.controller";
import { ExperimentsPublicController } from "./controllers/experiments-public.controller";
import { Experiment } from "./entities/experiment.entity";
import { ExperimentResult } from "./entities/experiment-result.entity";
import { PromptVersion } from "../prompts/entities/prompt-version.entity";
import { Dataset } from "../datasets/entities/dataset.entity";
import { DatasetRow } from "../datasets/entities/dataset-row.entity";
import { Project } from "../projects/entities/project.entity";
import { ProjectsModule } from "../projects/projects.module";
import { RbacModule } from "../rbac/rbac.module";
import { AuditModule } from "../audit/audit.module";
import { ExperimentQueueService } from "./queue/experiment-queue.service";
import { ExperimentResultsProcessor } from "./queue/experiment-results.processor";
import { ExperimentJobsService } from "./services/experiment-jobs.service";

@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([
      Experiment,
      ExperimentResult,
      PromptVersion,
      Dataset,
      DatasetRow,
      Project,
    ]),
    MessageBrokerModule.forRoot(),
    ProjectsModule,
    RbacModule,
    AuditModule,
  ],
  controllers: [ExperimentsController, ExperimentsPublicController],
  providers: [
    ExperimentQueueService,
    ExperimentJobsService,
    ExperimentsService,
    ExperimentResultsProcessor,
  ],
  exports: [ExperimentsService],
})
export class ExperimentsModule {}
