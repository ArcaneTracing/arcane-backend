import { Injectable } from "@nestjs/common";
import { DatasourceSource } from "src/datasources/entities/datasource.entity";
import { TraceRepository } from "./trace-repository.interface";
import { TempoTraceRepository } from "./tempo/tempo.trace.repository";
import { JaegerTraceRepository } from "./jaeger/jaeger.trace.repository";
import { ClickHouseTraceRepository } from "./clickhouse/clickhouse.trace.repository";
import { CustomApiTraceRepository } from "./custom-api/custom-api.trace.repository";

@Injectable()
export class TraceRepositoryFactory {
  constructor(
    private readonly tempoTraceRepository: TempoTraceRepository,
    private readonly jaegerTraceRepository: JaegerTraceRepository,
    private readonly clickHouseTraceRepository: ClickHouseTraceRepository,
    private readonly customApiTraceRepository: CustomApiTraceRepository,
  ) {}

  getRepository(source: DatasourceSource): TraceRepository {
    switch (source) {
      case DatasourceSource.TEMPO:
        return this.tempoTraceRepository;
      case DatasourceSource.JAEGER:
        return this.jaegerTraceRepository;
      case DatasourceSource.CLICKHOUSE:
        return this.clickHouseTraceRepository;
      case DatasourceSource.CUSTOM_API:
        return this.customApiTraceRepository;
      default:
        throw new Error(`Unsupported datasource source: ${source}`);
    }
  }
}
