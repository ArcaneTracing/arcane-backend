import {
  Injectable,
  Logger,
  InternalServerErrorException,
  NotFoundException,
} from "@nestjs/common";
import { HttpService } from "@nestjs/axios";
import { firstValueFrom } from "rxjs";
import { SearchTracesRequestDto } from "../../dto/request/search-traces-request.dto";
import { Datasource } from "src/datasources/entities/datasource.entity";
import {
  TraceRepository,
  ProjectTraceFilter,
} from "../trace-repository.interface";
import { TempoParamsBuilder } from "./tempo.params.builder";
import { TempoErrorHandler } from "./tempo.error.handler";
import {
  ERROR_MESSAGES,
  formatError,
} from "src/common/constants/error-messages.constants";
import { TraceFilterUtil } from "../common/trace-filter.util";
import { DatasourceAuthService } from "src/datasources/services/datasource-auth.service";
import type {
  TempoTraceResponse,
  TempoTraceSearchResponse,
  TempoAttributeNamesResponse,
  TempoAttributeValuesResponse,
} from "./tempo.types";
import type { TimeRangeDto } from "../../dto/time-range.dto";

@Injectable()
export class TempoTraceRepository implements TraceRepository {
  private readonly logger = new Logger("TempoTraceRepository");

  constructor(
    private readonly httpService: HttpService,
    private readonly traceFilterUtil: TraceFilterUtil,
    private readonly datasourceAuthService: DatasourceAuthService,
  ) {}

  private getTempoUrl(datasource: Datasource): string {
    if (!datasource.url) {
      throw new Error("Tempo URL is required in datasource configuration");
    }
    return datasource.url.replace(/\/$/, "");
  }

  private mergeProjectFilter(
    searchParams: SearchTracesRequestDto,
    projectTraceFilter?: ProjectTraceFilter,
  ): SearchTracesRequestDto {
    if (!projectTraceFilter) {
      return searchParams;
    }

    const filterAttr = `${projectTraceFilter.attributeName}=${projectTraceFilter.attributeValue}`;
    const mergedParams = { ...searchParams };

    if (searchParams.q) {
      const escapedName = projectTraceFilter.attributeName.replaceAll(
        '"',
        String.raw`\"`,
      );
      const escapedValue = projectTraceFilter.attributeValue.replaceAll(
        '"',
        String.raw`\"`,
      );
      const projectFilterCondition = `(resource."${escapedName}" = "${escapedValue}" || span."${escapedName}" = "${escapedValue}")`;
      const existingQ = searchParams.q.trim();
      mergedParams.q = existingQ.endsWith("}")
        ? `${existingQ.slice(0, -1)} && ${projectFilterCondition} }`
        : `${existingQ} && ${projectFilterCondition}`;
      mergedParams.attributes = undefined;
    } else if (searchParams.attributes) {
      mergedParams.attributes = `${searchParams.attributes} ${filterAttr}`;
    } else {
      mergedParams.attributes = filterAttr;
    }

    this.logger.debug(`Applied project trace filter: ${filterAttr}`);

    return mergedParams;
  }

  async search(
    datasource: Datasource,
    searchParams: SearchTracesRequestDto,
    projectTraceFilter?: ProjectTraceFilter,
  ): Promise<TempoTraceSearchResponse> {
    const mergedParams = this.mergeProjectFilter(
      searchParams,
      projectTraceFilter,
    );

    try {
      const tempoUrl = this.getTempoUrl(datasource);
      const queryParams = TempoParamsBuilder.build(mergedParams);
      const url = `${tempoUrl}/api/search`;
      const queryString = queryParams.toString();
      const urlWithParams = queryString ? url + "?" + queryString : url;

      const authHeaders =
        this.datasourceAuthService.buildAuthHeaders(datasource);
      const headers = {
        "Content-Type": "application/json",
        ...authHeaders,
      };
      const response = await fetch(urlWithParams, {
        method: "GET",
        headers,
      });

      if (!response.ok) {
        await TempoErrorHandler.handleFetchError(response, tempoUrl, {
          url: urlWithParams,
          datasourceId: datasource.id,
          searchParams: mergedParams,
        });
      }
      return response.json() as Promise<TempoTraceSearchResponse>;
    } catch (error) {
      if (error instanceof InternalServerErrorException) {
        throw error;
      }
      this.logger.error("Error searching traces in Tempo:", {
        error: error.message,
        stack: error.stack,
        searchParams: mergedParams,
      });
      throw new InternalServerErrorException(
        formatError(ERROR_MESSAGES.TRACE_SEARCH_FAILED),
      );
    }
  }

