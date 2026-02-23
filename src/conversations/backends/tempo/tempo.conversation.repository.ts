import { Injectable, Logger } from "@nestjs/common";
import {
  ConversationRepository,
  GetConversationsParams,
  GetFullConversationParams,
  GetConversationsByTraceIdsParams,
} from "../conversation-repository.interface";
import { Datasource } from "src/datasources/entities/datasource.entity";
import { TempoTraceRepository } from "../../../traces/backends/tempo/tempo.trace.repository";
import { ConversationListItemResponseDto } from "src/conversations/dto/response/conversation-list-item-response.dto";
import { TimeRangeDto } from "../../../traces/dto/time-range.dto";
import { FullConversationResponseDto } from "src/conversations/dto/response/conversation-response.dto";

@Injectable()
export class TempoConversationRepository implements ConversationRepository {
  private readonly logger = new Logger(TempoConversationRepository.name);

  constructor(private readonly tempoTraceRepository: TempoTraceRepository) {}

  async getConversations(
    datasource: Datasource,
    attributes: string[],
    params: GetConversationsParams,
  ): Promise<ConversationListItemResponseDto[]> {
    this.logger.debug("Getting conversations from Tempo", {
      attributes,
      params,
    });

    if (attributes.length === 0) {
      return [];
    }

    const tempoQuery = this.buildNonEmptyAttributesQuery(attributes);
    const { start, end } = this.getTimeRange(params);

    const searchResponse = await this.tempoTraceRepository.search(
      datasource,
      {
        limit: 10000,
        q: tempoQuery,
        start,
        end,
      },
      params.projectTraceFilter,
    );

    if (!searchResponse.traces?.length) {
      return [];
    }

    const conversationMap = this.extractConversationsFromTraces(
      searchResponse.traces,
      attributes,
    );

    const conversations = this.mapToConversationListItems(conversationMap);
    this.logger.log(
      `Generated ${conversations.length} unique conversation values from Tempo`,
    );
    return conversations;
  }

