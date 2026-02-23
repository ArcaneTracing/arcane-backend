import { Injectable, Logger } from "@nestjs/common";
import {
  ConversationRepository,
  GetConversationsParams,
  GetFullConversationParams,
  GetConversationsByTraceIdsParams,
} from "../conversation-repository.interface";
import { Datasource } from "src/datasources/entities/datasource.entity";
import { SearchTracesRequestDto } from "../../../traces/dto/request/search-traces-request.dto";
import { JaegerTraceRepository } from "../../../traces/backends/jaeger/jaeger.trace.repository";
import { ConversationListItemResponseDto } from "src/conversations/dto/response/conversation-list-item-response.dto";
import { TimeRangeDto } from "../../../traces/dto/time-range.dto";
import { FullConversationResponseDto } from "src/conversations/dto/response/conversation-response.dto";

@Injectable()
export class JaegerConversationRepository implements ConversationRepository {
  private readonly logger = new Logger(JaegerConversationRepository.name);

  constructor(private readonly jaegerTraceRepository: JaegerTraceRepository) {}

  async getConversations(
    datasource: Datasource,
    attributes: string[],
    params: GetConversationsParams,
  ): Promise<ConversationListItemResponseDto[]> {
    this.logger.debug("Getting conversations from Jaeger", {
      attributes,
      params,
    });

    if (attributes.length === 0) {
      return [];
    }

    const searchParams = this.buildSearchParams(params);

    try {
      const searchResponse = await this.jaegerTraceRepository.search(
        datasource,
        searchParams,
        params.projectTraceFilter,
      );
      const traces = searchResponse.traces || [];

      if (traces.length === 0) {
        return [];
      }

      const conversationMap = this.extractConversationsFromTraces(
        traces,
        attributes,
      );
      const conversations = this.mapToConversationListItems(conversationMap);

      this.logger.log(
        `Generated ${conversations.length} unique conversation values from Jaeger`,
      );
      return conversations;
    } catch (error) {
      this.logger.error("Error getting conversations from Jaeger:", {
        attributes,
        errorMessage: error.message,
        errorStack: error.stack,
      });

      if (error.message?.includes("No traces found")) {
        this.logger.debug("No traces found, returning empty result");
        return [];
      }

      throw error;
    }
  }

  async getFullConversation(
    datasource: Datasource,
    attributes: string[],
    params: GetFullConversationParams,
  ): Promise<FullConversationResponseDto> {
    this.logger.debug("Getting full conversation from Jaeger", {
      attributes,
      params,
    });

    if (attributes.length === 0) {
      return { traces: [] };
    }

    const searchParams = this.buildSearchParams({
      start: params.start,
      end: params.end,
    });

    const searchResult = await this.jaegerTraceRepository.search(
      datasource,
      searchParams,
      params.projectTraceFilter,
    );
    const traceSummaries = searchResult.traces || [];

    const filteredTraces = this.filterTracesByAttributeValue(
      traceSummaries,
      attributes,
      params.value,
    );

    const traceIds = this.extractTraceIds(filteredTraces);
    this.logger.debug(
      `Found ${traceIds.length} unique trace IDs for conversation value: ${params.value}`,
    );

    const fullTraces = await this.fetchFullTraces(
      datasource,
      traceIds,
      params.start,
      params.end,
      params.projectTraceFilter,
    );

    this.logger.log(
      `Fetched ${fullTraces.length} full traces for conversation value: ${params.value}`,
    );
    return { traces: fullTraces };
  }

  async getConversationsByTraceIds(
    datasource: Datasource,
    params: GetConversationsByTraceIdsParams,
  ): Promise<FullConversationResponseDto> {
    this.logger.debug("Getting conversations by trace IDs from Jaeger", {
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

  private buildSearchParams(
    params: GetConversationsParams,
  ): SearchTracesRequestDto {
    const now = Math.floor(Date.now() / 1000);
    const oneHourAgo = now - 3600;

    return {
      start: params.start
        ? String(Math.floor(new Date(params.start).getTime() / 1000))
        : String(oneHourAgo),
      end: params.end
        ? String(Math.floor(new Date(params.end).getTime() / 1000))
        : String(now),
      limit: 10000,
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
      const tags = trace.tags || {};

      for (const attribute of attributes) {
        const value = tags[attribute];
        if (value === undefined || value === null || value === "") continue;

        const conversationId = String(value);
        this.addToConversationMap(conversationMap, conversationId, trace);
      }
    }

    return conversationMap;
  }

  private addToConversationMap(
    map: Map<string, { traceIds: Set<string>; firstSpanName?: string }>,
    conversationId: string,
    trace: any,
  ): void {
    if (!map.has(conversationId)) {
      map.set(conversationId, {
        traceIds: new Set(),
        firstSpanName: trace.rootTraceName,
      });
    }

    const conversation = map.get(conversationId);
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

  private filterTracesByAttributeValue(
    traces: any[],
    attributes: string[],
    value: string,
  ): any[] {
    return traces.filter((trace) => {
      const tags = trace.tags || {};
      return attributes.some((attribute) => {
        const tagValue = tags[attribute];
        return (
          tagValue !== undefined &&
          tagValue !== null &&
          String(tagValue) === value
        );
      });
    });
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
          return await this.jaegerTraceRepository.searchByTraceId(
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
