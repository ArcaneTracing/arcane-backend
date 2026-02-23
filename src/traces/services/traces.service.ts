import {
  Injectable,
  Logger,
  ForbiddenException,
  NotFoundException,
  BadRequestException,
  InternalServerErrorException,
} from "@nestjs/common";
import {
  ERROR_MESSAGES,
  formatError,
} from "../../common/constants/error-messages.constants";
import { SearchTracesRequestDto } from "../dto/request/search-traces-request.dto";
import { TraceRepositoryFactory } from "../backends/trace-repository.factory";
import { ProjectTraceFilter } from "../backends/trace-repository.interface";
import { DatasourcesService } from "../../datasources/services/datasources.service";
import { ProjectManagementService } from "../../projects/services/project-management.service";
import { TraceAttributeObfuscationService } from "./trace-attribute-obfuscation.service";
import { TraceQueryErrorHandler } from "./trace-query-error.handler";
import {
  TempoTraceResponse,
  TempoTraceSearchResponse,
} from "../backends/tempo/tempo.types";
import type { TimeRangeDto } from "../dto/time-range.dto";
import { Datasource } from "src/datasources/entities/datasource.entity";

@Injectable()
export class TracesService {
  private readonly logger = new Logger(TracesService.name);

  constructor(
    private readonly dataSourceService: DatasourcesService,
    private readonly traceRepositoryFactory: TraceRepositoryFactory,
    private readonly projectManagementService: ProjectManagementService,
    private readonly obfuscationService: TraceAttributeObfuscationService,
  ) {}

  private async getDatasourceOrThrow(
    organisationId: string,
    datasourceId: string,
  ): Promise<Datasource> {
    const datasource = await this.dataSourceService.findById(datasourceId);
    if (!datasource) {
      throw new NotFoundException(
        formatError(ERROR_MESSAGES.DATASOURCE_NOT_FOUND, datasourceId),
      );
    }

    if (datasource.organisationId !== organisationId) {
      throw new ForbiddenException(
        formatError(ERROR_MESSAGES.DATASOURCE_DOES_NOT_BELONG_TO_ORGANISATION),
      );
    }

    return datasource;
  }

  private buildProjectTraceFilter(project: {
    traceFilterAttributeName?: string;
    traceFilterAttributeValue?: string;
  }): ProjectTraceFilter | undefined {
    if (
      !project.traceFilterAttributeName ||
      !project.traceFilterAttributeValue
    ) {
      return undefined;
    }

    return {
      attributeName: project.traceFilterAttributeName,
      attributeValue: project.traceFilterAttributeValue,
    };
  }

  async search(
    organisationId: string,
    projectId: string,
    datasourceId: string,
    userId: string,
    searchParams: SearchTracesRequestDto,
  ): Promise<TempoTraceSearchResponse> {
    this.logger.debug(
      `Searching traces for project ${projectId}, datasource ${datasourceId}`,
      {
        userId,
        searchParams,
      },
    );

    const datasource = await this.getDatasourceOrThrow(
      organisationId,
      datasourceId,
    );

    const project =
      await this.projectManagementService.getByIdAndOrganisationOrThrow(
        organisationId,
        projectId,
      );

    const projectTraceFilter = this.buildProjectTraceFilter(project);

    try {
      const repository = this.traceRepositoryFactory.getRepository(
        datasource.source,
      );
      const results = await repository.search(
        datasource,
        searchParams,
        projectTraceFilter,
      );
      this.logger.log(`Found traces for datasource ${datasourceId}`);
      const obfuscated = await this.obfuscationService.obfuscateSearchResponse(
        results as unknown as Record<string, unknown>,
        projectId,
        organisationId,
        userId,
      );
      return obfuscated as unknown as TempoTraceSearchResponse;
    } catch (error) {
      if (error instanceof InternalServerErrorException) {
        throw error;
      }

      this.logger.error("Error searching traces:", error);
      throw new InternalServerErrorException(
        formatError(ERROR_MESSAGES.TRACE_SEARCH_FAILED),
      );
    }
  }

  async searchByTraceId(
    organisationId: string,
    projectId: string,
    datasourceId: string,
    userId: string,
    traceId: string,
    timeRange?: TimeRangeDto,
  ): Promise<TempoTraceResponse> {
    this.logger.debug(
      `Searching trace ${traceId} for project ${projectId}, datasource ${datasourceId}`,
      {
        userId,
        timeRange,
      },
    );

    const datasource = await this.getDatasourceOrThrow(
      organisationId,
      datasourceId,
    );

    const project =
      await this.projectManagementService.getByIdAndOrganisationOrThrow(
        organisationId,
        projectId,
      );

    const projectTraceFilter = this.buildProjectTraceFilter(project);

    try {
      const repository = this.traceRepositoryFactory.getRepository(
        datasource.source,
      );
      const result = await repository.searchByTraceId(
        datasource,
        traceId,
        timeRange,
        projectTraceFilter,
      );
      this.logger.log(`Found trace ${traceId} for datasource ${datasourceId}`);
      const obfuscated = await this.obfuscationService.obfuscateTraceResponse(
        result as unknown as Record<string, unknown>,
        projectId,
        organisationId,
        userId,
      );
      return obfuscated as unknown as TempoTraceResponse;
    } catch (error) {
      TraceQueryErrorHandler.handleSearchByTraceIdError(error, datasource, {
        datasourceId,
        traceId,
        datasourceUrl: datasource.url,
      });
    }
  }

  async getAttributeNames(
    organisationId: string,
    projectId: string,
    datasourceId: string,
    userId: string,
  ): Promise<string[]> {
    this.logger.debug(
      `Getting attribute names for project ${projectId}, datasource ${datasourceId}`,
      {
        userId,
      },
    );

    const datasource = await this.getDatasourceOrThrow(
      organisationId,
      datasourceId,
    );

    try {
      const repository = this.traceRepositoryFactory.getRepository(
        datasource.source,
      );
      const attributeNames = await repository.getAttributeNames(datasource);
      this.logger.log(
        `Found ${attributeNames.length} attribute names for datasource ${datasourceId}`,
      );
      return attributeNames;
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      this.logger.error("Error getting attribute names:", error);
      throw new InternalServerErrorException(
        formatError(ERROR_MESSAGES.TRACE_QUERY_FAILED),
      );
    }
  }

  async getAttributeValues(
    organisationId: string,
    projectId: string,
    datasourceId: string,
    userId: string,
    attributeName: string,
  ): Promise<string[]> {
    this.logger.debug(
      `Getting values for attribute ${attributeName} for project ${projectId}, datasource ${datasourceId}`,
      {
        userId,
      },
    );

    const datasource = await this.getDatasourceOrThrow(
      organisationId,
      datasourceId,
    );

    try {
      const repository = this.traceRepositoryFactory.getRepository(
        datasource.source,
      );
      const values = await repository.getAttributeValues(
        datasource,
        attributeName,
      );
      this.logger.log(
        `Found ${values.length} values for attribute ${attributeName} in datasource ${datasourceId}`,
      );
      return values;
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      this.logger.error(
        `Error getting values for attribute ${attributeName}:`,
        error,
      );
      throw new InternalServerErrorException(
        formatError(ERROR_MESSAGES.TRACE_QUERY_FAILED),
      );
    }
  }
}