  async getFullConversation(
    datasource: Datasource,
    attributes: string[],
    params: GetFullConversationParams,
  ): Promise<FullConversationResponseDto> {
    this.logger.debug("Getting full conversation from Tempo", {
      attributes,
      params,
    });

    if (attributes.length === 0) {
      return { traces: [] };
    }

    const tempoQuery = this.buildAttributeValueQuery(attributes, params.value);

    const searchResult = await this.tempoTraceRepository.search(
      datasource,
      {
        start: params.start,
        end: params.end,
        q: tempoQuery,
      },
      params.projectTraceFilter,
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
      params.projectTraceFilter,
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
    this.logger.debug("Getting conversations by trace IDs from Tempo", {
      traceIds: params.traceIds,
    });

    const timeRange = this.buildTimeRange(params.startDate, params.endDate);
    const traces = await this.fetchTracesByIds(
      datasource,
      params.traceIds,
      timeRange,
      params.projectTraceFilter,
    );

    this.logger.log(
      `Fetched ${traces.length} full traces for ${params.traceIds.length} trace IDs`,
    );
    return { traces };
  }

  private buildNonEmptyAttributesQuery(attributes: string[]): string {
    const conditions = attributes.map(
      (attr) => `span."${attr}" != nil && span."${attr}" != ""`,
    );
    return `{ ${conditions.join(" || ")} }`;
  }

  private buildAttributeValueQuery(
    attributes: string[],
    value: string,
  ): string {
    const conditions = attributes.map((attr) => `span."${attr}" = "${value}"`);
    return `{ ${conditions.join(" || ")} }`;
  }

  private getTimeRange(params: GetConversationsParams): {
    start: string;
    end: string;
  } {
    const now = new Date().toISOString();
    const oneHourAgo = new Date(Date.now() - 3600 * 1000).toISOString();
    return {
      start: params.start || oneHourAgo,
      end: params.end || now,
    };
  }

  private buildTimeRange(
    startDate?: string,
    endDate?: string,
  ): TimeRangeDto | undefined {
    return startDate && endDate
      ? { start: startDate, end: endDate }
      : undefined;
  }

  private extractConversationsFromTraces(
    traces: any[],
    attributes: string[],
  ): Map<string, { traceIds: Set<string>; firstSpanName?: string }> {
    const conversationMap = new Map<
      string,
      { traceIds: Set<string>; firstSpanName?: string }
    >();

    for (const trace of traces) {
      this.processTraceSpansForConversations(
        trace,
        attributes,
        conversationMap,
      );
    }

    return conversationMap;
  }

  private processTraceSpansForConversations(
    trace: any,
    attributes: string[],
    conversationMap: Map<
      string,
      { traceIds: Set<string>; firstSpanName?: string }
    >,
  ): void {
    const spans = trace.spanSet?.spans;
    if (!spans) return;

    for (const span of spans) {
      this.processSpanAttributesForConversations(
        span,
        attributes,
        trace,
        conversationMap,
      );
    }
  }

  private processSpanAttributesForConversations(
    span: any,
    attributes: string[],
    trace: any,
    conversationMap: Map<
      string,
      { traceIds: Set<string>; firstSpanName?: string }
    >,
  ): void {
    if (!span.attributes) return;

    for (const attribute of span.attributes) {
      if (!attributes.includes(attribute.key)) continue;

      const value = this.extractAttributeValue(attribute);
      if (!value) continue;

      this.addToConversationMap(conversationMap, value, trace);
    }
  }

  private extractAttributeValue(attribute: any): string | null {
    if (attribute.value?.stringValue) {
      return attribute.value.stringValue;
    }
    if (attribute.value?.intValue !== undefined) {
      return String(attribute.value.intValue);
    }
    if (attribute.value?.doubleValue !== undefined) {
      return String(attribute.value.doubleValue);
    }
    return null;
  }

  private addToConversationMap(
    map: Map<string, { traceIds: Set<string>; firstSpanName?: string }>,
    value: string,
    trace: any,
  ): void {
    if (!map.has(value)) {
      map.set(value, {
        traceIds: new Set(),
        firstSpanName: trace.rootTraceName,
      });
    }

    const conversation = map.get(value);
    if (conversation) {
      conversation.traceIds.add(trace.traceID);
      if (!conversation.firstSpanName && trace.rootTraceName) {
        conversation.firstSpanName = trace.rootTraceName;
      }
    }
  }

  private mapToConversationListItems(
    conversationMap: Map<
      string,
      { traceIds: Set<string>; firstSpanName?: string }
    >,
  ): ConversationListItemResponseDto[] {
    return Array.from(conversationMap.entries()).map(
      ([conversationId, data]) => ({
        conversationId,
        name: data.firstSpanName || "",
        traceIds: Array.from(data.traceIds),
        traceCount: data.traceIds.size,
      }),
    );
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
    projectTraceFilter?: { attributeName: string; attributeValue: string },
  ): Promise<any[]> {
    const timeRange = this.buildTimeRange(start, end);
    return this.fetchTracesByIds(
      datasource,
      traceIds,
      timeRange,
      projectTraceFilter,
    );
  }

  private async fetchTracesByIds(
    datasource: Datasource,
    traceIds: string[],
    timeRange?: TimeRangeDto,
    projectTraceFilter?: { attributeName: string; attributeValue: string },
  ): Promise<any[]> {
    const traces = await Promise.all(
      traceIds.map(async (traceId) => {
        try {
          return await this.tempoTraceRepository.searchByTraceId(
            datasource,
            traceId,
            timeRange,
            projectTraceFilter,
          );
        } catch (error) {
          this.logger.warn(`Failed to fetch trace ${traceId}:`, error.message);
          return null;
        }
      }),
    );

    return traces.filter((trace) => trace !== null);
  }
}
