import { AnnotationMapper } from "../../../src/annotation-queue/mappers/annotation.mapper";
import { AnnotationAnswer } from "../../../src/annotation-queue/entities/annotation-answer.entity";
import { Annotation } from "../../../src/annotation-queue/entities/annotation.entity";
import { QueuedTrace } from "../../../src/annotation-queue/entities/queued-trace.entity";
import { QueuedConversation } from "../../../src/annotation-queue/entities/queued-conversation.entity";

describe("AnnotationMapper", () => {
  describe("toDto", () => {
    it("should map trace annotations with answers", () => {
      const answer = new AnnotationAnswer();
      answer.id = "answer-1";
      answer.questionId = "question-1";
      answer.value = "yes";

      const trace = new QueuedTrace();
      trace.otelTraceId = "otel-1";
      trace.datasourceId = "datasource-1";

      const annotation = new Annotation();
      annotation.id = "annotation-1";
      annotation.answers = [answer];
      annotation.startDate = new Date("2024-01-01T00:00:00Z");
      annotation.endDate = new Date("2024-01-02T00:00:00Z");
      annotation.trace = trace;
      annotation.traceId = "trace-1";

      const result = AnnotationMapper.toDto(annotation);

      expect(result).toEqual({
        id: "annotation-1",
        answers: [
          {
            id: "answer-1",
            questionId: "question-1",
            value: "yes",
            numberValue: undefined,
            booleanValue: undefined,
            stringArrayValue: undefined,
          },
        ],
        startDate: new Date("2024-01-01T00:00:00Z"),
        endDate: new Date("2024-01-02T00:00:00Z"),
        otelTraceId: "otel-1",
        datasourceId: "datasource-1",
        traceId: "trace-1",
      });
    });

    it("should map conversation annotations with answers", () => {
      const answer = new AnnotationAnswer();
      answer.id = "answer-1";
      answer.questionId = "question-1";
      answer.value = "ok";

      const conversation = new QueuedConversation();
      conversation.otelConversationId = "conv-1";
      conversation.conversationConfigId = "config-1";
      conversation.datasourceId = "datasource-1";

      const annotation = new Annotation();
      annotation.id = "annotation-2";
      annotation.answers = [answer];
      annotation.conversation = conversation;
      annotation.conversationId = "conversation-1";

      const result = AnnotationMapper.toDto(annotation);

      expect(result).toEqual({
        id: "annotation-2",
        answers: [
          {
            id: "answer-1",
            questionId: "question-1",
            value: "ok",
            numberValue: undefined,
            booleanValue: undefined,
            stringArrayValue: undefined,
          },
        ],
        startDate: undefined,
        endDate: undefined,
        conversationId: "conversation-1",
        otelConversationId: "conv-1",
        conversationConfigId: "config-1",
        conversationDatasourceId: "datasource-1",
      });
    });
  });

  describe("toEntityFromQueueTrace", () => {
    it("should map queue trace and create dto to entity payload", () => {
      const trace = new QueuedTrace();
      trace.id = "trace-1";
      trace.startDate = new Date("2024-01-01T00:00:00Z");
      trace.endDate = new Date("2024-01-02T00:00:00Z");

      const dto = {
        answers: [{ questionId: "q1", value: "a" }],
      };

      const result = AnnotationMapper.toEntityFromQueueTrace(
        trace,
        dto as any,
        "user-1",
      );

      expect(result).toEqual({
        startDate: trace.startDate,
        endDate: trace.endDate,
        createdById: "user-1",
        answers: [
          expect.objectContaining({
            questionId: "q1",
            value: "a",
          }),
        ],
        traceId: "trace-1",
      });
    });
  });

  describe("toEntityFromConversation", () => {
    it("should map conversation and create dto to entity payload", () => {
      const conversation = new QueuedConversation();
      conversation.id = "conversation-1";
      conversation.startDate = new Date("2024-02-01T00:00:00Z");
      conversation.endDate = new Date("2024-02-02T00:00:00Z");

      const dto = {
        answers: [{ questionId: "q1", value: "a" }],
      };

      const result = AnnotationMapper.toEntityFromConversation(
        conversation,
        dto as any,
        "user-1",
      );

      expect(result).toEqual({
        startDate: conversation.startDate,
        endDate: conversation.endDate,
        createdById: "user-1",
        answers: [
          expect.objectContaining({
            questionId: "q1",
            value: "a",
          }),
        ],
        conversationId: "conversation-1",
      });
    });
  });

  describe("toMessageResponse", () => {
    it("should map message to response dto", () => {
      expect(AnnotationMapper.toMessageResponse("ok")).toEqual({
        message: "ok",
      });
    });
  });
});
