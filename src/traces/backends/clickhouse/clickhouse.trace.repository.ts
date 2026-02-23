import {
  Injectable,
  Logger,
  InternalServerErrorException,
  NotFoundException,
} from "@nestjs/common";
import { createClient, ClickHouseClient } from "@clickhouse/client";
import { SearchTracesRequestDto } from "../../dto/request/search-traces-request.dto";
import { Datasource } from "src/datasources/entities/datasource.entity";
import {
  TraceRepository,
  ProjectTraceFilter,
} from "../trace-repository.interface";
import { ClickHouseQueryBuilder } from "./clickhouse.query.builder";
import { ClickHouseResponseMapper } from "./clickhouse.response.mapper";
import { ClickHouseErrorHandler } from "./clickhouse.error.handler";
import { TraceFilterUtil } from "../common/trace-filter.util";
import {
  ERROR_MESSAGES,
  formatError,
} from "src/common/constants/error-messages.constants";
import type { TimeRangeDto } from "../../dto/time-range.dto";
import { DatasourceConfigEncryptionService } from "src/datasources/services/datasource-config-encryption.service";

export interface ClickHouseConfig {
  host: string;
  port: number;
  database: string;
  username?: string;
  password?: string;
  tableName: string;
  protocol?: "http" | "https";
}

@Injectable()
export class ClickHouseTraceRepository implements TraceRepository {
  private readonly logger = new Logger(ClickHouseTraceRepository.name);
  private readonly clients: Map<string, ClickHouseClient> = new Map();

  constructor(
    private readonly traceFilterUtil: TraceFilterUtil,
    private readonly configEncryptionService: DatasourceConfigEncryptionService,
  ) {}

  private getClickHouseConfig(datasource: Datasource): ClickHouseConfig {
    const decryptedConfig = this.configEncryptionService.decryptConfig(
      datasource.source,
      datasource.config || {},
    );
    if (decryptedConfig.clickhouse) {
      const config = decryptedConfig.clickhouse as Partial<ClickHouseConfig>;

      if (!config.host || !config.database || !config.tableName) {
        throw new InternalServerErrorException(
          formatError(
            ERROR_MESSAGES.CLICKHOUSE_CONNECTION_ERROR,
            "unknown",
            "Missing required configuration: host, database, or tableName",
          ),
        );
      }

      return {
        host: config.host,
        port: config.port || 8123,
        database: config.database,
        username: config.username,
        password: config.password,
        tableName: config.tableName,
        protocol: config.protocol || "http",
      };
    }

    if (!datasource.url) {
      throw new InternalServerErrorException(
        formatError(
          ERROR_MESSAGES.CLICKHOUSE_CONNECTION_ERROR,
          "unknown",
          "ClickHouse config or URL is required",
        ),
      );
    }

    try {
      const urlObj = new URL(datasource.url);
      const protocol =
        (urlObj.protocol.replace(":", "") as "http" | "https") || "http";
      const host = urlObj.hostname || "localhost";
      const port = Number.parseInt(urlObj.port || "8123", 10);
      const database = urlObj.pathname.slice(1) || "default";
      const username = urlObj.username || undefined;
      const password = urlObj.password || undefined;

      const tableName = urlObj.searchParams.get("table") || "traces";

      return {
        host,
        port,
        database,
        username,
        password,
        tableName,
        protocol,
      };
    } catch (error) {
      this.logger.error("Error parsing ClickHouse URL:", error);
      throw new InternalServerErrorException(
        formatError(
          ERROR_MESSAGES.CLICKHOUSE_CONNECTION_ERROR,
          datasource.url || "unknown",
          "Invalid URL format",
        ),
      );
    }
  }

  protected getClient(datasource: Datasource): ClickHouseClient {
    const cacheKey = datasource.id;

    const cached = this.clients.get(cacheKey);
    if (cached) return cached;

    const config = this.getClickHouseConfig(datasource);

    const client = createClient({
      host: `${config.protocol}://${config.host}:${config.port}`,
      database: config.database,
      username: config.username || "default",
      password: config.password || "",
    });

    this.clients.set(cacheKey, client);
    return client;
  }

  protected getTableName(datasource: Datasource): string {
    const config = this.getClickHouseConfig(datasource);
    return config.tableName;
  }

  public getClientForConversations(datasource: Datasource): ClickHouseClient {
    return this.getClient(datasource);
  }

