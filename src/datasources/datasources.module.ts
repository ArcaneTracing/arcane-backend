import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { DatasourcesService } from "./services/datasources.service";
import { Datasource } from "./entities/datasource.entity";
import { ProjectsModule } from "../projects/projects.module";
import { OrganisationsModule } from "../organisations/organisations.module";
import { RbacModule } from "../rbac/rbac.module";
import { DatasourcesController } from "./controllers/datasources.controller";
import { DatasourcesPublicController } from "./controllers/datasources-public.controller";
import { Project } from "../projects/entities/project.entity";
import { DatasourceUrlValidator } from "./validators/datasource-url.validator";
import { ClickHouseConfigValidator } from "./validators/clickhouse-config.validator";
import { CustomApiConfigValidator } from "./validators/custom-api-config.validator";
import { DatasourceConfigValidator } from "./validators/datasource-config.validator";
import { AuditModule } from "../audit/audit.module";
import { DatasourceConfigEncryptionService } from "./services/datasource-config-encryption.service";
import { DatasourceAuthService } from "./services/datasource-auth.service";
import { DatasourceConnectivityService } from "./services/datasource-connectivity.service";
import { HttpModule } from "@nestjs/axios";

@Module({
  imports: [
    TypeOrmModule.forFeature([Datasource, Project]),
    HttpModule,
    ProjectsModule,
    OrganisationsModule,
    RbacModule,
    AuditModule,
  ],
  controllers: [DatasourcesController, DatasourcesPublicController],
  providers: [
    DatasourcesService,
    DatasourceUrlValidator,
    ClickHouseConfigValidator,
    CustomApiConfigValidator,
    DatasourceConfigValidator,
    DatasourceConfigEncryptionService,
    DatasourceAuthService,
    DatasourceConnectivityService,
  ],
  exports: [
    DatasourcesService,
    DatasourceAuthService,
    DatasourceConfigEncryptionService,
    DatasourceConnectivityService,
  ],
})
export class DatasourcesModule {}
