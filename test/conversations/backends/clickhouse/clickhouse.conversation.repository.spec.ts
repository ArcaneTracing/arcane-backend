import { ClickHouseConversationRepository } from "../../../../src/conversations/backends/clickhouse/clickhouse.conversation.repository";
import { ClickHouseTraceRepository } from "../../../../src/traces/backends/clickhouse/clickhouse.trace.repository";
import { Datasource } from "../../../../src/datasources/entities/datasource.entity";

const tempoConvTraceJson = require("../../resources/tempo/conv-trace-response.json");

describe("ClickHouseConversationRepository", () => {
  const mockClickHouseTraceRepository = {
    getClientForConversations: jest.fn(),
    getTableNameForConversations: jest.fn(),
    search: jest.fn(),
    searchByTraceId: jest.fn(),
  };

  const mockClickHouseClient = {
    query: jest.fn(),
  };

  const mockDatasource: Datasource = {
    id: "datasource-1",
    name: "Test ClickHouse Datasource",
    description: "Test Description",
    url: "http://localhost:8123",
    type: "traces" as any,
    source: "clickhouse" as any,
    organisationId: "org-1",
    createdAt: new Date(),
    updatedAt: new Date(),
    createdById: "user-1",
    config: {
      clickhouse: {
        host: "localhost",
        port: 8123,
        database: "default",
        tableName: "traces",
      },
    },
  } as unknown as Datasource;

  beforeEach(() => {
    jest.clearAllMocks();
    mockClickHouseTraceRepository.getClientForConversations.mockReturnValue(
      mockClickHouseClient,
    );
    mockClickHouseTraceRepository.getTableNameForConversations.mockReturnValue(
      "traces",
    );
  });

  it("should return empty array when no attributes are provided", async () => {
    const repo = new ClickHouseConversationRepository(
      mockClickHouseTraceRepository as unknown as ClickHouseTraceRepository,
    );

    const result = await repo.getConversations(mockDatasource, [], {
      start: "2024-01-01T00:00:00.000Z",
      end: "2024-01-02T00:00:00.000Z",
    });

    expect(result).toEqual([]);
    expect(mockClickHouseClient.query).not.toHaveBeenCalled();
  });

  it("should build conversations from ClickHouse query results", async () => {
    const repo = new ClickHouseConversationRepository(
      mockClickHouseTraceRepository as unknown as ClickHouseTraceRepository,
    );

    const mockQueryResult = {
      json: jest.fn().mockResolvedValue([
        {
          conversationId: "session-123",
          firstSpanName: "LangGraph",
          traceIds: ["trace-1", "trace-2", "trace-3"],
          traceCount: 3,
        },
        {
          conversationId: "session-456",
          firstSpanName: "OpenAI",
          traceIds: ["trace-4", "trace-5"],
          traceCount: 2,
        },
      ]),
    };

    mockClickHouseClient.query.mockResolvedValue(mockQueryResult);

    const result = await repo.getConversations(mockDatasource, ["session.id"], {
      start: "2024-01-01T00:00:00.000Z",
      end: "2024-01-02T00:00:00.000Z",
    });

    expect(result.length).toBe(2);
    expect(result[0].conversationId).toBe("session-123");
    expect(result[0].name).toBe("LangGraph");
    expect(result[0].traceIds).toEqual(["trace-1", "trace-2", "trace-3"]);
    expect(result[0].traceCount).toBe(3);
    expect(result[1].conversationId).toBe("session-456");
    expect(result[1].name).toBe("OpenAI");
    expect(result[1].traceIds).toEqual(["trace-4", "trace-5"]);
    expect(result[1].traceCount).toBe(2);

    expect(mockClickHouseClient.query).toHaveBeenCalledWith(
      expect.objectContaining({
        format: "JSONEachRow",
      }),
    );

    const queryCall = mockClickHouseClient.query.mock.calls[0][0];
    expect(queryCall.query).toContain("key IN ('session.id')");
    expect(queryCall.query).toContain("ARRAY JOIN mapKeys(SpanAttributes)");
    expect(queryCall.query).toContain("ARRAY JOIN mapKeys(ResourceAttributes)");
    expect(queryCall.query).toContain("GROUP BY attribute_value");
    expect(queryCall.query).toContain("LIMIT 10000");
  });

  it("should handle multiple attributes with OR logic", async () => {
    const repo = new ClickHouseConversationRepository(
      mockClickHouseTraceRepository as unknown as ClickHouseTraceRepository,
    );

    const mockQueryResult = {
      json: jest.fn().mockResolvedValue([
        {
          conversationId: "user-789",
          firstSpanName: "Auth",
          traceIds: ["trace-6"],
          traceCount: 1,
        },
      ]),
    };

    mockClickHouseClient.query.mockResolvedValue(mockQueryResult);

    const result = await repo.getConversations(
      mockDatasource,
      ["session.id", "user.id"],
      {
        start: "2024-01-01T00:00:00.000Z",
        end: "2024-01-02T00:00:00.000Z",
      },
    );

    expect(result.length).toBe(1);
    expect(mockClickHouseClient.query).toHaveBeenCalled();

    const queryCall = mockClickHouseClient.query.mock.calls[0][0];
    expect(queryCall.query).toContain("key IN ('session.id', 'user.id')");
  });

  it("should default to 1 hour ago if no time range provided", async () => {
    const repo = new ClickHouseConversationRepository(
      mockClickHouseTraceRepository as unknown as ClickHouseTraceRepository,
    );

    const mockQueryResult = {
      json: jest.fn().mockResolvedValue([]),
    };

    mockClickHouseClient.query.mockResolvedValue(mockQueryResult);

    await repo.getConversations(mockDatasource, ["session.id"], {});

    expect(mockClickHouseClient.query).toHaveBeenCalled();
    const queryCall = mockClickHouseClient.query.mock.calls[0][0];
    const query = queryCall.query;

    expect(query).toMatch(/Timestamp >= \d+/);
    expect(query).toMatch(/Timestamp <= \d+/);
  });

  it("should use provided time range", async () => {
    const repo = new ClickHouseConversationRepository(
      mockClickHouseTraceRepository as unknown as ClickHouseTraceRepository,
    );

    const mockQueryResult = {
      json: jest.fn().mockResolvedValue([]),
    };

    mockClickHouseClient.query.mockResolvedValue(mockQueryResult);

    const start = "2024-01-01T00:00:00.000Z";
    const end = "2024-01-02T00:00:00.000Z";

    await repo.getConversations(mockDatasource, ["session.id"], { start, end });

    expect(mockClickHouseClient.query).toHaveBeenCalled();
    const queryCall = mockClickHouseClient.query.mock.calls[0][0];
    const query = queryCall.query;

    const startTimestamp = Math.floor(new Date(start).getTime() / 1000);
    const endTimestamp = Math.floor(new Date(end).getTime() / 1000);

    expect(query).toContain(`Timestamp >= ${startTimestamp}`);
    expect(query).toContain(`Timestamp <= ${endTimestamp}`);
  });

  it("should return empty array when no results found", async () => {
    const repo = new ClickHouseConversationRepository(
      mockClickHouseTraceRepository as unknown as ClickHouseTraceRepository,
    );

    const mockQueryResult = {
      json: jest.fn().mockResolvedValue([]),
    };

    mockClickHouseClient.query.mockResolvedValue(mockQueryResult);

    const result = await repo.getConversations(
      mockDatasource,
      ["session.id"],
      {},
    );

    expect(result).toEqual([]);
  });

  it("should handle empty span name gracefully", async () => {
    const repo = new ClickHouseConversationRepository(
      mockClickHouseTraceRepository as unknown as ClickHouseTraceRepository,
    );

    const mockQueryResult = {
      json: jest.fn().mockResolvedValue([
        {
          conversationId: "session-999",
          firstSpanName: null,
          traceIds: ["trace-7"],
          traceCount: 1,
        },
      ]),
    };

    mockClickHouseClient.query.mockResolvedValue(mockQueryResult);

    const result = await repo.getConversations(
      mockDatasource,
      ["session.id"],
      {},
    );

    expect(result.length).toBe(1);
    expect(result[0].conversationId).toBe("session-999");
    expect(result[0].name).toBe("");
    expect(result[0].traceIds).toEqual(["trace-7"]);
    expect(result[0].traceCount).toBe(1);
  });

  it("should handle empty traceIds array", async () => {
    const repo = new ClickHouseConversationRepository(
      mockClickHouseTraceRepository as unknown as ClickHouseTraceRepository,
    );

    const mockQueryResult = {
      json: jest.fn().mockResolvedValue([
        {
          conversationId: "session-888",
          firstSpanName: "Test",
          traceIds: null,
          traceCount: 0,
        },
      ]),
    };

    mockClickHouseClient.query.mockResolvedValue(mockQueryResult);

    const result = await repo.getConversations(
      mockDatasource,
      ["session.id"],
      {},
    );

    expect(result.length).toBe(1);
    expect(result[0].traceIds).toEqual([]);
    expect(result[0].traceCount).toBe(0);
  });

  it("should escape SQL injection attempts in attribute names", async () => {
    const repo = new ClickHouseConversationRepository(
      mockClickHouseTraceRepository as unknown as ClickHouseTraceRepository,
    );

    const mockQueryResult = {
      json: jest.fn().mockResolvedValue([]),
    };

    mockClickHouseClient.query.mockResolvedValue(mockQueryResult);

    await repo.getConversations(
      mockDatasource,
      ["session.id'; DROP TABLE traces; --"],
      {},
    );

    expect(mockClickHouseClient.query).toHaveBeenCalled();
    const queryCall = mockClickHouseClient.query.mock.calls[0][0];

    expect(queryCall.query).toContain("''");
  });

  it("should query both SpanAttributes and ResourceAttributes", async () => {
    const repo = new ClickHouseConversationRepository(
      mockClickHouseTraceRepository as unknown as ClickHouseTraceRepository,
    );

    const mockQueryResult = {
      json: jest.fn().mockResolvedValue([]),
    };

    mockClickHouseClient.query.mockResolvedValue(mockQueryResult);

    await repo.getConversations(mockDatasource, ["session.id"], {});

    expect(mockClickHouseClient.query).toHaveBeenCalled();
    const queryCall = mockClickHouseClient.query.mock.calls[0][0];
    const query = queryCall.query;

    expect(query).toContain("UNION ALL");
    expect(query).toContain("mapKeys(SpanAttributes)");
    expect(query).toContain("mapKeys(ResourceAttributes)");
  });

  it("should include project filter in query when projectTraceFilter is provided", async () => {
    const repo = new ClickHouseConversationRepository(
      mockClickHouseTraceRepository as unknown as ClickHouseTraceRepository,
    );

    const mockQueryResult = {
      json: jest.fn().mockResolvedValue([]),
    };

    mockClickHouseClient.query.mockResolvedValue(mockQueryResult);

    await repo.getConversations(mockDatasource, ["session.id"], {
      start: "2024-01-01T00:00:00.000Z",
      end: "2024-01-02T00:00:00.000Z",
      projectTraceFilter: {
        attributeName: "project.id",
        attributeValue: "123",
      },
    });

    expect(mockClickHouseClient.query).toHaveBeenCalled();
    const queryCall = mockClickHouseClient.query.mock.calls[0][0];
    const query = queryCall.query;

    expect(query).toContain("mapContains(SpanAttributes, 'project.id')");
    expect(query).toContain("mapContains(ResourceAttributes, 'project.id')");
    expect(query).toContain("= '123'");

    const openCount = (query.match(/\(/g) || []).length;
    const closeCount = (query.match(/\)/g) || []).length;
    expect(openCount).toBe(closeCount);
  });

  it("should handle query errors", async () => {
    const repo = new ClickHouseConversationRepository(
      mockClickHouseTraceRepository as unknown as ClickHouseTraceRepository,
    );

    const error = new Error("ClickHouse connection error");
    mockClickHouseClient.query.mockRejectedValue(error);

    await expect(
      repo.getConversations(mockDatasource, ["session.id"], {}),
    ).rejects.toThrow("ClickHouse connection error");
  });

  describe("getFullConversation", () => {
    it("should return empty array when no attributes are provided", async () => {
      const repo = new ClickHouseConversationRepository(
        mockClickHouseTraceRepository as unknown as ClickHouseTraceRepository,
      );

      const result = await repo.getFullConversation(mockDatasource, [], {
        start: "2024-01-01T00:00:00.000Z",
        end: "2024-01-02T00:00:00.000Z",
        value: "459",
      });

      expect(result).toEqual({ traces: [] });
      expect(mockClickHouseTraceRepository.search).not.toHaveBeenCalled();
    });

    it("should search traces and fetch full traces by IDs", async () => {
      const repo = new ClickHouseConversationRepository(
        mockClickHouseTraceRepository as unknown as ClickHouseTraceRepository,
      );
      mockClickHouseTraceRepository.search.mockResolvedValue({
        traces: [{ traceID: "trace-1" }, { traceID: "trace-2" }],
      });
      mockClickHouseTraceRepository.searchByTraceId
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
      expect(mockClickHouseTraceRepository.search).toHaveBeenCalledWith(
        mockDatasource,
        {
          start: "2024-01-01T00:00:00.000Z",
          end: "2024-01-02T00:00:00.000Z",
          q: 'session.id = "459"',
        },
      );
      expect(
        mockClickHouseTraceRepository.searchByTraceId,
      ).toHaveBeenCalledTimes(2);
    });

    it("should handle multiple attributes with OR logic", async () => {
      const repo = new ClickHouseConversationRepository(
        mockClickHouseTraceRepository as unknown as ClickHouseTraceRepository,
      );
      mockClickHouseTraceRepository.search.mockResolvedValue({
        traces: [{ traceID: "trace-1" }],
      });
      mockClickHouseTraceRepository.searchByTraceId.mockResolvedValueOnce(
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

      expect(mockClickHouseTraceRepository.search).toHaveBeenCalledWith(
        mockDatasource,
        {
          start: "2024-01-01T00:00:00.000Z",
          end: "2024-01-02T00:00:00.000Z",
          q: 'session.id = "459" OR user.id = "459"',
        },
      );
    });

    it("should dedupe trace IDs", async () => {
      const repo = new ClickHouseConversationRepository(
        mockClickHouseTraceRepository as unknown as ClickHouseTraceRepository,
      );
      mockClickHouseTraceRepository.search.mockResolvedValue({
        traces: [
          { traceID: "trace-1" },
          { traceID: "trace-1" },
          { traceID: "trace-2" },
        ],
      });
      mockClickHouseTraceRepository.searchByTraceId
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
      expect(
        mockClickHouseTraceRepository.searchByTraceId,
      ).toHaveBeenCalledTimes(2);
    });

    it("should skip traces that fail to fetch", async () => {
      const repo = new ClickHouseConversationRepository(
        mockClickHouseTraceRepository as unknown as ClickHouseTraceRepository,
      );
      mockClickHouseTraceRepository.search.mockResolvedValue({
        traces: [{ traceID: "trace-1" }, { traceID: "trace-2" }],
      });
      mockClickHouseTraceRepository.searchByTraceId
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
      const repo = new ClickHouseConversationRepository(
        mockClickHouseTraceRepository as unknown as ClickHouseTraceRepository,
      );
      mockClickHouseTraceRepository.search.mockResolvedValue({
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
      expect(
        mockClickHouseTraceRepository.searchByTraceId,
      ).not.toHaveBeenCalled();
    });
  });

  describe("getConversationsByTraceIds", () => {
    it("should fetch traces by trace IDs", async () => {
      const repo = new ClickHouseConversationRepository(
        mockClickHouseTraceRepository as unknown as ClickHouseTraceRepository,
      );
      mockClickHouseTraceRepository.searchByTraceId
        .mockResolvedValueOnce(tempoConvTraceJson)
        .mockResolvedValueOnce(tempoConvTraceJson);

      const result = await repo.getConversationsByTraceIds(mockDatasource, {
        traceIds: ["trace-1", "trace-2"],
        startDate: "2024-01-01T00:00:00.000Z",
        endDate: "2024-01-02T00:00:00.000Z",
      });

      expect(result.traces.length).toBe(2);
      expect(
        mockClickHouseTraceRepository.searchByTraceId,
      ).toHaveBeenCalledTimes(2);
      expect(
        mockClickHouseTraceRepository.searchByTraceId,
      ).toHaveBeenCalledWith(mockDatasource, "trace-1", {
        start: "2024-01-01T00:00:00.000Z",
        end: "2024-01-02T00:00:00.000Z",
      });
    });

    it("should skip traces that fail to fetch", async () => {
      const repo = new ClickHouseConversationRepository(
        mockClickHouseTraceRepository as unknown as ClickHouseTraceRepository,
      );
      mockClickHouseTraceRepository.searchByTraceId
        .mockResolvedValueOnce(tempoConvTraceJson)
        .mockRejectedValueOnce(new Error("Fetch failed"));

      const result = await repo.getConversationsByTraceIds(mockDatasource, {
        traceIds: ["trace-1", "trace-2"],
      });

      expect(result.traces.length).toBe(1);
    });

    it("should work without time range", async () => {
      const repo = new ClickHouseConversationRepository(
        mockClickHouseTraceRepository as unknown as ClickHouseTraceRepository,
      );
      mockClickHouseTraceRepository.searchByTraceId.mockResolvedValueOnce(
        tempoConvTraceJson,
      );

      await repo.getConversationsByTraceIds(mockDatasource, {
        traceIds: ["trace-1"],
      });

      expect(
        mockClickHouseTraceRepository.searchByTraceId,
      ).toHaveBeenCalledWith(mockDatasource, "trace-1", undefined);
    });
  });
});
