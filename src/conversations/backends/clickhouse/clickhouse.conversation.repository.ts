import { Injectable, Logger } from "@nestjs/common";
import {
  ConversationRepository,
  GetConversationsParams,
  GetFullConversationParams,
  GetConversationsByTraceIdsParams,
} from "../conversation-repository.interface";
import { Datasource } from "src/datasources/entities/datasource.entity";
import { ClickHouseTraceRepository } from "../../../traces/backends/clickhouse/clickhouse.trace.repository";
import { ConversationListItemResponseDto } from "src/conversations/dto/response/conversation-list-item-response.dto";
import { ClickHouseQueryBuilder } from "../../../traces/backends/clickhouse/clickhouse.query.builder";
import { TimeRangeDto } from "../../../traces/dto/time-range.dto";
import { FullConversationResponseDto } from "src/conversations/dto/response/conversation-response.dto";

@Injectable()
export class ClickHouseConversationRepository implements ConversationRepository {
  private readonly logger = new Logger(ClickHouseConversationRepository.name);

  constructor(
    private readonly clickHouseTraceRepository: ClickHouseTraceRepository,
  ) {}

  async getConversations(
    datasource: Datasource,
    attributes: string[],
    params: GetConversationsParams,
  ): Promise<ConversationListItemResponseDto[]> {
    this.logger.debug("Getting conversations from ClickHouse", {
      attributes,
      params,
    });

    if (attributes.length === 0) {
      return [];
    }

    try {
      const client =
        this.clickHouseTraceRepository.getClientForConversations(datasource);
      const tableName =
        this.clickHouseTraceRepository.getTableNameForConversations(datasource);
      const { startTimestamp, endTimestamp } = this.getTimeRange(params);
      const escapedAttributes = this.escapeAttributes(attributes);
      const escapedTableName =
        ClickHouseQueryBuilder.escapeIdentifier(tableName);

      const query = this.buildConversationsQuery(
        escapedTableName,
        escapedAttributes,
        startTimestamp,
        endTimestamp,
        params.projectTraceFilter,
      );

      this.logger.debug("ClickHouse conversations query", { query });

      const result = await client.query({ query, format: "JSONEachRow" });
      const rawRows = await result.json();
      const rows = Array.isArray(rawRows)
        ? (rawRows as Array<{
            conversationId: string;
            firstSpanName: string;
            traceIds: string[];
            traceCount: number;
          }>)
        : [];

      const conversations = rows.map((row) => ({
        conversationId: row.conversationId,
        name: row.firstSpanName || "",
        traceIds: row.traceIds || [],
        traceCount: row.traceCount || 0,
      }));

      this.logger.log(
        `Generated ${conversations.length} unique conversation values from ClickHouse`,
      );
      return conversations;
    } catch (error) {
      this.logger.error("Error getting conversations from ClickHouse:", {
        error: error.message,
        stack: error.stack,
        attributes,
        params,
      });
      throw error;
    }
  }

  async getFullConversation(
    datasource: Datasource,
    attributes: string[],
    params: GetFullConversationParams,
  ): Promise<FullConversationResponseDto> {
    this.logger.debug("Getting full conversation from ClickHouse", {
      attributes,
      params,
    });

    if (attributes.length === 0) {
      return { traces: [] };
    }

    const clickHouseQuery = this.buildAttributeValueQuery(
      attributes,
      params.value,
    );

    const attributesFilter = params.projectTraceFilter
      ? `${params.projectTraceFilter.attributeName}=${params.projectTraceFilter.attributeValue}`
      : undefined;

    const searchResult = await this.clickHouseTraceRepository.search(
      datasource,
      {
        start: params.start,
        end: params.end,
        q: clickHouseQuery,
        attributes: attributesFilter,
      },
    );

    const traceIds = this.extractTraceIds(searchResult.traces || []);
    this.logger.debug(
      `Found ${traceIds.length} unique trace IDs for conversation value: ${params.value}`,
    );

    const traces = await this.fetchFullTraces(
      datasource,
      traceIds,
      params.start,
      params.end,
    );
    this.logger.log(
      `Fetched ${traces.length} full traces for conversation value: ${params.value}`,
    );
    return { traces };
  }