  public getTableNameForConversations(datasource: Datasource): string {
    return this.getTableName(datasource);
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

    if (searchParams.attributes) {
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
  ): Promise<any> {
    const mergedParams = this.mergeProjectFilter(
      searchParams,
      projectTraceFilter,
    );

    try {
      const client = this.getClient(datasource);
      const tableName = this.getTableName(datasource);

      const query = ClickHouseQueryBuilder.buildSearchQuery(
        mergedParams,
        tableName,
      );

      this.logger.debug("ClickHouse search query", {
        query,
        searchParams: mergedParams,
        tableName,
      });

      const result = await client.query({
        query,
        format: "JSONEachRow",
      });

      const rows = await result.json();
      const typedRows = Array.isArray(rows)
        ? (rows as Array<Record<string, any>>)
        : [];
      return ClickHouseResponseMapper.toTempoSearchResponse(typedRows);
    } catch (error) {
      const config = this.getClickHouseConfig(datasource);
      const clickHouseUrl = `${config.protocol}://${config.host}:${config.port}`;

      ClickHouseErrorHandler.handle(
        error,
        clickHouseUrl,
        { datasourceId: datasource.id, searchParams: mergedParams },
        { isSearch: true, tableName: config.tableName },
      );
    }
  }

  async searchByTraceId(
    datasource: Datasource,
    traceId: string,
    timeRange?: TimeRangeDto,
    projectTraceFilter?: ProjectTraceFilter,
  ): Promise<any> {
    try {
      const client = this.getClient(datasource);
      const tableName = this.getTableName(datasource);

      const query = ClickHouseQueryBuilder.buildTraceIdQuery(
        traceId,
        tableName,
        timeRange,
      );

      this.logger.debug("ClickHouse trace ID query", {
        query,
        traceId,
        tableName,
        projectTraceFilter,
      });

      const result = await client.query({
        query,
        format: "JSONEachRow",
      });

      const rows = await result.json();
      const typedRows = Array.isArray(rows)
        ? (rows as Array<Record<string, any>>)
        : [];

      this.logger.debug("ClickHouse trace ID query result", {
        rowCount: typedRows.length,
        firstRowKeys: typedRows.length > 0 ? Object.keys(typedRows[0]) : [],
        sampleRow:
          typedRows.length > 0
            ? {
                TraceId: typedRows[0].TraceId,
                SpanId: typedRows[0].SpanId,
                SpanName: typedRows[0].SpanName,
                Timestamp: typedRows[0].Timestamp,
              }
            : null,
      });

      try {
        const trace = ClickHouseResponseMapper.toTempoTraceResponse(
          typedRows,
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

        return trace;
      } catch (mapperError) {
        if (mapperError instanceof NotFoundException) {
          throw mapperError;
        }
        this.logger.error("Error transforming trace response", {
          error:
            mapperError instanceof Error
              ? mapperError.message
              : String(mapperError),
          traceId,
          rowCount: typedRows.length,
        });
        throw mapperError;
      }
    } catch (error) {
      const config = this.getClickHouseConfig(datasource);
      const clickHouseUrl = `${config.protocol}://${config.host}:${config.port}`;
      ClickHouseErrorHandler.handle(
        error,
        clickHouseUrl,
        { datasourceId: datasource.id, traceId },
        { traceId, isSearch: false, tableName: config.tableName },
      );
    }
  }

  async getAttributeNames(datasource: Datasource): Promise<string[]> {
    try {
      const client = this.getClient(datasource);
      const tableName = this.getTableName(datasource);
      const escapedTableName =
        ClickHouseQueryBuilder.escapeIdentifier(tableName);

      const query = `
        SELECT DISTINCT key
        FROM (
          SELECT arrayJoin(mapKeys(SpanAttributes)) AS key
          FROM ${escapedTableName}
          WHERE SpanAttributes != map()
          UNION ALL
          SELECT arrayJoin(mapKeys(ResourceAttributes)) AS key
          FROM ${escapedTableName}
          WHERE ResourceAttributes != map()
        )
        ORDER BY key
      `;

      const result = await client.query({
        query,
        format: "JSONEachRow",
      });

      const rows = await result.json();
      const typedRows = Array.isArray(rows)
        ? (rows as Array<{ key: string }>)
        : [];
      return typedRows.map((row) => row.key);
    } catch (error) {
      const config = this.getClickHouseConfig(datasource);
      const clickHouseUrl = `${config.protocol}://${config.host}:${config.port}`;

      ClickHouseErrorHandler.handle(
        error,
        clickHouseUrl,
        { datasourceId: datasource.id },
        { isGetAttributeNames: true, tableName: config.tableName },
      );
    }
  }

  async getAttributeValues(
    datasource: Datasource,
    attributeName: string,
  ): Promise<string[]> {
    try {
      const client = this.getClient(datasource);
      const tableName = this.getTableName(datasource);
      const escapedAttributeName =
        ClickHouseQueryBuilder.escapeString(attributeName);
      const escapedTableName =
        ClickHouseQueryBuilder.escapeIdentifier(tableName);

      const query = `
        SELECT DISTINCT value
        FROM (
          SELECT mapValues(SpanAttributes)[indexOf(mapKeys(SpanAttributes), '${escapedAttributeName}')] AS value
          FROM ${escapedTableName}
          WHERE mapContains(SpanAttributes, '${escapedAttributeName}')
          UNION ALL
          SELECT mapValues(ResourceAttributes)[indexOf(mapKeys(ResourceAttributes), '${escapedAttributeName}')] AS value
          FROM ${escapedTableName}
          WHERE mapContains(ResourceAttributes, '${escapedAttributeName}')
        )
        WHERE value != ''
        ORDER BY value
      `;

      const result = await client.query({
        query,
        format: "JSONEachRow",
      });

      const rows = await result.json();
      const typedRows = Array.isArray(rows)
        ? (rows as Array<{ value: string }>)
        : [];
      return typedRows.map((row) => row.value);
    } catch (error) {
      const config = this.getClickHouseConfig(datasource);
      const clickHouseUrl = `${config.protocol}://${config.host}:${config.port}`;

      ClickHouseErrorHandler.handle(
        error,
        clickHouseUrl,
        { datasourceId: datasource.id, attributeName },
        { isGetAttributeValues: true, tableName: config.tableName },
      );
    }
  }
}
