import { Injectable, Logger } from "@nestjs/common";
import {
  ConversationRepository,
  GetConversationsParams,
  GetFullConversationParams,
  GetConversationsByTraceIdsParams,
} from "../conversation-repository.interface";
import { Datasource } from "src/datasources/entities/datasource.entity";
import { CustomApiTraceRepository } from "../../../traces/backends/custom-api/custom-api.trace.repository";
import { CustomApiConfigMapper } from "../../../traces/backends/custom-api/custom-api.config.mapper";
import { ConversationListItemResponseDto } from "src/conversations/dto/response/conversation-list-item-response.dto";
import { TimeRangeDto } from "../../../traces/dto/time-range.dto";
import { FullConversationResponseDto } from "src/conversations/dto/response/conversation-response.dto";

@Injectable()
export class CustomApiConversationRepository implements ConversationRepository {
  private readonly logger = new Logger(CustomApiConversationRepository.name);

  constructor(
    private readonly customApiTraceRepository: CustomApiTraceRepository,
  ) {}

  async getConversations(
    datasource: Datasource,
    attributes: string[],
    params: GetConversationsParams,
  ): Promise<ConversationListItemResponseDto[]> {
    this.logger.debug("Getting conversations from Custom API", {
      attributes,
      params,
    });

    if (attributes.length === 0) {
      return [];
    }

    const config = CustomApiConfigMapper.map(datasource);

    if (config.capabilities?.filterByAttributeExists) {
      return this.getConversationsWithFilterByAttributeExists(
        datasource,
        attributes,
        params,
        config,
      );
    } else {
      return this.getConversationsClientSide(
        datasource,
        attributes,
        params,
        config,
      );
    }
  }

  async getFullConversation(
    datasource: Datasource,
    attributes: string[],
    params: GetFullConversationParams,
  ): Promise<FullConversationResponseDto> {
    this.logger.debug("Getting full conversation from Custom API", {
      attributes,
      params,
    });

    if (attributes.length === 0) {
      return { traces: [] };
    }

    const config = CustomApiConfigMapper.map(datasource);

    if (config.capabilities?.searchByAttributes) {
      const attributesParam = this.buildAttributesQuery(
        attributes,
        params.value,
      );

      const searchResult = await this.customApiTraceRepository.search(
        datasource,
        {
          start: params.start,
          end: params.end,
          attributes: attributesParam,
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
    } else {
      return this.getFullConversationFallback(datasource, attributes, params);
    }
  }

  async getConversationsByTraceIds(
    datasource: Datasource,
    params: GetConversationsByTraceIdsParams,
  ): Promise<FullConversationResponseDto> {
    this.logger.debug("Getting conversations by trace IDs from Custom API", {
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

  private async getConversationsWithFilterByAttributeExists(
    datasource: Datasource,
    attributes: string[],
    params: GetConversationsParams,
    config: ReturnType<typeof CustomApiConfigMapper.map>,
  ): Promise<ConversationListItemResponseDto[]> {
    const filterByAttributeExists = attributes.join(",");
    const { start, end } = this.getTimeRange(params);

    const searchResponse = await this.customApiTraceRepository.search(
      datasource,
      {
        start,
        end,
        limit: 10000,
        filterByAttributeExists: [filterByAttributeExists],
      },
      params.projectTraceFilter,
    );

    const traces = searchResponse.traces || [];

    if (!traces.length) {
      return [];
    }

    const conversationMap = this.extractConversationsFromTraces(
      traces,
      attributes,
    );
    const conversations = this.mapToConversationListItems(conversationMap);

    this.logger.log(
      `Generated ${conversations.length} unique conversation values from Custom API`,
    );
    return conversations;
  }

  private async getConversationsClientSide(
    datasource: Datasource,
    attributes: string[],
    params: GetConversationsParams,
    config: ReturnType<typeof CustomApiConfigMapper.map>,
  ): Promise<ConversationListItemResponseDto[]> {
    const { start, end } = this.getTimeRange(params);

    const searchResponse = await this.customApiTraceRepository.search(
      datasource,
      {
        start,
        end,
        limit: 10000,
      },
      params.projectTraceFilter,
    );

    const traces = searchResponse.traces || [];

    if (!traces.length) {
      return [];
    }

    const conversationMap = this.extractConversationsFromTraces(
      traces,
      attributes,
    );
    const conversations = this.mapToConversationListItems(conversationMap);

    this.logger.log(
      `Generated ${conversations.length} unique conversation values from Custom API`,
    );
    return conversations;
  }

  private async getFullConversationFallback(
    datasource: Datasource,
    attributes: string[],
    params: GetFullConversationParams,
  ): Promise<FullConversationResponseDto> {
    const conversations = await this.getConversations(datasource, attributes, {
      start: params.start,
      end: params.end,
      projectTraceFilter: params.projectTraceFilter,
    });

    const matchingConversation = conversations.find(
      (conv) => conv.conversationId === params.value,
    );

    if (!matchingConversation?.traceIds.length) {
      return { traces: [] };
    }

    return this.getConversationsByTraceIds(datasource, {
      traceIds: matchingConversation.traceIds,
      startDate: params.start,
      endDate: params.end,
      projectTraceFilter: params.projectTraceFilter,
    });
  }

  private buildAttributesQuery(attributes: string[], value: string): string {
    return attributes.map((attr) => `${attr}="${value}"`).join(" ");
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
    const uniqueTraceIds = [...new Set(traceIds)];
    const traces = await Promise.all(
      uniqueTraceIds.map(async (traceId) => {
        try {
          return await this.customApiTraceRepository.searchByTraceId(
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
