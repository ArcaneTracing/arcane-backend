import { TempoConversationRepository } from "../../../../src/conversations/backends/tempo/tempo.conversation.repository";
import { Datasource } from "../../../../src/datasources/entities/datasource.entity";

const tempoConvListJson = require("../../resources/tempo/conv-list.json");
const tempoConvTraceJson = require("../../resources/tempo/conv-trace-response.json");

describe("TempoConversationRepository", () => {
  const mockTempoTraceRepository = {
    search: jest.fn(),
    searchByTraceId: jest.fn(),
  };

  const mockDatasource: Datasource = {
    id: "datasource-1",
    name: "Test Datasource",
    description: "Test Description",
    url: "https://example.com",
    type: "traces" as any,
    source: "tempo" as any,
    organisationId: "org-1",
    createdAt: new Date(),
    updatedAt: new Date(),
    createdById: "user-1",
    projectId: "project-1",
  } as unknown as Datasource;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should return empty array when no attributes are provided", async () => {
    const repo = new TempoConversationRepository(
      mockTempoTraceRepository as any,
    );

    const result = await repo.getConversations(mockDatasource, [], {
      start: "2024-01-01T00:00:00.000Z",
      end: "2024-01-02T00:00:00.000Z",
    });

    expect(result).toEqual([]);
    expect(mockTempoTraceRepository.search).not.toHaveBeenCalled();
  });

  it("should build conversations from Tempo traces and dedupe trace IDs", async () => {
    const repo = new TempoConversationRepository(
      mockTempoTraceRepository as any,
    );
    mockTempoTraceRepository.search.mockResolvedValue(tempoConvListJson);

    const result = await repo.getConversations(mockDatasource, ["session.id"], {
      start: "2024-01-01T00:00:00.000Z",
      end: "2024-01-02T00:00:00.000Z",
    });

    expect(result.length).toBe(1);
    expect(result[0].conversationId).toBe("459");
    expect(result[0].name).toBe("LangGraph");
    expect(result[0].traceCount).toBe(4);
    expect(result[0].traceIds).toEqual(
      expect.arrayContaining([
        "82760187488b369976271126ff15da86",
        "51c51be310e84d6986e26024faadc550",
        "df35e34a81d83101d36e847074c28bb8",
        "fa6471d32539061bd70f55719bf53bc",
      ]),
    );
    expect(result[0].traceCount).toBe(result[0].traceIds.length);
    expect(mockTempoTraceRepository.search).toHaveBeenCalledWith(
      mockDatasource,
      expect.objectContaining({
        limit: 10000,
        q: '{ span."session.id" != nil && span."session.id" != "" }',
      }),
      undefined,
    );
  });

  it("should return empty array when no traces are found", async () => {
    const repo = new TempoConversationRepository(
      mockTempoTraceRepository as any,
    );
    mockTempoTraceRepository.search.mockResolvedValue({ traces: [] });

    const result = await repo.getConversations(
      mockDatasource,
      ["session.id"],
      {},
    );

    expect(result).toEqual([]);
  });

  it("should default to 1 hour ago when time range not provided", async () => {
    const repo = new TempoConversationRepository(
      mockTempoTraceRepository as any,
    );
    mockTempoTraceRepository.search.mockResolvedValue({ traces: [] });

    await repo.getConversations(mockDatasource, ["session.id"], {});

    expect(mockTempoTraceRepository.search).toHaveBeenCalledWith(
      mockDatasource,
      expect.objectContaining({
        start: expect.any(String),
        end: expect.any(String),
      }),
      undefined,
    );

    const call = mockTempoTraceRepository.search.mock.calls[0][1];
    const startTime = new Date(call.start).getTime();
    const endTime = new Date(call.end).getTime();
    const oneHourInMs = 3600 * 1000;

    expect(endTime - startTime).toBeCloseTo(oneHourInMs, -3);
  });

  describe("getFullConversation", () => {
    it("should return empty array when no attributes are provided", async () => {
      const repo = new TempoConversationRepository(
        mockTempoTraceRepository as any,
      );

      const result = await repo.getFullConversation(mockDatasource, [], {
        start: "2024-01-01T00:00:00.000Z",
        end: "2024-01-02T00:00:00.000Z",
        value: "459",
      });

      expect(result).toEqual({ traces: [] });
      expect(mockTempoTraceRepository.search).not.toHaveBeenCalled();
    });

    it("should search traces and fetch full traces by IDs", async () => {
      const repo = new TempoConversationRepository(
        mockTempoTraceRepository as any,
      );
      mockTempoTraceRepository.search.mockResolvedValue({
        traces: [{ traceID: "trace-1" }, { traceID: "trace-2" }],
      });
      mockTempoTraceRepository.searchByTraceId
        .mockResolvedValueOnce(tempoConvTraceJson)
        .mockResolvedValueOnce(tempoConvTraceJson);

      const result = await repo.getFullConversation(
        mockDatasource,
        ["session.id"],
        {
          start: "2024-01-01T00:00:00.000Z",
          end: "2024-01-02T00:00:00.000Z",
          value: "459",
        },
      );

      expect(result.traces.length).toBe(2);
      expect(mockTempoTraceRepository.search).toHaveBeenCalledWith(
        mockDatasource,
        {
          start: "2024-01-01T00:00:00.000Z",
          end: "2024-01-02T00:00:00.000Z",
          q: '{ span."session.id" = "459" }',
        },
        undefined,
      );
      expect(mockTempoTraceRepository.searchByTraceId).toHaveBeenCalledTimes(2);
      expect(mockTempoTraceRepository.searchByTraceId).toHaveBeenCalledWith(
        mockDatasource,
        "trace-1",
        { start: "2024-01-01T00:00:00.000Z", end: "2024-01-02T00:00:00.000Z" },
        undefined,
      );
    });

    it("should handle multiple attributes with OR logic", async () => {
      const repo = new TempoConversationRepository(
        mockTempoTraceRepository as any,
      );
      mockTempoTraceRepository.search.mockResolvedValue({
        traces: [{ traceID: "trace-1" }],
      });
      mockTempoTraceRepository.searchByTraceId.mockResolvedValueOnce(
        tempoConvTraceJson,
      );

      await repo.getFullConversation(
        mockDatasource,
        ["session.id", "user.id"],
        {
          start: "2024-01-01T00:00:00.000Z",
          end: "2024-01-02T00:00:00.000Z",
          value: "459",
        },
      );

      expect(mockTempoTraceRepository.search).toHaveBeenCalledWith(
        mockDatasource,
        {
          start: "2024-01-01T00:00:00.000Z",
          end: "2024-01-02T00:00:00.000Z",
          q: '{ span."session.id" = "459" || span."user.id" = "459" }',
        },
        undefined,
      );
    });

    it("should dedupe trace IDs", async () => {
      const repo = new TempoConversationRepository(
        mockTempoTraceRepository as any,
      );
      mockTempoTraceRepository.search.mockResolvedValue({
        traces: [
          { traceID: "trace-1" },
          { traceID: "trace-1" },
          { traceID: "trace-2" },
        ],
      });
      mockTempoTraceRepository.searchByTraceId
        .mockResolvedValueOnce(tempoConvTraceJson)
        .mockResolvedValueOnce(tempoConvTraceJson);

      const result = await repo.getFullConversation(
        mockDatasource,
        ["session.id"],
        {
          start: "2024-01-01T00:00:00.000Z",
          end: "2024-01-02T00:00:00.000Z",
          value: "459",
        },
      );

      expect(result.traces.length).toBe(2);
      expect(mockTempoTraceRepository.searchByTraceId).toHaveBeenCalledTimes(2);
    });

    it("should skip traces that fail to fetch", async () => {
      const repo = new TempoConversationRepository(
        mockTempoTraceRepository as any,
      );
      mockTempoTraceRepository.search.mockResolvedValue({
        traces: [{ traceID: "trace-1" }, { traceID: "trace-2" }],
      });
      mockTempoTraceRepository.searchByTraceId
        .mockResolvedValueOnce(tempoConvTraceJson)
        .mockRejectedValueOnce(new Error("Fetch failed"));

      const result = await repo.getFullConversation(
        mockDatasource,
        ["session.id"],
        {
          start: "2024-01-01T00:00:00.000Z",
          end: "2024-01-02T00:00:00.000Z",
          value: "459",
        },
      );

      expect(result.traces.length).toBe(1);
    });

    it("should return empty traces when no matches found", async () => {
      const repo = new TempoConversationRepository(
        mockTempoTraceRepository as any,
      );
      mockTempoTraceRepository.search.mockResolvedValue({
        traces: [],
      });

      const result = await repo.getFullConversation(
        mockDatasource,
        ["session.id"],
        {
          start: "2024-01-01T00:00:00.000Z",
          end: "2024-01-02T00:00:00.000Z",
          value: "459",
        },
      );

      expect(result.traces).toEqual([]);
      expect(mockTempoTraceRepository.searchByTraceId).not.toHaveBeenCalled();
    });

    it("should handle traces with invalid trace IDs", async () => {
      const repo = new TempoConversationRepository(
        mockTempoTraceRepository as any,
      );
      mockTempoTraceRepository.search.mockResolvedValue({
        traces: [
          { traceID: "" },
          { traceID: null },
          { traceID: "valid-trace-id" },
        ],
      });
      mockTempoTraceRepository.searchByTraceId.mockResolvedValueOnce(
        tempoConvTraceJson,
      );

      const result = await repo.getFullConversation(
        mockDatasource,
        ["session.id"],
        {
          start: "2024-01-01T00:00:00.000Z",
          end: "2024-01-02T00:00:00.000Z",
          value: "459",
        },
      );

      expect(result.traces.length).toBe(1);
      expect(mockTempoTraceRepository.searchByTraceId).toHaveBeenCalledTimes(1);
      expect(mockTempoTraceRepository.searchByTraceId).toHaveBeenCalledWith(
        mockDatasource,
        "valid-trace-id",
        expect.any(Object),
        undefined,
      );
    });
  });

  describe("getConversationsByTraceIds", () => {
    it("should fetch traces by trace IDs", async () => {
      const repo = new TempoConversationRepository(
        mockTempoTraceRepository as any,
      );
      mockTempoTraceRepository.searchByTraceId
        .mockResolvedValueOnce(tempoConvTraceJson)
        .mockResolvedValueOnce(tempoConvTraceJson);

      const result = await repo.getConversationsByTraceIds(mockDatasource, {
        traceIds: ["trace-1", "trace-2"],
        startDate: "2024-01-01T00:00:00.000Z",
        endDate: "2024-01-02T00:00:00.000Z",
      });

      expect(result.traces.length).toBe(2);
      expect(mockTempoTraceRepository.searchByTraceId).toHaveBeenCalledTimes(2);
      expect(mockTempoTraceRepository.searchByTraceId).toHaveBeenCalledWith(
        mockDatasource,
        "trace-1",
        { start: "2024-01-01T00:00:00.000Z", end: "2024-01-02T00:00:00.000Z" },
        undefined,
      );
    });

    it("should skip traces that fail to fetch", async () => {
      const repo = new TempoConversationRepository(
        mockTempoTraceRepository as any,
      );
      mockTempoTraceRepository.searchByTraceId
        .mockResolvedValueOnce(tempoConvTraceJson)
        .mockRejectedValueOnce(new Error("Fetch failed"));

      const result = await repo.getConversationsByTraceIds(mockDatasource, {
        traceIds: ["trace-1", "trace-2"],
      });

      expect(result.traces.length).toBe(1);
    });

    it("should work without time range", async () => {
      const repo = new TempoConversationRepository(
        mockTempoTraceRepository as any,
      );
      mockTempoTraceRepository.searchByTraceId.mockResolvedValueOnce(
        tempoConvTraceJson,
      );

      await repo.getConversationsByTraceIds(mockDatasource, {
        traceIds: ["trace-1"],
      });

      expect(mockTempoTraceRepository.searchByTraceId).toHaveBeenCalledWith(
        mockDatasource,
        "trace-1",
        undefined,
        undefined,
      );
    });

    it("should pass project filter to search when provided", async () => {
      const repo = new TempoConversationRepository(
        mockTempoTraceRepository as any,
      );
      const projectTraceFilter = {
        attributeName: "project.id",
        attributeValue: "project-123",
      };
      mockTempoTraceRepository.search.mockResolvedValue(tempoConvListJson);

      await repo.getConversations(mockDatasource, ["session.id"], {
        start: "2024-01-01T00:00:00.000Z",
        end: "2024-01-02T00:00:00.000Z",
        projectTraceFilter,
      });

      expect(mockTempoTraceRepository.search).toHaveBeenCalledWith(
        mockDatasource,
        expect.objectContaining({
          limit: 10000,
          q: '{ span."session.id" != nil && span."session.id" != "" }',
        }),
        projectTraceFilter,
      );
    });

    it("should pass project filter to searchByTraceId when fetching full traces", async () => {
      const repo = new TempoConversationRepository(
        mockTempoTraceRepository as any,
      );
      const projectTraceFilter = {
        attributeName: "project.id",
        attributeValue: "project-123",
      };
      mockTempoTraceRepository.search.mockResolvedValue({
        traces: [{ traceID: "trace-1" }],
      });
      mockTempoTraceRepository.searchByTraceId.mockResolvedValueOnce(
        tempoConvTraceJson,
      );

      await repo.getFullConversation(mockDatasource, ["session.id"], {
        start: "2024-01-01T00:00:00.000Z",
        end: "2024-01-02T00:00:00.000Z",
        value: "459",
        projectTraceFilter,
      });

      expect(mockTempoTraceRepository.searchByTraceId).toHaveBeenCalledWith(
        mockDatasource,
        "trace-1",
        expect.any(Object),
        projectTraceFilter,
      );
    });

    it("should pass project filter to searchByTraceId in getConversationsByTraceIds", async () => {
      const repo = new TempoConversationRepository(
        mockTempoTraceRepository as any,
      );
      const projectTraceFilter = {
        attributeName: "project.id",
        attributeValue: "project-123",
      };
      mockTempoTraceRepository.searchByTraceId.mockResolvedValueOnce(
        tempoConvTraceJson,
      );

      await repo.getConversationsByTraceIds(mockDatasource, {
        traceIds: ["trace-1"],
        projectTraceFilter,
      });

      expect(mockTempoTraceRepository.searchByTraceId).toHaveBeenCalledWith(
        mockDatasource,
        "trace-1",
        undefined,
        projectTraceFilter,
      );
    });

    it("should skip traces that throw NotFoundException due to project filter", async () => {
      const repo = new TempoConversationRepository(
        mockTempoTraceRepository as any,
      );
      const { NotFoundException } = require("@nestjs/common");
      const projectTraceFilter = {
        attributeName: "project.id",
        attributeValue: "project-123",
      };
      mockTempoTraceRepository.searchByTraceId
        .mockResolvedValueOnce(tempoConvTraceJson)
        .mockRejectedValueOnce(new NotFoundException("Trace not found"))
        .mockResolvedValueOnce(tempoConvTraceJson);

      const result = await repo.getConversationsByTraceIds(mockDatasource, {
        traceIds: ["trace-1", "trace-2", "trace-3"],
        projectTraceFilter,
      });

      expect(result.traces.length).toBe(2);
    });
  });
});
