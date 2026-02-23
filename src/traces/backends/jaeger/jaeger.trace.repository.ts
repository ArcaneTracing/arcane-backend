import {
  Injectable,
  Logger,
  BadRequestException,
  InternalServerErrorException,
  NotFoundException,
} from "@nestjs/common";
import { HttpService } from "@nestjs/axios";
import { firstValueFrom } from "rxjs";
import {
  TraceRepository,
  ProjectTraceFilter,
} from "../trace-repository.interface";
import { Datasource } from "src/datasources/entities/datasource.entity";
import { SearchTracesRequestDto } from "../../dto/request/search-traces-request.dto";
import { JaegerParamsBuilder } from "./jaeger.params.builder";
import { JaegerResponseMapper } from "./jaeger.response.mapper";
import { JaegerErrorHandler } from "./jaeger.error.handler";
import { JaegerApiResponse, JaegerTracesData } from "./jaeger.types";
import {
  ERROR_MESSAGES,
  formatError,
} from "src/common/constants/error-messages.constants";
import type { TimeRangeDto } from "../../dto/time-range.dto";
import type {
  TempoTraceResponse,
  TempoTraceSearchResponse,
} from "../tempo/tempo.types";
import { TraceFilterUtil } from "../common/trace-filter.util";
import { DatasourceAuthService } from "src/datasources/services/datasource-auth.service";

@Injectable()
export class JaegerTraceRepository implements TraceRepository {
  private readonly logger = new Logger(JaegerTraceRepository.name);

  constructor(
    private readonly httpService: HttpService,
    private readonly traceFilterUtil: TraceFilterUtil,
    private readonly datasourceAuthService: DatasourceAuthService,
  ) {}

  private getBaseUrl(datasource: Datasource): string {
    if (!datasource.url) {
      throw new Error("Jaeger URL is required in datasource configuration");
    }
    return datasource.url.replace(/\/$/, "");
  }

  async search(
    datasource: Datasource,
    searchParams: SearchTracesRequestDto,
    projectTraceFilter?: ProjectTraceFilter,
  ): Promise<TempoTraceSearchResponse> {
    if (searchParams.attributes) {
      throw new BadRequestException(
        formatError(
          ERROR_MESSAGES.SEARCH_BY_ATTRIBUTES_NOT_SUPPORTED,
          datasource.source,
        ),
      );
    }

    const baseUrl = this.getBaseUrl(datasource);
    const params = JaegerParamsBuilder.build(searchParams);
    const queryString = params.toString();
    const url = queryString
      ? `${baseUrl}/api/v3/traces?${queryString}`
      : `${baseUrl}/api/v3/traces`;

    try {
      this.logger.debug("Making Jaeger API request", {
        url,
        searchParams,
        projectTraceFilter,
      });

      const authHeaders =
        this.datasourceAuthService.buildAuthHeaders(datasource);
      const { data } = await firstValueFrom(
        this.httpService.get<JaegerApiResponse<JaegerTracesData>>(url, {
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
            ...authHeaders,
          },
        }),
      );

      this.logger.debug("Jaeger API response received", {
        hasData: !!data,
        hasError: !!data?.error,
        hasResult: !!data?.result,
        resultType: typeof data?.result,
        resultKeys: data?.result ? Object.keys(data.result) : [],
        resourceSpansCount: data?.result?.resource_spans?.length ?? 0,
      });

      if (data?.error) {
        const errorMsg = data.error.message || "Jaeger API returned an error";
        this.logger.error("Jaeger API returned error in response", {
          error: errorMsg,
          url,
          datasourceId: datasource.id,
        });
        throw new InternalServerErrorException(
          formatError(ERROR_MESSAGES.JAEGER_API_ERROR, "unknown", errorMsg),
        );
      }

      let mappedResponse = JaegerResponseMapper.toTempoSearchResponse(
        data?.result,
      );
      const originalTraceCount = mappedResponse.traces?.length ?? 0;

      if (projectTraceFilter) {
        mappedResponse = {
          ...mappedResponse,
          traces: this.traceFilterUtil.filterTraceSummaries(
            mappedResponse.traces || [],
            projectTraceFilter,
          ),
        };
        this.logger.debug("Applied project filter client-side", {
          originalCount: originalTraceCount,
          filteredCount: mappedResponse.traces?.length ?? 0,
          filterAttribute: `${projectTraceFilter.attributeName}=${projectTraceFilter.attributeValue}`,
        });
      }

      this.logger.debug("Mapped response", {
        tracesCount: mappedResponse.traces?.length ?? 0,
      });

      return mappedResponse;
    } catch (error) {
      try {
        JaegerErrorHandler.handle(
          error,
          baseUrl,
          { url, datasourceId: datasource.id, searchParams },
          { allowEmptyResultOn404: true, isSearch: true },
        );
      } catch (handlerError) {
        if (
          handlerError instanceof Error &&
          handlerError.message === "EMPTY_RESULT"
        ) {
          return { traces: [] };
        }
        throw handlerError;
      }
    }
  }

  async searchByTraceId(
    datasource: Datasource,
    traceId: string,
    timeRange?: TimeRangeDto,
    projectTraceFilter?: ProjectTraceFilter,
  ): Promise<TempoTraceResponse> {
    const baseUrl = this.getBaseUrl(datasource);
    const url = `${baseUrl}/api/v3/traces/${traceId}`;

    try {
      const authHeaders =
        this.datasourceAuthService.buildAuthHeaders(datasource);
      const { data } = await firstValueFrom(
        this.httpService.get<JaegerApiResponse<JaegerTracesData>>(url, {
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
            ...authHeaders,
          },
        }),
      );

      if (data?.error) {
        const errorMsg = data.error.message || "Jaeger API returned an error";
        this.logger.error("Jaeger API returned error in response", {
          error: errorMsg,
          url,
          traceId,
          datasourceId: datasource.id,
        });
        throw new InternalServerErrorException(
          formatError(ERROR_MESSAGES.JAEGER_API_ERROR, "unknown", errorMsg),
        );
      }

      const trace = JaegerResponseMapper.toTempoTraceResponse(
        data?.result,
        traceId,
      );

      if (
        projectTraceFilter &&
        !this.traceFilterUtil.filterFullTrace(trace, projectTraceFilter)
      ) {
        throw new NotFoundException(
          formatError(ERROR_MESSAGES.TRACE_NOT_FOUND, traceId),
        );
      }

      return trace as unknown as TempoTraceResponse;
    } catch (error) {
      JaegerErrorHandler.handle(
        error,
        baseUrl,
        { url, traceId, datasourceId: datasource.id },
        { traceId, isSearch: false },
      );
    }
  }

  async getAttributeNames(datasource: Datasource): Promise<string[]> {
    throw new BadRequestException(
      formatError(
        ERROR_MESSAGES.GET_ATTRIBUTE_NAMES_NOT_SUPPORTED,
        datasource.source,
      ),
    );
  }

  async getAttributeValues(
    datasource: Datasource,
    attributeName: string,
  ): Promise<string[]> {
    throw new BadRequestException(
      formatError(
        ERROR_MESSAGES.GET_ATTRIBUTE_VALUES_NOT_SUPPORTED,
        datasource.source,
      ),
    );
  }
}