  async getConversationsByTraceIds(
    datasource: Datasource,
    params: GetConversationsByTraceIdsParams,
  ): Promise<FullConversationResponseDto> {
    this.logger.debug("Getting conversations by trace IDs from ClickHouse", {
      traceIds: params.traceIds,
    });

    const timeRange = this.buildTimeRange(params.startDate, params.endDate);
    const traces = await this.fetchTracesByIds(
      datasource,
      params.traceIds,
      timeRange,
    );

    const filteredTraces = params.projectTraceFilter
      ? this.filterTracesByProjectFilter(traces, params.projectTraceFilter)
      : traces;

    this.logger.log(
      `Fetched ${filteredTraces.length} full traces for ${params.traceIds.length} trace IDs (after project filter: ${params.projectTraceFilter ? "applied" : "none"})`,
    );
    return { traces: filteredTraces };
  }

  private getTimeRange(params: GetConversationsParams): {
    startTimestamp: number;
    endTimestamp: number;
  } {
    const now = params.end
      ? Math.floor(new Date(params.end).getTime() / 1000)
      : Math.floor(Date.now() / 1000);
    const oneHourAgo = params.start
      ? Math.floor(new Date(params.start).getTime() / 1000)
      : now - 3600;
    return { startTimestamp: oneHourAgo, endTimestamp: now };
  }

  private escapeAttributes(attributes: string[]): string {
    return attributes
      .map((attr) => `'${ClickHouseQueryBuilder.escapeString(attr)}'`)
      .join(", ");
  }

  private buildConversationsQuery(
    tableName: string,
    escapedAttributes: string,
    startTimestamp: number,
    endTimestamp: number,
    projectTraceFilter?: { attributeName: string; attributeValue: string },
  ): string {
    const projectFilterCondition = projectTraceFilter
      ? `AND (
        (mapContains(SpanAttributes, '${ClickHouseQueryBuilder.escapeString(projectTraceFilter.attributeName)}') 
         AND mapValues(SpanAttributes)[indexOf(mapKeys(SpanAttributes), '${ClickHouseQueryBuilder.escapeString(projectTraceFilter.attributeName)}')] = '${ClickHouseQueryBuilder.escapeString(projectTraceFilter.attributeValue)}')
        OR
        (mapContains(ResourceAttributes, '${ClickHouseQueryBuilder.escapeString(projectTraceFilter.attributeName)}') 
         AND mapValues(ResourceAttributes)[indexOf(mapKeys(ResourceAttributes), '${ClickHouseQueryBuilder.escapeString(projectTraceFilter.attributeName)}')] = '${ClickHouseQueryBuilder.escapeString(projectTraceFilter.attributeValue)}')
        )`
      : "";

    return `
      SELECT 
        attribute_value AS conversationId,
        argMin(SpanName, Timestamp) AS firstSpanName,
        groupArray(DISTINCT TraceId) AS traceIds,
        count(DISTINCT TraceId) AS traceCount
      FROM (
        SELECT 
          TraceId,
          SpanName,
          Timestamp,
          mapValues(SpanAttributes)[indexOf(mapKeys(SpanAttributes), key)] AS attribute_value
        FROM ${tableName}
        ARRAY JOIN mapKeys(SpanAttributes) AS key
        WHERE 
          Timestamp >= ${startTimestamp}
          AND Timestamp <= ${endTimestamp}
          AND key IN (${escapedAttributes})
          AND mapContains(SpanAttributes, key)
          AND mapValues(SpanAttributes)[indexOf(mapKeys(SpanAttributes), key)] != ''
          ${projectFilterCondition}
        
        UNION ALL
        
        SELECT 
          TraceId,
          SpanName,
          Timestamp,
          mapValues(ResourceAttributes)[indexOf(mapKeys(ResourceAttributes), key)] AS attribute_value
        FROM ${tableName}
        ARRAY JOIN mapKeys(ResourceAttributes) AS key
        WHERE 
          Timestamp >= ${startTimestamp}
          AND Timestamp <= ${endTimestamp}
          AND key IN (${escapedAttributes})
          AND mapContains(ResourceAttributes, key)
          AND mapValues(ResourceAttributes)[indexOf(mapKeys(ResourceAttributes), key)] != ''
          ${projectFilterCondition}
      )
      GROUP BY attribute_value
      ORDER BY traceCount DESC
      LIMIT 10000
    `;
  }

