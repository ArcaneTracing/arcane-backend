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
import type { TimeRangeDto } from "../../dto/time-range.dto";
import type {
  TempoTraceResponse,
  TempoTraceSearchResponse,
} from "../tempo/tempo.types";
import { Datasource } from "src/datasources/entities/datasource.entity";
import { SearchTracesRequestDto } from "../../dto/request/search-traces-request.dto";
import {
  ERROR_MESSAGES,
  formatError,
} from "src/common/constants/error-messages.constants";
import { CustomApiRequestBuilder } from "./custom-api.request.builder";
import {
  CustomApiErrorHandler,
  CustomApiErrorContext,
} from "./custom-api.error.handler";
import { CustomApiConfigMapper } from "./custom-api.config.mapper";
import { TraceFilterUtil } from "../common/trace-filter.util";
import { DatasourceConfigEncryptionService } from "src/datasources/services/datasource-config-encryption.service";

@Injectable()
export class CustomApiTraceRepository implements TraceRepository {
  private readonly logger = new Logger(CustomApiTraceRepository.name);

  constructor(
    private readonly httpService: HttpService,
    private readonly traceFilterUtil: TraceFilterUtil,
    private readonly configEncryptionService: DatasourceConfigEncryptionService,
  ) {}

  private mergeProjectFilter(
    searchParams: SearchTracesRequestDto,
    projectTraceFilter: ProjectTraceFilter | undefined,
    config: ReturnType<typeof CustomApiConfigMapper.map>,
  ): SearchTracesRequestDto {
    if (!projectTraceFilter) {
      return searchParams;
    }

    if (config.capabilities?.searchByAttributes) {
      const filterAttr = `${projectTraceFilter.attributeName}=${projectTraceFilter.attributeValue}`;

      const mergedParams = { ...searchParams };

      if (searchParams.attributes) {
        mergedParams.attributes = `${searchParams.attributes} ${filterAttr}`;
      } else {
        mergedParams.attributes = filterAttr;
      }

      this.logger.debug(
        `Applied project trace filter server-side: ${filterAttr}`,
      );
      return mergedParams;
    }

    return searchParams;
  }

  async search(
    datasource: Datasource,
    searchParams: SearchTracesRequestDto,
    projectTraceFilter?: ProjectTraceFilter,
  ): Promise<TempoTraceSearchResponse> {
    const decryptedConfig = this.configEncryptionService.decryptConfig(
      datasource.source,
      datasource.config || {},
    );
    const datasourceWithDecryptedConfig = {
      ...datasource,
      config: decryptedConfig,
    };
    const config = CustomApiConfigMapper.map(datasourceWithDecryptedConfig);

    const mergedParams = this.mergeProjectFilter(
      searchParams,
      projectTraceFilter,
      config,
    );

    this.validateSearchCapabilities(config, mergedParams);

    try {
      const headers = CustomApiRequestBuilder.buildHeaders(config);
      const params = CustomApiRequestBuilder.buildSearchParams(
        mergedParams,
        config,
      );
      const url = CustomApiRequestBuilder.buildUrl(
        config.baseUrl,
        config.endpoints.search.path,
      );

      this.logger.debug("Custom API search request", {
        url,
        params,
        hasAuth: !!config.authentication,
        projectTraceFilter,
      });

      const response = await firstValueFrom(
        this.httpService.get(url, {
          headers,
          params,
        }),
      );

      let result = CustomApiRequestBuilder.parseSearchResponse(response.data);

      if (projectTraceFilter && !config.capabilities?.searchByAttributes) {
        result = {
          ...result,
          traces: this.traceFilterUtil.filterTraceSummaries(
            result.traces || [],
            projectTraceFilter,
          ),
        };
        this.logger.debug("Applied project filter client-side", {
          originalCount: result.traces?.length ?? 0,
          filteredCount: result.traces?.length ?? 0,
        });
      }

      return result;
    } catch (error) {
      return this.handleSearchError(error, config, datasource, mergedParams);
    }
  }

  private validateSearchCapabilities(
    config: ReturnType<typeof CustomApiConfigMapper.map>,
    searchParams: SearchTracesRequestDto,
  ): void {
    if (searchParams.q && !config.capabilities?.searchByQuery) {
      throw new BadRequestException(
        formatError(ERROR_MESSAGES.SEARCH_BY_QUERY_NOT_SUPPORTED, "custom_api"),
      );
    }
    if (searchParams.attributes && !config.capabilities?.searchByAttributes) {
      throw new BadRequestException(
        formatError(
          ERROR_MESSAGES.SEARCH_BY_ATTRIBUTES_NOT_SUPPORTED,
          "custom_api",
        ),
      );
    }
    if (
      searchParams.filterByAttributeExists?.length > 0 &&
      !config.capabilities?.filterByAttributeExists
    ) {
      throw new BadRequestException(
        formatError(
          ERROR_MESSAGES.FILTER_BY_ATTRIBUTE_EXISTS_NOT_SUPPORTED,
          "custom_api",
        ),
      );
    }
  }

