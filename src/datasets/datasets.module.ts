import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { DatasetsService } from "./services/datasets.service";
import { DatasetsController } from "./controllers/datasets.controller";
import { DatasetsPublicController } from "./controllers/datasets-public.controller";
import { Dataset } from "./entities/dataset.entity";
import { DatasetRow } from "./entities/dataset-row.entity";
import { Project } from "../projects/entities/project.entity";
import { ProjectsModule } from "../projects/projects.module";
import { RbacModule } from "../rbac/rbac.module";
import { AuthModule } from "../auth/auth.module";
import { AuditModule } from "../audit/audit.module";
import { DatasetsCsvService } from "./services/datasets-csv.service";

@Module({
  imports: [
    TypeOrmModule.forFeature([Dataset, DatasetRow, Project]),
    ProjectsModule,
    RbacModule,
    AuthModule,
    AuditModule,
  ],
  controllers: [DatasetsController, DatasetsPublicController],
  providers: [DatasetsService, DatasetsCsvService],
  exports: [DatasetsService, DatasetsCsvService],
})
export class DatasetsModule {}