  private buildAttributeValueQuery(
    attributes: string[],
    value: string,
  ): string {
    return attributes.map((attr) => `${attr} = "${value}"`).join(" OR ");
  }

  private buildTimeRange(
    startDate?: string,
    endDate?: string,
  ): TimeRangeDto | undefined {
    return startDate && endDate
      ? { start: startDate, end: endDate }
      : undefined;
  }

  private extractTraceIds(traces: any[]): string[] {
    return [
      ...new Set(
        traces
          .map((trace) => trace.traceID)
          .filter(
            (id): id is string => typeof id === "string" && id.length > 0,
          ),
      ),
    ];
  }

  private async fetchFullTraces(
    datasource: Datasource,
    traceIds: string[],
    start?: string,
    end?: string,
  ): Promise<any[]> {
    const timeRange = this.buildTimeRange(start, end);
    return this.fetchTracesByIds(datasource, traceIds, timeRange);
  }

  private async fetchTracesByIds(
    datasource: Datasource,
    traceIds: string[],
    timeRange?: TimeRangeDto,
  ): Promise<any[]> {
    const traces = await Promise.all(
      traceIds.map(async (traceId) => {
        try {
          return await this.clickHouseTraceRepository.searchByTraceId(
            datasource,
            traceId,
            timeRange,
          );
        } catch (error) {
          this.logger.warn(`Failed to fetch trace ${traceId}:`, error.message);
          return null;
        }
      }),
    );

    return traces.filter((trace) => trace !== null);
  }

  private filterTracesByProjectFilter(
    traces: any[],
    projectTraceFilter: { attributeName: string; attributeValue: string },
  ): any[] {
    return traces.filter((trace) =>
      this.traceMatchesProjectFilter(trace, projectTraceFilter),
    );
  }

  private traceMatchesProjectFilter(
    trace: any,
    filter: { attributeName: string; attributeValue: string },
  ): boolean {
    return (
      this.hasMatchingResourceAttributes(trace.resourceSpans, filter) ||
      this.hasMatchingSpanAttributes(trace.spanSet?.spans, filter)
    );
  }

  private hasMatchingResourceAttributes(
    resourceSpans: any[] | undefined,
    filter: { attributeName: string; attributeValue: string },
  ): boolean {
    if (!resourceSpans?.length) return false;
    return resourceSpans.some(
      (rs) =>
        rs.resource?.attributes &&
        this.attributesContainMatch(rs.resource.attributes, filter),
    );
  }

  private hasMatchingSpanAttributes(
    spans: any[] | undefined,
    filter: { attributeName: string; attributeValue: string },
  ): boolean {
    if (!spans?.length) return false;
    return spans.some(
      (span) =>
        span.attributes && this.attributesContainMatch(span.attributes, filter),
    );
  }

  private attributesContainMatch(
    attributes: any[],
    filter: { attributeName: string; attributeValue: string },
  ): boolean {
    return attributes.some(
      (attr) =>
        attr.key === filter.attributeName &&
        this.extractAttributeValue(attr) === filter.attributeValue,
    );
  }

  private extractAttributeValue(attr: any): string | null {
    if (attr.value?.stringValue) {
      return attr.value.stringValue;
    }
    if (attr.value?.intValue !== undefined) {
      return String(attr.value.intValue);
    }
    if (attr.value?.doubleValue !== undefined) {
      return String(attr.value.doubleValue);
    }
    return null;
  }
}
