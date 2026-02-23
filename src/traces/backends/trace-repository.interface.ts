import { SearchTracesRequestDto } from "../dto/request/search-traces-request.dto";
import { Datasource } from "src/datasources/entities/datasource.entity";
import type {
  TempoTraceResponse,
  TempoTraceSearchResponse,
} from "./tempo/tempo.types";
import type { TimeRangeDto } from "../dto/time-range.dto";

export interface ProjectTraceFilter {
  attributeName: string;
  attributeValue: string;
}

export interface TraceRepository {
  search(
    datasource: Datasource,
    searchParams: SearchTracesRequestDto,
    projectTraceFilter?: ProjectTraceFilter,
  ): Promise<TempoTraceSearchResponse>;
  getAttributeNames(datasource: Datasource): Promise<string[]>;
  getAttributeValues(
    datasource: Datasource,
    attributeName: string,
  ): Promise<string[]>;
  searchByTraceId(
    datasource: Datasource,
    traceId: string,
    timeRange?: TimeRangeDto,
    projectTraceFilter?: ProjectTraceFilter,
  ): Promise<TempoTraceResponse>;
}