  private handleSearchError(
    error: unknown,
    config: ReturnType<typeof CustomApiConfigMapper.map>,
    datasource: Datasource,
    searchParams: SearchTracesRequestDto,
  ): TempoTraceSearchResponse {
    const context: CustomApiErrorContext = {
      url: config.baseUrl,
      datasourceId: datasource.id,
      searchParams,
    };
    try {
      CustomApiErrorHandler.handle(error, config.baseUrl, context, {
        isSearch: true,
      });
    } catch (handledError) {
      if (
        handledError instanceof Error &&
        handledError.message === "EMPTY_RESULT"
      ) {
        return { traces: [] };
      }
      throw handledError;
    }
  }

  async searchByTraceId(
    datasource: Datasource,
    traceId: string,
    timeRange?: TimeRangeDto,
    projectTraceFilter?: ProjectTraceFilter,
  ): Promise<TempoTraceResponse> {
    const decryptedConfig = this.configEncryptionService.decryptConfig(
      datasource.source,
      datasource.config || {},
    );
    const datasourceWithDecryptedConfig = {
      ...datasource,
      config: decryptedConfig,
    };
    const config = CustomApiConfigMapper.map(datasourceWithDecryptedConfig);

    try {
      const headers = CustomApiRequestBuilder.buildHeaders(config);
      const path = config.endpoints.searchByTraceId.path.replace(
        "{traceId}",
        traceId,
      );
      const url = CustomApiRequestBuilder.buildUrl(config.baseUrl, path);
      const params =
        CustomApiRequestBuilder.buildSearchByTraceIdParams(timeRange);

      this.logger.debug("Custom API trace by ID request", {
        url,
        traceId,
        hasAuth: !!config.authentication,
      });

      const response = await firstValueFrom(
        this.httpService.get(url, {
          headers,
          params: Object.keys(params).length > 0 ? params : undefined,
        }),
      );

      const trace = CustomApiRequestBuilder.parseTraceResponse(response.data);

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
      const context: CustomApiErrorContext = {
        url: config.baseUrl,
        datasourceId: datasource.id,
        traceId,
      };
      CustomApiErrorHandler.handle(error, config.baseUrl, context, { traceId });
    }
  }

  async getAttributeNames(datasource: Datasource): Promise<string[]> {
    const decryptedConfig = this.configEncryptionService.decryptConfig(
      datasource.source,
      datasource.config || {},
    );
    const datasourceWithDecryptedConfig = {
      ...datasource,
      config: decryptedConfig,
    };
    const config = CustomApiConfigMapper.map(datasourceWithDecryptedConfig);

    if (!config.capabilities?.getAttributeNames) {
      throw new BadRequestException(
        formatError(
          ERROR_MESSAGES.GET_ATTRIBUTE_NAMES_NOT_SUPPORTED,
          datasource.source,
        ),
      );
    }

    if (!config.endpoints.attributeNames?.path) {
      throw new InternalServerErrorException(
        formatError(ERROR_MESSAGES.TRACE_QUERY_FAILED),
      );
    }

    try {
      const headers = CustomApiRequestBuilder.buildHeaders(config);
      const url = CustomApiRequestBuilder.buildUrl(
        config.baseUrl,
        config.endpoints.attributeNames.path,
      );

      this.logger.debug("Custom API get attribute names request", {
        url,
        hasAuth: !!config.authentication,
      });

      const response = await firstValueFrom(
        this.httpService.get(url, { headers }),
      );

      return CustomApiRequestBuilder.parseAttributeNamesResponse(response.data);
    } catch (error) {
      const context: CustomApiErrorContext = {
        url: config.baseUrl,
        datasourceId: datasource.id,
      };
      CustomApiErrorHandler.handle(error, config.baseUrl, context, {
        isGetAttributeNames: true,
      });
    }
  }

  async getAttributeValues(
    datasource: Datasource,
    attributeName: string,
  ): Promise<string[]> {
    const decryptedConfig = this.configEncryptionService.decryptConfig(
      datasource.source,
      datasource.config || {},
    );
    const datasourceWithDecryptedConfig = {
      ...datasource,
      config: decryptedConfig,
    };
    const config = CustomApiConfigMapper.map(datasourceWithDecryptedConfig);

    if (!config.capabilities?.getAttributeValues) {
      throw new BadRequestException(
        formatError(
          ERROR_MESSAGES.GET_ATTRIBUTE_VALUES_NOT_SUPPORTED,
          datasource.source,
        ),
      );
    }

    if (!config.endpoints.attributeValues?.path) {
      throw new InternalServerErrorException(
        formatError(ERROR_MESSAGES.TRACE_QUERY_FAILED),
      );
    }

    try {
      const headers = CustomApiRequestBuilder.buildHeaders(config);
      const path = config.endpoints.attributeValues.path.replace(
        "{attributeName}",
        attributeName,
      );
      const url = CustomApiRequestBuilder.buildUrl(config.baseUrl, path);

      this.logger.debug("Custom API get attribute values request", {
        url,
        attributeName,
        hasAuth: !!config.authentication,
      });

      const response = await firstValueFrom(
        this.httpService.get(url, { headers }),
      );

      return CustomApiRequestBuilder.parseAttributeValuesResponse(
        response.data,
      );
    } catch (error) {
      const context: CustomApiErrorContext = {
        url: config.baseUrl,
        datasourceId: datasource.id,
        attributeName,
      };
      CustomApiErrorHandler.handle(error, config.baseUrl, context, {
        isGetAttributeValues: true,
      });
    }
  }
}
