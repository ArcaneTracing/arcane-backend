import { Module } from "@nestjs/common";
import { HttpModule } from "@nestjs/axios";
import { TypeOrmModule } from "@nestjs/typeorm";
import { TracesService } from "./services/traces.service";
import { TracesController } from "./traces.controller";
import { TracesPublicController } from "./controllers/traces-public.controller";
import { DatasourcesModule } from "../datasources/datasources.module";
import { RbacModule } from "../rbac/rbac.module";
import { ProjectsModule } from "../projects/projects.module";
import { Project } from "../projects/entities/project.entity";
import { TraceRepositoryFactory } from "./backends/trace-repository.factory";
import { TempoTraceRepository } from "./backends/tempo/tempo.trace.repository";
import { JaegerTraceRepository } from "./backends/jaeger/jaeger.trace.repository";
import { ClickHouseTraceRepository } from "./backends/clickhouse/clickhouse.trace.repository";
import { CustomApiTraceRepository } from "./backends/custom-api/custom-api.trace.repository";
import { TraceFilterUtil } from "./backends/common/trace-filter.util";
import { TraceAttributeObfuscationService } from "./services/trace-attribute-obfuscation.service";

@Module({
  imports: [
    HttpModule,
    TypeOrmModule.forFeature([Project]),
    DatasourcesModule,
    RbacModule,
    ProjectsModule,
  ],
  controllers: [TracesController, TracesPublicController],
  providers: [
    TracesService,
    TraceFilterUtil,
    TraceAttributeObfuscationService,
    TempoTraceRepository,
    JaegerTraceRepository,
    ClickHouseTraceRepository,
    CustomApiTraceRepository,
    TraceRepositoryFactory,
  ],
  exports: [
    TracesService,
    TraceAttributeObfuscationService,
    TempoTraceRepository,
    JaegerTraceRepository,
    ClickHouseTraceRepository,
    CustomApiTraceRepository,
  ],
})
export class TracesModule {}