  async searchByTraceId(
    datasource: Datasource,
    traceId: string,
    timeRange?: TimeRangeDto,
    projectTraceFilter?: ProjectTraceFilter,
  ): Promise<TempoTraceResponse> {
    const tempoUrl = this.getTempoUrl(datasource);

    const params: Record<string, string> = {};
    if (timeRange) {
      const start = Math.round(new Date(timeRange.start).getTime() / 1000);
      const end = Math.round(new Date(timeRange.end).getTime() / 1000);
      params.start = start.toString();
      params.end = end.toString();
    }

    const url = `${tempoUrl}/api/traces/${traceId}`;
    const urlWithParams =
      Object.keys(params).length > 0
        ? `${url}?${new URLSearchParams(params).toString()}`
        : url;

    try {
      this.logger.debug("Tempo trace by ID request", {
        url: urlWithParams,
        traceId,
        timeRange,
        datasourceId: datasource.id,
        tempoUrl,
      });

      const authHeaders =
        this.datasourceAuthService.buildAuthHeaders(datasource);
      const response = await firstValueFrom(
        this.httpService.get(urlWithParams, {
          headers: {
            "Content-Type": "application/json",
            ...authHeaders,
          },
        }),
      );

      const trace = response.data as TempoTraceResponse;

      if (
        projectTraceFilter &&
        !this.traceFilterUtil.filterFullTrace(trace, projectTraceFilter)
      ) {
        throw new NotFoundException(
          formatError(ERROR_MESSAGES.TRACE_NOT_FOUND, traceId),
        );
      }

      return trace;
    } catch (error) {
      TempoErrorHandler.handle(
        error,
        tempoUrl,
        { url: urlWithParams, traceId, datasourceId: datasource.id, timeRange },
        { traceId, isSearch: false },
      );
    }
  }

  async getAttributeNames(datasource: Datasource): Promise<string[]> {
    const tempoUrl = this.getTempoUrl(datasource);
    const url = `${tempoUrl}/api/search/tags`;

    try {
      const authHeaders =
        this.datasourceAuthService.buildAuthHeaders(datasource);
      const response = await firstValueFrom(
        this.httpService.get<TempoAttributeNamesResponse>(url, {
          headers: {
            "Content-Type": "application/json",
            ...authHeaders,
          },
        }),
      );

      return response.data.tagNames || [];
    } catch (error) {
      TempoErrorHandler.handle(
        error,
        tempoUrl,
        { url, datasourceId: datasource.id },
        { isGetAttributeNames: true },
      );
    }
  }

  async getAttributeValues(
    datasource: Datasource,
    attributeName: string,
  ): Promise<string[]> {
    const tempoUrl = this.getTempoUrl(datasource);
    const url = `${tempoUrl}/api/search/tag/${encodeURIComponent(attributeName)}/values`;

    try {
      const authHeaders =
        this.datasourceAuthService.buildAuthHeaders(datasource);
      const response = await firstValueFrom(
        this.httpService.get<TempoAttributeValuesResponse>(url, {
          headers: {
            "Content-Type": "application/json",
            ...authHeaders,
          },
        }),
      );

      return response.data.tagValues || [];
    } catch (error) {
      TempoErrorHandler.handle(
        error,
        tempoUrl,
        { url, attributeName, datasourceId: datasource.id },
        { isGetAttributeValues: true },
      );
    }
  }
}
