import { ConversationMapper } from "../../../src/annotation-queue/mappers/conversation.mapper";
import { QueuedConversation } from "../../../src/annotation-queue/entities/queued-conversation.entity";

describe("ConversationMapper", () => {
  describe("toDto", () => {
    it("should map queued conversation to response dto", () => {
      const conversation = new QueuedConversation();
      conversation.id = "conversation-1";
      conversation.otelConversationId = "otel-1";
      conversation.conversationConfigId = "config-1";
      conversation.datasourceId = "datasource-1";
      conversation.otelTraceIds = ["trace-1", "trace-2"];
      conversation.startDate = new Date("2024-01-01T00:00:00Z");
      conversation.endDate = new Date("2024-01-02T00:00:00Z");

      const result = ConversationMapper.toDto(conversation);

      expect(result).toEqual({
        id: "conversation-1",
        otelConversationId: "otel-1",
        conversationConfigId: "config-1",
        datasourceId: "datasource-1",
        traceIds: ["trace-1", "trace-2"],
        startDate: new Date("2024-01-01T00:00:00Z"),
        endDate: new Date("2024-01-02T00:00:00Z"),
      });
    });
  });

  describe("toEntity", () => {
    it("should map dto to queued conversation entity payload", () => {
      const dto = {
        conversationConfigId: "config-1",
        datasourceId: "datasource-1",
        otelConversationId: "otel-1",
        otelTraceIds: ["trace-1"],
        startDate: "2024-01-01T00:00:00Z",
        endDate: "2024-01-02T00:00:00Z",
      };

      const result = ConversationMapper.toEntity(dto, "queue-1");

      expect(result).toEqual({
        conversationConfigId: "config-1",
        datasourceId: "datasource-1",
        otelConversationId: "otel-1",
        otelTraceIds: ["trace-1"],
        queueId: "queue-1",
        startDate: new Date("2024-01-01T00:00:00Z"),
        endDate: new Date("2024-01-02T00:00:00Z"),
      });
    });

    it("should omit dates when not provided", () => {
      const dto = {
        conversationConfigId: "config-1",
        datasourceId: "datasource-1",
        otelConversationId: "otel-1",
        otelTraceIds: [],
      };

      const result = ConversationMapper.toEntity(dto, "queue-1");

      expect(result.startDate).toBeUndefined();
      expect(result.endDate).toBeUndefined();
    });
  });

  describe("toMessageResponse", () => {
    it("should map message to response dto", () => {
      expect(ConversationMapper.toMessageResponse("done")).toEqual({
        message: "done",
      });
    });
  });
});
