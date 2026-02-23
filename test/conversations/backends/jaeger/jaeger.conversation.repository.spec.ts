import { JaegerConversationRepository } from "../../../../src/conversations/backends/jaeger/jaeger.conversation.repository";
import { Datasource } from "../../../../src/datasources/entities/datasource.entity";
import { NotFoundException } from "@nestjs/common";
import {
  ERROR_MESSAGES,
  formatError,
} from "../../../../src/common/constants/error-messages.constants";

const jaegerConvTraceJson = require("../../resources/jaeger/conv-trace-response.json");

describe("JaegerConversationRepository", () => {
  const mockJaegerTraceRepository = {
    search: jest.fn(),
    searchByTraceId: jest.fn(),
  };

  const mockDatasource: Datasource = {
    id: "datasource-1",
    name: "Test Datasource",
    description: "Test Description",
    url: "https://example.com",
    type: "traces" as any,
    source: "jaeger" as any,
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
    const repo = new JaegerConversationRepository(
      mockJaegerTraceRepository as any,
    );

    const result = await repo.getConversations(mockDatasource, [], {
      start: "2024-01-01T00:00:00.000Z",
      end: "2024-01-02T00:00:00.000Z",
    });

    expect(result).toEqual([]);
    expect(mockJaegerTraceRepository.search).not.toHaveBeenCalled();
  });

  it("should filter traces by project filter client-side (post-fetch filtering)", async () => {
    const repo = new JaegerConversationRepository(
      mockJaegerTraceRepository as any,
    );

    mockJaegerTraceRepository.search.mockResolvedValue({
      traces: [
        {
          traceID: "trace-1",
          rootTraceName: "Root",
          tags: { "session.id": "459", "project.id": "project-123" },
        },
        {
          traceID: "trace-2",
          rootTraceName: "Other",
          tags: { "session.id": "123", "project.id": "project-123" },
        },
      ],
    });

    const result = await repo.getConversations(mockDatasource, ["session.id"], {
      start: "2024-01-01T00:00:00.000Z",
      end: "2024-01-01T01:00:00.000Z",
      projectTraceFilter: {
        attributeName: "project.id",
        attributeValue: "project-123",
      },
    });

    expect(result).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          conversationId: "459",
          name: "Root",
          traceCount: 1,
          traceIds: ["trace-1"],
        }),
        expect.objectContaining({
          conversationId: "123",
          name: "Other",
          traceCount: 1,
          traceIds: ["trace-2"],
        }),
      ]),
    );

    expect(result.find((c) => c.traceIds.includes("trace-3"))).toBeUndefined();

    expect(mockJaegerTraceRepository.search).toHaveBeenCalledWith(
      mockDatasource,
      expect.objectContaining({
        start: expect.any(String),
        end: expect.any(String),
        limit: 10000,
      }),
      { attributeName: "project.id", attributeValue: "project-123" },
    );
    expect(
      mockJaegerTraceRepository.search.mock.calls[0][1].attributes,
    ).toBeUndefined();
  });

  it("should not filter when project filter is not configured", async () => {
    const repo = new JaegerConversationRepository(
      mockJaegerTraceRepository as any,
    );
    mockJaegerTraceRepository.search.mockResolvedValue({
      traces: [
        {
          traceID: "trace-1",
          rootTraceName: "Root",
          tags: { "session.id": "459", "project.id": "project-123" },
        },
        {
          traceID: "trace-2",
          rootTraceName: "Other",
          tags: { "session.id": "123", "project.id": "project-456" },
        },
      ],
    });

    const result = await repo.getConversations(mockDatasource, ["session.id"], {
      start: "2024-01-01T00:00:00.000Z",
      end: "2024-01-01T01:00:00.000Z",
    });

    expect(result.length).toBe(2);
    expect(result.find((c) => c.conversationId === "459")).toBeDefined();
    expect(result.find((c) => c.conversationId === "123")).toBeDefined();
  });

  it("should build conversations from Jaeger traces and convert tag values", async () => {
    const repo = new JaegerConversationRepository(
      mockJaegerTraceRepository as any,
    );
    mockJaegerTraceRepository.search.mockResolvedValue({
      traces: [
        {
          traceID: "trace-1",
          rootTraceName: "Root",
          tags: { "session.id": "459" },
        },
        {
          traceID: "trace-2",
          rootTraceName: "Other",
          tags: { "session.id": 123 },
        },
      ],
    });

    const result = await repo.getConversations(mockDatasource, ["session.id"], {
      start: "2024-01-01T00:00:00.000Z",
      end: "2024-01-01T01:00:00.000Z",
    });

    expect(result).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          conversationId: "459",
          name: "Root",
          traceCount: 1,
        }),
        expect.objectContaining({
          conversationId: "123",
          name: "Other",
          traceCount: 1,
        }),
      ]),
    );
    expect(mockJaegerTraceRepository.search).toHaveBeenCalledWith(
      mockDatasource,
      expect.objectContaining({
        start: String(
          Math.round(new Date("2024-01-01T00:00:00.000Z").getTime() / 1000),
        ),
        end: String(
          Math.round(new Date("2024-01-01T01:00:00.000Z").getTime() / 1000),
        ),
        limit: 10000,
      }),
      undefined,
    );
  });

  it("should return empty array when Jaeger returns no traces found error", async () => {
    const repo = new JaegerConversationRepository(
      mockJaegerTraceRepository as any,
    );
    mockJaegerTraceRepository.search.mockRejectedValue(
      new Error("No traces found"),
    );

    const result = await repo.getConversations(
      mockDatasource,
      ["session.id"],
      {},
    );

    expect(result).toEqual([]);
  });

  it("should rethrow unexpected errors", async () => {
    const repo = new JaegerConversationRepository(
      mockJaegerTraceRepository as any,
    );
    mockJaegerTraceRepository.search.mockRejectedValue(new Error("Unexpected"));

    await expect(
      repo.getConversations(mockDatasource, ["session.id"], {}),
    ).rejects.toThrow("Unexpected");
  });

  it("should default to 1 hour ago when time range not provided", async () => {
    const repo = new JaegerConversationRepository(
      mockJaegerTraceRepository as any,
    );
    mockJaegerTraceRepository.search.mockResolvedValue({ traces: [] });

    await repo.getConversations(mockDatasource, ["session.id"], {});

    expect(mockJaegerTraceRepository.search).toHaveBeenCalledWith(
      mockDatasource,
      expect.objectContaining({
        start: expect.any(String),
        end: expect.any(String),
        limit: 10000,
      }),
      undefined,
    );

    const call = mockJaegerTraceRepository.search.mock.calls[0][1];
    const startTime = parseInt(call.start, 10);
    const endTime = parseInt(call.end, 10);
    const oneHourInSeconds = 3600;

    expect(endTime - startTime).toBeCloseTo(oneHourInSeconds, -1);
  });

  it("should handle traces with missing tags", async () => {
    const repo = new JaegerConversationRepository(
      mockJaegerTraceRepository as any,
    );
    mockJaegerTraceRepository.search.mockResolvedValue({
      traces: [
        { traceID: "trace-1", tags: {} },
        { traceID: "trace-2", tags: null },
        { traceID: "trace-3" },
      ],
    });

    const result = await repo.getConversations(
      mockDatasource,
      ["session.id"],
      {},
    );

    expect(result).toEqual([]);
  });

  describe("getFullConversation", () => {
    it("should return empty array when no attributes are provided", async () => {
      const repo = new JaegerConversationRepository(
        mockJaegerTraceRepository as any,
      );

      const result = await repo.getFullConversation(mockDatasource, [], {
        start: "2024-01-01T00:00:00.000Z",
        end: "2024-01-02T00:00:00.000Z",
        value: "459",
      });

      expect(result).toEqual({ traces: [] });
      expect(mockJaegerTraceRepository.search).not.toHaveBeenCalled();
    });

    it("should filter traces client-side and fetch full traces by IDs", async () => {
      const repo = new JaegerConversationRepository(
        mockJaegerTraceRepository as any,
      );
      mockJaegerTraceRepository.search.mockResolvedValue({
        traces: [
          { traceID: "trace-1", tags: { "session.id": "459" } },
          { traceID: "trace-2", tags: { "session.id": "999" } },
          { traceID: "trace-3", tags: { "session.id": "459" } },
        ],
      });
      mockJaegerTraceRepository.searchByTraceId
        .mockResolvedValueOnce(jaegerConvTraceJson)
        .mockResolvedValueOnce(jaegerConvTraceJson);

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
      expect(mockJaegerTraceRepository.search).toHaveBeenCalledWith(
        mockDatasource,
        {
          start: expect.any(String),
          end: expect.any(String),
          limit: 10000,
        },
        undefined,
      );
      expect(mockJaegerTraceRepository.searchByTraceId).toHaveBeenCalledTimes(
        2,
      );
      expect(mockJaegerTraceRepository.searchByTraceId).toHaveBeenCalledWith(
        mockDatasource,
        "trace-1",
        { start: "2024-01-01T00:00:00.000Z", end: "2024-01-02T00:00:00.000Z" },
        undefined,
      );
    });

    it("should handle multiple attributes with OR logic", async () => {
      const repo = new JaegerConversationRepository(
        mockJaegerTraceRepository as any,
      );
      mockJaegerTraceRepository.search.mockResolvedValue({
        traces: [
          { traceID: "trace-1", tags: { "session.id": "459" } },
          { traceID: "trace-2", tags: { "user.id": "459" } },
        ],
      });
      mockJaegerTraceRepository.searchByTraceId
        .mockResolvedValueOnce(jaegerConvTraceJson)
        .mockResolvedValueOnce(jaegerConvTraceJson);

      const result = await repo.getFullConversation(
        mockDatasource,
        ["session.id", "user.id"],
        {
          start: "2024-01-01T00:00:00.000Z",
          end: "2024-01-02T00:00:00.000Z",
          value: "459",
        },
      );

      expect(result.traces.length).toBe(2);
    });

    it("should skip traces that fail to fetch", async () => {
      const repo = new JaegerConversationRepository(
        mockJaegerTraceRepository as any,
      );
      mockJaegerTraceRepository.search.mockResolvedValue({
        traces: [
          { traceID: "trace-1", tags: { "session.id": "459" } },
          { traceID: "trace-2", tags: { "session.id": "459" } },
        ],
      });
      mockJaegerTraceRepository.searchByTraceId
        .mockResolvedValueOnce(jaegerConvTraceJson)
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
      const repo = new JaegerConversationRepository(
        mockJaegerTraceRepository as any,
      );
      mockJaegerTraceRepository.search.mockResolvedValue({
        traces: [{ traceID: "trace-1", tags: { "session.id": "999" } }],
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
      expect(mockJaegerTraceRepository.searchByTraceId).not.toHaveBeenCalled();
    });

    it("should handle numeric tag values", async () => {
      const repo = new JaegerConversationRepository(
        mockJaegerTraceRepository as any,
      );
      mockJaegerTraceRepository.search.mockResolvedValue({
        traces: [{ traceID: "trace-1", tags: { "session.id": 459 } }],
      });
      mockJaegerTraceRepository.searchByTraceId.mockResolvedValueOnce(
        jaegerConvTraceJson,
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
    });

    it("should handle traces with invalid trace IDs", async () => {
      const repo = new JaegerConversationRepository(
        mockJaegerTraceRepository as any,
      );
      mockJaegerTraceRepository.search.mockResolvedValue({
        traces: [
          { traceID: "", tags: { "session.id": "459" } },
          { traceID: null, tags: { "session.id": "459" } },
          { traceID: "valid-trace-id", tags: { "session.id": "459" } },
        ],
      });
      mockJaegerTraceRepository.searchByTraceId.mockResolvedValueOnce(
        jaegerConvTraceJson,
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
      expect(mockJaegerTraceRepository.searchByTraceId).toHaveBeenCalledTimes(
        1,
      );
      expect(mockJaegerTraceRepository.searchByTraceId).toHaveBeenCalledWith(
        mockDatasource,
        "valid-trace-id",
        expect.any(Object),
        undefined,
      );
    });

    it("should filter traces by project filter client-side in getFullConversation", async () => {
      const repo = new JaegerConversationRepository(
        mockJaegerTraceRepository as any,
      );

      mockJaegerTraceRepository.search.mockResolvedValue({
        traces: [
          {
            traceID: "trace-1",
            tags: { "session.id": "459", "project.id": "project-123" },
          },
          {
            traceID: "trace-3",
            tags: { "session.id": "459", "project.id": "project-123" },
          },
        ],
      });
      mockJaegerTraceRepository.searchByTraceId
        .mockResolvedValueOnce({
          traceID: "trace-1",
          batches: [
            {
              resource: {
                attributes: [
                  { key: "project.id", value: { stringValue: "project-123" } },
                ],
              },
              scopeSpans: [{ spans: [] }],
            },
          ],
        })
        .mockResolvedValueOnce({
          traceID: "trace-3",
          batches: [
            {
              resource: {
                attributes: [
                  { key: "project.id", value: { stringValue: "project-123" } },
                ],
              },
              scopeSpans: [{ spans: [] }],
            },
          ],
        });

      const result = await repo.getFullConversation(
        mockDatasource,
        ["session.id"],
        {
          start: "2024-01-01T00:00:00.000Z",
          end: "2024-01-02T00:00:00.000Z",
          value: "459",
          projectTraceFilter: {
            attributeName: "project.id",
            attributeValue: "project-123",
          },
        },
      );

      expect(result.traces.length).toBe(2);
      expect(mockJaegerTraceRepository.searchByTraceId).toHaveBeenCalledTimes(
        2,
      );
      expect(mockJaegerTraceRepository.searchByTraceId).toHaveBeenCalledWith(
        mockDatasource,
        "trace-1",
        expect.any(Object),
        { attributeName: "project.id", attributeValue: "project-123" },
      );
      expect(mockJaegerTraceRepository.searchByTraceId).toHaveBeenCalledWith(
        mockDatasource,
        "trace-3",
        expect.any(Object),
        { attributeName: "project.id", attributeValue: "project-123" },
      );
      expect(
        mockJaegerTraceRepository.searchByTraceId,
      ).not.toHaveBeenCalledWith(
        mockDatasource,
        "trace-2",
        expect.any(Object),
        expect.any(Object),
      );
    });

    it("should filter full traces by project filter client-side after fetching", async () => {
      const repo = new JaegerConversationRepository(
        mockJaegerTraceRepository as any,
      );
      mockJaegerTraceRepository.search.mockResolvedValue({
        traces: [
          {
            traceID: "trace-1",
            tags: { "session.id": "459", "project.id": "project-123" },
          },
        ],
      });

      mockJaegerTraceRepository.searchByTraceId.mockResolvedValueOnce({
        traceID: "trace-1",
        batches: [
          {
            resource: {
              attributes: [
                { key: "project.id", value: { stringValue: "project-123" } },
              ],
            },
            scopeSpans: [{ spans: [] }],
          },
        ],
      });

      const result = await repo.getFullConversation(
        mockDatasource,
        ["session.id"],
        {
          start: "2024-01-01T00:00:00.000Z",
          end: "2024-01-02T00:00:00.000Z",
          value: "459",
          projectTraceFilter: {
            attributeName: "project.id",
            attributeValue: "project-123",
          },
        },
      );

      expect(result.traces.length).toBe(1);
      expect(result.traces[0].traceID).toBe("trace-1");
    });

    it("should exclude full traces that do not match project filter", async () => {
      const repo = new JaegerConversationRepository(
        mockJaegerTraceRepository as any,
      );
      mockJaegerTraceRepository.search.mockResolvedValue({
        traces: [{ traceID: "trace-1", tags: { "session.id": "459" } }],
      });

      mockJaegerTraceRepository.searchByTraceId.mockRejectedValueOnce(
        new NotFoundException(
          formatError(ERROR_MESSAGES.TRACE_NOT_FOUND, "trace-1"),
        ),
      );

      const result = await repo.getFullConversation(
        mockDatasource,
        ["session.id"],
        {
          start: "2024-01-01T00:00:00.000Z",
          end: "2024-01-02T00:00:00.000Z",
          value: "459",
          projectTraceFilter: {
            attributeName: "project.id",
            attributeValue: "project-123",
          },
        },
      );

      expect(result.traces.length).toBe(0);
    });
  });

  describe("getConversationsByTraceIds", () => {
    it("should fetch traces by trace IDs", async () => {
      const repo = new JaegerConversationRepository(
        mockJaegerTraceRepository as any,
      );
      mockJaegerTraceRepository.searchByTraceId
        .mockResolvedValueOnce(jaegerConvTraceJson)
        .mockResolvedValueOnce(jaegerConvTraceJson);

      const result = await repo.getConversationsByTraceIds(mockDatasource, {
        traceIds: ["trace-1", "trace-2"],
        startDate: "2024-01-01T00:00:00.000Z",
        endDate: "2024-01-02T00:00:00.000Z",
      });

      expect(result.traces.length).toBe(2);
      expect(mockJaegerTraceRepository.searchByTraceId).toHaveBeenCalledTimes(
        2,
      );
      expect(mockJaegerTraceRepository.searchByTraceId).toHaveBeenCalledWith(
        mockDatasource,
        "trace-1",
        { start: "2024-01-01T00:00:00.000Z", end: "2024-01-02T00:00:00.000Z" },
        undefined,
      );
    });

    it("should skip traces that fail to fetch", async () => {
      const repo = new JaegerConversationRepository(
        mockJaegerTraceRepository as any,
      );
      mockJaegerTraceRepository.searchByTraceId
        .mockResolvedValueOnce(jaegerConvTraceJson)
        .mockRejectedValueOnce(new Error("Fetch failed"));

      const result = await repo.getConversationsByTraceIds(mockDatasource, {
        traceIds: ["trace-1", "trace-2"],
      });

      expect(result.traces.length).toBe(1);
    });

    it("should work without time range", async () => {
      const repo = new JaegerConversationRepository(
        mockJaegerTraceRepository as any,
      );
      mockJaegerTraceRepository.searchByTraceId.mockResolvedValueOnce(
        jaegerConvTraceJson,
      );

      await repo.getConversationsByTraceIds(mockDatasource, {
        traceIds: ["trace-1"],
      });

      expect(mockJaegerTraceRepository.searchByTraceId).toHaveBeenCalledWith(
        mockDatasource,
        "trace-1",
        undefined,
        undefined,
      );
    });

    it("should filter full traces by project filter client-side (post-fetch validation)", async () => {
      const repo = new JaegerConversationRepository(
        mockJaegerTraceRepository as any,
      );

      mockJaegerTraceRepository.searchByTraceId
        .mockResolvedValueOnce({
          traceID: "trace-1",
          batches: [
            {
              resource: {
                attributes: [
                  { key: "project.id", value: { stringValue: "project-123" } },
                ],
              },
              scopeSpans: [{ spans: [] }],
            },
          ],
        })
        .mockRejectedValueOnce(
          new NotFoundException(
            formatError(ERROR_MESSAGES.TRACE_NOT_FOUND, "trace-2"),
          ),
        )
        .mockResolvedValueOnce({
          traceID: "trace-3",
          batches: [
            {
              resource: {
                attributes: [
                  { key: "project.id", value: { stringValue: "project-123" } },
                ],
              },
              scopeSpans: [{ spans: [] }],
            },
          ],
        });

      const result = await repo.getConversationsByTraceIds(mockDatasource, {
        traceIds: ["trace-1", "trace-2", "trace-3"],
        startDate: "2024-01-01T00:00:00.000Z",
        endDate: "2024-01-02T00:00:00.000Z",
        projectTraceFilter: {
          attributeName: "project.id",
          attributeValue: "project-123",
        },
      });

      expect(result.traces.length).toBe(2);
      expect(result.traces.map((t) => t.traceID)).toEqual(
        expect.arrayContaining(["trace-1", "trace-3"]),
      );
      expect(
        result.traces.find((t) => t.traceID === "trace-2"),
      ).toBeUndefined();
    });

    it("should filter full traces by project filter checking span attributes when resource attributes do not match", async () => {
      const repo = new JaegerConversationRepository(
        mockJaegerTraceRepository as any,
      );
      mockJaegerTraceRepository.searchByTraceId.mockResolvedValueOnce({
        traceID: "trace-1",
        batches: [
          {
            resource: {
              attributes: [
                { key: "service.name", value: { stringValue: "api" } },
              ],
            },
            scopeSpans: [
              {
                spans: [
                  {
                    attributes: [
                      {
                        key: "project.id",
                        value: { stringValue: "project-123" },
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      });

      const result = await repo.getConversationsByTraceIds(mockDatasource, {
        traceIds: ["trace-1"],
        projectTraceFilter: {
          attributeName: "project.id",
          attributeValue: "project-123",
        },
      });

      expect(result.traces.length).toBe(1);
      expect(result.traces[0].traceID).toBe("trace-1");
    });

    it("should exclude traces that do not match project filter in any attribute", async () => {
      const repo = new JaegerConversationRepository(
        mockJaegerTraceRepository as any,
      );

      mockJaegerTraceRepository.searchByTraceId.mockRejectedValueOnce(
        new NotFoundException(
          formatError(ERROR_MESSAGES.TRACE_NOT_FOUND, "trace-1"),
        ),
      );

      const result = await repo.getConversationsByTraceIds(mockDatasource, {
        traceIds: ["trace-1"],
        projectTraceFilter: {
          attributeName: "project.id",
          attributeValue: "project-123",
        },
      });

      expect(result.traces.length).toBe(0);
    });

    it("should skip traces that throw NotFoundException due to project filter", async () => {
      const repo = new JaegerConversationRepository(
        mockJaegerTraceRepository as any,
      );
      mockJaegerTraceRepository.searchByTraceId
        .mockResolvedValueOnce({
          traceID: "trace-1",
          batches: [
            {
              resource: {
                attributes: [
                  { key: "project.id", value: { stringValue: "project-123" } },
                ],
              },
              scopeSpans: [{ spans: [] }],
            },
          ],
        })
        .mockRejectedValueOnce(new NotFoundException("Trace not found"))
        .mockResolvedValueOnce({
          traceID: "trace-3",
          batches: [
            {
              resource: {
                attributes: [
                  { key: "project.id", value: { stringValue: "project-123" } },
                ],
              },
              scopeSpans: [{ spans: [] }],
            },
          ],
        });

      const result = await repo.getConversationsByTraceIds(mockDatasource, {
        traceIds: ["trace-1", "trace-2", "trace-3"],
        projectTraceFilter: {
          attributeName: "project.id",
          attributeValue: "project-123",
        },
      });

      expect(result.traces.length).toBe(2);
      expect(result.traces.map((t) => t.traceID)).toEqual([
        "trace-1",
        "trace-3",
      ]);
    });

    it("should pass project filter to searchByTraceId when fetching full traces", async () => {
      const repo = new JaegerConversationRepository(
        mockJaegerTraceRepository as any,
      );
      mockJaegerTraceRepository.search.mockResolvedValue({
        traces: [
          {
            traceID: "trace-1",
            tags: { "session.id": "459", "project.id": "project-123" },
          },
        ],
      });
      mockJaegerTraceRepository.searchByTraceId.mockResolvedValue({
        traceID: "trace-1",
        batches: [
          {
            resource: {
              attributes: [
                { key: "project.id", value: { stringValue: "project-123" } },
              ],
            },
            scopeSpans: [{ spans: [] }],
          },
        ],
      });

      const projectTraceFilter = {
        attributeName: "project.id",
        attributeValue: "project-123",
      };

      await repo.getFullConversation(mockDatasource, ["session.id"], {
        start: "2024-01-01T00:00:00.000Z",
        end: "2024-01-02T00:00:00.000Z",
        value: "459",
        projectTraceFilter,
      });

      expect(mockJaegerTraceRepository.searchByTraceId).toHaveBeenCalledWith(
        mockDatasource,
        "trace-1",
        expect.any(Object),
        projectTraceFilter,
      );
    });
  });
});
