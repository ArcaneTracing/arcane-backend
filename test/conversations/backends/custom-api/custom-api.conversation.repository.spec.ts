import { CustomApiConversationRepository } from "../../../../src/conversations/backends/custom-api/custom-api.conversation.repository";
import {
  Datasource,
  DatasourceSource,
} from "../../../../src/datasources/entities/datasource.entity";
import { CustomApiTraceRepository } from "../../../../src/traces/backends/custom-api/custom-api.trace.repository";
import { NotFoundException } from "@nestjs/common";
import {
  ERROR_MESSAGES,
  formatError,
} from "../../../../src/common/constants/error-messages.constants";

const tempoConvListJson = require("../../resources/tempo/conv-list.json");
const tempoConvTraceJson = require("../../resources/tempo/conv-trace-response.json");

describe("CustomApiConversationRepository", () => {
  const mockCustomApiTraceRepository = {
    search: jest.fn(),
    searchByTraceId: jest.fn(),
  };

  const createMockDatasource = (capabilities?: {
    filterByAttributeExists?: boolean;
    searchByAttributes?: boolean;
  }): Datasource => {
    return {
      id: "datasource-1",
      name: "Custom API Datasource",
      description: "Test Description",
      url: "https://custom-api.example.com",
      type: "traces" as any,
      source: DatasourceSource.CUSTOM_API,
      organisationId: "org-1",
      createdAt: new Date(),
      updatedAt: new Date(),
      createdById: "user-1",
      projectId: "project-1",
      config: {
        customApi: {
          baseUrl: "https://custom-api.example.com",
          endpoints: {
            search: {
              path: "/api/search",
            },
            searchByTraceId: {
              path: "/api/traces/{traceId}",
            },
          },
          capabilities: {
            searchByQuery: true,
            searchByAttributes: capabilities?.searchByAttributes ?? false,
            filterByAttributeExists:
              capabilities?.filterByAttributeExists ?? false,
            getAttributeNames: false,
            getAttributeValues: false,
          },
        },
      },
    } as unknown as Datasource;
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("getConversations", () => {
    it("should return empty array when no attributes are provided", async () => {
      const repo = new CustomApiConversationRepository(
        mockCustomApiTraceRepository as any,
      );
      const datasource = createMockDatasource();

      const result = await repo.getConversations(datasource, [], {
        start: "2024-01-01T00:00:00.000Z",
        end: "2024-01-02T00:00:00.000Z",
      });

      expect(result).toEqual([]);
      expect(mockCustomApiTraceRepository.search).not.toHaveBeenCalled();
    });

    it("should use filterByAttributeExists when capability is enabled", async () => {
      const repo = new CustomApiConversationRepository(
        mockCustomApiTraceRepository as any,
      );
      const datasource = createMockDatasource({
        filterByAttributeExists: true,
      });
      mockCustomApiTraceRepository.search.mockResolvedValue(tempoConvListJson);

      const result = await repo.getConversations(datasource, ["session.id"], {
        start: "2024-01-01T00:00:00.000Z",
        end: "2024-01-02T00:00:00.000Z",
      });

      expect(result.length).toBe(1);
      expect(result[0].conversationId).toBe("459");
      expect(mockCustomApiTraceRepository.search).toHaveBeenCalledWith(
        datasource,
        expect.objectContaining({
          limit: 10000,
          filterByAttributeExists: ["session.id"],
        }),
        undefined,
      );
    });

    it("should use client-side filtering when filterByAttributeExists is not available", async () => {
      const repo = new CustomApiConversationRepository(
        mockCustomApiTraceRepository as any,
      );
      const datasource = createMockDatasource({
        filterByAttributeExists: false,
      });
      mockCustomApiTraceRepository.search.mockResolvedValue(tempoConvListJson);

      const result = await repo.getConversations(datasource, ["session.id"], {
        start: "2024-01-01T00:00:00.000Z",
        end: "2024-01-02T00:00:00.000Z",
      });

      expect(result.length).toBe(1);
      expect(mockCustomApiTraceRepository.search).toHaveBeenCalledWith(
        datasource,
        expect.objectContaining({
          limit: 10000,
        }),
        undefined,
      );
      expect(
        mockCustomApiTraceRepository.search.mock.calls[0][1]
          .filterByAttributeExists,
      ).toBeUndefined();
    });

    it("should return empty array when no traces are found", async () => {
      const repo = new CustomApiConversationRepository(
        mockCustomApiTraceRepository as any,
      );
      const datasource = createMockDatasource({
        filterByAttributeExists: true,
      });
      mockCustomApiTraceRepository.search.mockResolvedValue({ traces: [] });

      const result = await repo.getConversations(
        datasource,
        ["session.id"],
        {},
      );

      expect(result).toEqual([]);
    });

    it("should default to 1 hour ago when time range not provided", async () => {
      const repo = new CustomApiConversationRepository(
        mockCustomApiTraceRepository as any,
      );
      const datasource = createMockDatasource({
        filterByAttributeExists: true,
      });
      mockCustomApiTraceRepository.search.mockResolvedValue({ traces: [] });

      await repo.getConversations(datasource, ["session.id"], {});

      expect(mockCustomApiTraceRepository.search).toHaveBeenCalledWith(
        datasource,
        expect.objectContaining({
          start: expect.any(String),
          end: expect.any(String),
        }),
        undefined,
      );

      const call = mockCustomApiTraceRepository.search.mock.calls[0][1];
      const startTime = new Date(call.start).getTime();
      const endTime = new Date(call.end).getTime();
      const oneHourInMs = 3600 * 1000;

      expect(endTime - startTime).toBeCloseTo(oneHourInMs, -3);
    });

    it("should handle multiple attributes with filterByAttributeExists", async () => {
      const repo = new CustomApiConversationRepository(
        mockCustomApiTraceRepository as any,
      );
      const datasource = createMockDatasource({
        filterByAttributeExists: true,
      });
      mockCustomApiTraceRepository.search.mockResolvedValue(tempoConvListJson);

      await repo.getConversations(datasource, ["session.id", "user.id"], {
        start: "2024-01-01T00:00:00.000Z",
        end: "2024-01-02T00:00:00.000Z",
      });

      expect(mockCustomApiTraceRepository.search).toHaveBeenCalledWith(
        datasource,
        expect.objectContaining({
          filterByAttributeExists: ["session.id,user.id"],
        }),
        undefined,
      );
    });

    it("should filter traces by project filter client-side when searchByAttributes is false in getConversationsWithFilterByAttributeExists", async () => {
      const repo = new CustomApiConversationRepository(
        mockCustomApiTraceRepository as any,
      );
      const datasource = createMockDatasource({
        filterByAttributeExists: true,
        searchByAttributes: false,
      });
      mockCustomApiTraceRepository.search.mockResolvedValue({
        traces: [
          {
            traceID: "trace-1",
            rootTraceName: "Root",
            spanSet: {
              spans: [
                {
                  attributes: [
                    { key: "session.id", value: { stringValue: "459" } },
                    {
                      key: "project.id",
                      value: { stringValue: "project-123" },
                    },
                  ],
                },
              ],
            },
          },
          {
            traceID: "trace-2",
            rootTraceName: "Other",
            spanSet: {
              spans: [
                {
                  attributes: [
                    { key: "session.id", value: { stringValue: "123" } },
                    {
                      key: "project.id",
                      value: { stringValue: "project-123" },
                    },
                  ],
                },
              ],
            },
          },
        ],
      });

      const result = await repo.getConversations(datasource, ["session.id"], {
        start: "2024-01-01T00:00:00.000Z",
        end: "2024-01-02T00:00:00.000Z",
        projectTraceFilter: {
          attributeName: "project.id",
          attributeValue: "project-123",
        },
      });

      expect(result.length).toBe(2);
      expect(result.find((c) => c.conversationId === "459")).toBeDefined();
      expect(result.find((c) => c.conversationId === "123")).toBeDefined();

      expect(
        result.find((c) => c.traceIds.includes("trace-3")),
      ).toBeUndefined();
      expect(mockCustomApiTraceRepository.search).toHaveBeenCalledWith(
        datasource,
        expect.objectContaining({
          start: "2024-01-01T00:00:00.000Z",
          end: "2024-01-02T00:00:00.000Z",
          limit: 10000,
          filterByAttributeExists: ["session.id"],
        }),
        { attributeName: "project.id", attributeValue: "project-123" },
      );

      expect(
        mockCustomApiTraceRepository.search.mock.calls[0][1].attributes,
      ).toBeUndefined();
    });

    it("should filter traces by project filter client-side when searchByAttributes is false in getConversationsClientSide", async () => {
      const repo = new CustomApiConversationRepository(
        mockCustomApiTraceRepository as any,
      );
      const datasource = createMockDatasource({
        filterByAttributeExists: false,
        searchByAttributes: false,
      });
      mockCustomApiTraceRepository.search.mockResolvedValue({
        traces: [
          {
            traceID: "trace-1",
            rootTraceName: "Root",
            spanSet: {
              spans: [
                {
                  attributes: [
                    { key: "session.id", value: { stringValue: "459" } },
                    {
                      key: "project.id",
                      value: { stringValue: "project-123" },
                    },
                  ],
                },
              ],
            },
          },
        ],
      });

      const result = await repo.getConversations(datasource, ["session.id"], {
        start: "2024-01-01T00:00:00.000Z",
        end: "2024-01-02T00:00:00.000Z",
        projectTraceFilter: {
          attributeName: "project.id",
          attributeValue: "project-123",
        },
      });
      expect(result.length).toBe(1);
      expect(result[0].conversationId).toBe("459");

      expect(result[0].traceIds).toContain("trace-1");

      expect(
        result.find((c) => c.traceIds.includes("trace-2")),
      ).toBeUndefined();
      expect(mockCustomApiTraceRepository.search).toHaveBeenCalledWith(
        datasource,
        expect.objectContaining({
          start: "2024-01-01T00:00:00.000Z",
          end: "2024-01-02T00:00:00.000Z",
          limit: 10000,
        }),
        { attributeName: "project.id", attributeValue: "project-123" },
      );

      expect(
        mockCustomApiTraceRepository.search.mock.calls[0][1].attributes,
      ).toBeUndefined();
    });

    it("should add project filter to search params when searchByAttributes is true in getConversationsWithFilterByAttributeExists", async () => {
      const repo = new CustomApiConversationRepository(
        mockCustomApiTraceRepository as any,
      );
      const datasource = createMockDatasource({
        filterByAttributeExists: true,
        searchByAttributes: true,
      });

      mockCustomApiTraceRepository.search.mockResolvedValue(tempoConvListJson);

      await repo.getConversations(datasource, ["session.id"], {
        start: "2024-01-01T00:00:00.000Z",
        end: "2024-01-02T00:00:00.000Z",
        projectTraceFilter: {
          attributeName: "project.id",
          attributeValue: "project-123",
        },
      });
      expect(mockCustomApiTraceRepository.search).toHaveBeenCalledWith(
        datasource,
        expect.objectContaining({
          start: "2024-01-01T00:00:00.000Z",
          end: "2024-01-02T00:00:00.000Z",
          limit: 10000,
          filterByAttributeExists: ["session.id"],
        }),
        { attributeName: "project.id", attributeValue: "project-123" },
      );
    });

    it("should add project filter to search params when searchByAttributes is true in getConversationsClientSide", async () => {
      const repo = new CustomApiConversationRepository(
        mockCustomApiTraceRepository as any,
      );
      const datasource = createMockDatasource({
        filterByAttributeExists: false,
        searchByAttributes: true,
      });

      mockCustomApiTraceRepository.search.mockResolvedValue(tempoConvListJson);

      await repo.getConversations(datasource, ["session.id"], {
        start: "2024-01-01T00:00:00.000Z",
        end: "2024-01-02T00:00:00.000Z",
        projectTraceFilter: {
          attributeName: "project.id",
          attributeValue: "project-123",
        },
      });
      expect(mockCustomApiTraceRepository.search).toHaveBeenCalledWith(
        datasource,
        expect.objectContaining({
          start: "2024-01-01T00:00:00.000Z",
          end: "2024-01-02T00:00:00.000Z",
          limit: 10000,
        }),
        { attributeName: "project.id", attributeValue: "project-123" },
      );
    });
  });

  describe("getFullConversation", () => {
    it("should return empty array when no attributes are provided", async () => {
      const repo = new CustomApiConversationRepository(
        mockCustomApiTraceRepository as any,
      );
      const datasource = createMockDatasource();

      const result = await repo.getFullConversation(datasource, [], {
        start: "2024-01-01T00:00:00.000Z",
        end: "2024-01-02T00:00:00.000Z",
        value: "459",
      });

      expect(result).toEqual({ traces: [] });
      expect(mockCustomApiTraceRepository.search).not.toHaveBeenCalled();
    });

    it("should use searchByAttributes when capability is enabled", async () => {
      const repo = new CustomApiConversationRepository(
        mockCustomApiTraceRepository as any,
      );
      const datasource = createMockDatasource({ searchByAttributes: true });
      mockCustomApiTraceRepository.search.mockResolvedValue({
        traces: [{ traceID: "trace-1" }, { traceID: "trace-2" }],
      });
      mockCustomApiTraceRepository.searchByTraceId
        .mockResolvedValueOnce(tempoConvTraceJson)
        .mockResolvedValueOnce(tempoConvTraceJson);

      const result = await repo.getFullConversation(
        datasource,
        ["session.id"],
        {
          start: "2024-01-01T00:00:00.000Z",
          end: "2024-01-02T00:00:00.000Z",
          value: "459",
        },
      );

      expect(result.traces.length).toBe(2);
      expect(mockCustomApiTraceRepository.search).toHaveBeenCalledWith(
        datasource,
        {
          start: "2024-01-01T00:00:00.000Z",
          end: "2024-01-02T00:00:00.000Z",
          attributes: 'session.id="459"',
        },
        undefined,
      );
      expect(
        mockCustomApiTraceRepository.searchByTraceId,
      ).toHaveBeenCalledTimes(2);
    });

    it("should use fallback when searchByAttributes is not available", async () => {
      const repo = new CustomApiConversationRepository(
        mockCustomApiTraceRepository as any,
      );
      const datasource = createMockDatasource({
        searchByAttributes: false,
        filterByAttributeExists: true,
      });
      const mockConversationList = {
        traces: [
          {
            traceID: "trace-1",
            rootTraceName: "Test",
            spanSet: {
              spans: [
                {
                  attributes: [
                    {
                      key: "session.id",
                      value: { stringValue: "459" },
                    },
                  ],
                },
              ],
            },
          },
        ],
      };
      mockCustomApiTraceRepository.search.mockResolvedValueOnce(
        mockConversationList,
      );
      mockCustomApiTraceRepository.searchByTraceId.mockResolvedValueOnce(
        tempoConvTraceJson,
      );

      const result = await repo.getFullConversation(
        datasource,
        ["session.id"],
        {
          start: "2024-01-01T00:00:00.000Z",
          end: "2024-01-02T00:00:00.000Z",
          value: "459",
        },
      );

      expect(result.traces.length).toBe(1);
      expect(mockCustomApiTraceRepository.search).toHaveBeenCalledTimes(1);
      expect(
        mockCustomApiTraceRepository.searchByTraceId,
      ).toHaveBeenCalledTimes(1);
    });

    it("should return empty traces when conversation not found in fallback", async () => {
      const repo = new CustomApiConversationRepository(
        mockCustomApiTraceRepository as any,
      );
      const datasource = createMockDatasource({
        searchByAttributes: false,
        filterByAttributeExists: true,
      });
      mockCustomApiTraceRepository.search.mockResolvedValueOnce({
        traces: [
          {
            traceID: "trace-1",
            rootTraceName: "Test",
            spanSet: {
              spans: [
                {
                  attributes: [
                    {
                      key: "session.id",
                      value: { stringValue: "other-value" },
                    },
                  ],
                },
              ],
            },
          },
        ],
      });

      const result = await repo.getFullConversation(
        datasource,
        ["session.id"],
        {
          start: "2024-01-01T00:00:00.000Z",
          end: "2024-01-02T00:00:00.000Z",
          value: "459",
        },
      );

      expect(result.traces).toEqual([]);
      expect(
        mockCustomApiTraceRepository.searchByTraceId,
      ).not.toHaveBeenCalled();
    });

    it("should handle multiple attributes with OR logic when searchByAttributes enabled", async () => {
      const repo = new CustomApiConversationRepository(
        mockCustomApiTraceRepository as any,
      );
      const datasource = createMockDatasource({ searchByAttributes: true });
      mockCustomApiTraceRepository.search.mockResolvedValue({
        traces: [{ traceID: "trace-1" }],
      });
      mockCustomApiTraceRepository.searchByTraceId.mockResolvedValueOnce(
        tempoConvTraceJson,
      );

      await repo.getFullConversation(datasource, ["session.id", "user.id"], {
        start: "2024-01-01T00:00:00.000Z",
        end: "2024-01-02T00:00:00.000Z",
        value: "459",
      });

      expect(mockCustomApiTraceRepository.search).toHaveBeenCalledWith(
        datasource,
        {
          start: "2024-01-01T00:00:00.000Z",
          end: "2024-01-02T00:00:00.000Z",
          attributes: 'session.id="459" user.id="459"',
        },
        undefined,
      );
    });

    it("should dedupe trace IDs", async () => {
      const repo = new CustomApiConversationRepository(
        mockCustomApiTraceRepository as any,
      );
      const datasource = createMockDatasource({ searchByAttributes: true });
      mockCustomApiTraceRepository.search.mockResolvedValue({
        traces: [
          { traceID: "trace-1" },
          { traceID: "trace-1" },
          { traceID: "trace-2" },
        ],
      });
      mockCustomApiTraceRepository.searchByTraceId
        .mockResolvedValueOnce(tempoConvTraceJson)
        .mockResolvedValueOnce(tempoConvTraceJson);

      const result = await repo.getFullConversation(
        datasource,
        ["session.id"],
        {
          start: "2024-01-01T00:00:00.000Z",
          end: "2024-01-02T00:00:00.000Z",
          value: "459",
        },
      );

      expect(result.traces.length).toBe(2);
      expect(
        mockCustomApiTraceRepository.searchByTraceId,
      ).toHaveBeenCalledTimes(2);
    });

    it("should skip traces that fail to fetch", async () => {
      const repo = new CustomApiConversationRepository(
        mockCustomApiTraceRepository as any,
      );
      const datasource = createMockDatasource({ searchByAttributes: true });
      mockCustomApiTraceRepository.search.mockResolvedValue({
        traces: [{ traceID: "trace-1" }, { traceID: "trace-2" }],
      });
      mockCustomApiTraceRepository.searchByTraceId
        .mockResolvedValueOnce(tempoConvTraceJson)
        .mockRejectedValueOnce(new Error("Fetch failed"));

      const result = await repo.getFullConversation(
        datasource,
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
      const repo = new CustomApiConversationRepository(
        mockCustomApiTraceRepository as any,
      );
      const datasource = createMockDatasource({ searchByAttributes: true });
      mockCustomApiTraceRepository.search.mockResolvedValue({
        traces: [
          { traceID: "" },
          { traceID: null },
          { traceID: "valid-trace-id" },
        ],
      });
      mockCustomApiTraceRepository.searchByTraceId.mockResolvedValueOnce(
        tempoConvTraceJson,
      );

      const result = await repo.getFullConversation(
        datasource,
        ["session.id"],
        {
          start: "2024-01-01T00:00:00.000Z",
          end: "2024-01-02T00:00:00.000Z",
          value: "459",
        },
      );

      expect(result.traces.length).toBe(1);
      expect(
        mockCustomApiTraceRepository.searchByTraceId,
      ).toHaveBeenCalledTimes(1);
      expect(mockCustomApiTraceRepository.searchByTraceId).toHaveBeenCalledWith(
        datasource,
        "valid-trace-id",
        expect.any(Object),
        undefined,
      );
    });
  });

  describe("getConversationsByTraceIds", () => {
    it("should fetch traces by trace IDs", async () => {
      const repo = new CustomApiConversationRepository(
        mockCustomApiTraceRepository as any,
      );
      const datasource = createMockDatasource();
      mockCustomApiTraceRepository.searchByTraceId
        .mockResolvedValueOnce(tempoConvTraceJson)
        .mockResolvedValueOnce(tempoConvTraceJson);

      const result = await repo.getConversationsByTraceIds(datasource, {
        traceIds: ["trace-1", "trace-2"],
        startDate: "2024-01-01T00:00:00.000Z",
        endDate: "2024-01-02T00:00:00.000Z",
      });

      expect(result.traces.length).toBe(2);
      expect(
        mockCustomApiTraceRepository.searchByTraceId,
      ).toHaveBeenCalledTimes(2);
      expect(mockCustomApiTraceRepository.searchByTraceId).toHaveBeenCalledWith(
        datasource,
        "trace-1",
        { start: "2024-01-01T00:00:00.000Z", end: "2024-01-02T00:00:00.000Z" },
        undefined,
      );
    });

    it("should skip traces that fail to fetch", async () => {
      const repo = new CustomApiConversationRepository(
        mockCustomApiTraceRepository as any,
      );
      const datasource = createMockDatasource();
      mockCustomApiTraceRepository.searchByTraceId
        .mockResolvedValueOnce(tempoConvTraceJson)
        .mockRejectedValueOnce(new Error("Fetch failed"));

      const result = await repo.getConversationsByTraceIds(datasource, {
        traceIds: ["trace-1", "trace-2"],
      });

      expect(result.traces.length).toBe(1);
    });

    it("should work without time range", async () => {
      const repo = new CustomApiConversationRepository(
        mockCustomApiTraceRepository as any,
      );
      const datasource = createMockDatasource();
      mockCustomApiTraceRepository.searchByTraceId.mockResolvedValueOnce(
        tempoConvTraceJson,
      );

      await repo.getConversationsByTraceIds(datasource, {
        traceIds: ["trace-1"],
      });

      expect(mockCustomApiTraceRepository.searchByTraceId).toHaveBeenCalledWith(
        datasource,
        "trace-1",
        undefined,
        undefined,
      );
    });

    it("should dedupe trace IDs", async () => {
      const repo = new CustomApiConversationRepository(
        mockCustomApiTraceRepository as any,
      );
      const datasource = createMockDatasource();
      mockCustomApiTraceRepository.searchByTraceId
        .mockResolvedValueOnce(tempoConvTraceJson)
        .mockResolvedValueOnce(tempoConvTraceJson);

      await repo.getConversationsByTraceIds(datasource, {
        traceIds: ["trace-1", "trace-1", "trace-2"],
      });

      expect(
        mockCustomApiTraceRepository.searchByTraceId,
      ).toHaveBeenCalledTimes(2);
      expect(mockCustomApiTraceRepository.searchByTraceId).toHaveBeenCalledWith(
        datasource,
        "trace-1",
        undefined,
        undefined,
      );
      expect(mockCustomApiTraceRepository.searchByTraceId).toHaveBeenCalledWith(
        datasource,
        "trace-2",
        undefined,
        undefined,
      );
    });

    it("should filter full traces by project filter client-side (post-fetch validation)", async () => {
      const repo = new CustomApiConversationRepository(
        mockCustomApiTraceRepository as any,
      );
      const datasource = createMockDatasource();
      mockCustomApiTraceRepository.searchByTraceId
        .mockResolvedValueOnce({
          traceID: "trace-1",
          resourceSpans: [
            {
              resource: {
                attributes: [
                  { key: "project.id", value: { stringValue: "project-123" } },
                ],
              },
              spanSet: { spans: [] },
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
          resourceSpans: [
            {
              resource: {
                attributes: [
                  { key: "project.id", value: { stringValue: "project-123" } },
                ],
              },
              spanSet: { spans: [] },
            },
          ],
        });

      const result = await repo.getConversationsByTraceIds(datasource, {
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

      expect(
        mockCustomApiTraceRepository.searchByTraceId,
      ).toHaveBeenCalledTimes(3);
      expect(mockCustomApiTraceRepository.searchByTraceId).toHaveBeenCalledWith(
        datasource,
        "trace-1",
        { start: "2024-01-01T00:00:00.000Z", end: "2024-01-02T00:00:00.000Z" },
        { attributeName: "project.id", attributeValue: "project-123" },
      );
      expect(mockCustomApiTraceRepository.searchByTraceId).toHaveBeenCalledWith(
        datasource,
        "trace-2",
        { start: "2024-01-01T00:00:00.000Z", end: "2024-01-02T00:00:00.000Z" },
        { attributeName: "project.id", attributeValue: "project-123" },
      );
      expect(mockCustomApiTraceRepository.searchByTraceId).toHaveBeenCalledWith(
        datasource,
        "trace-3",
        { start: "2024-01-01T00:00:00.000Z", end: "2024-01-02T00:00:00.000Z" },
        { attributeName: "project.id", attributeValue: "project-123" },
      );
    });

    it("should filter full traces by project filter checking span attributes when resource attributes do not match", async () => {
      const repo = new CustomApiConversationRepository(
        mockCustomApiTraceRepository as any,
      );
      const datasource = createMockDatasource();

      mockCustomApiTraceRepository.searchByTraceId.mockResolvedValueOnce({
        traceID: "trace-1",
        resourceSpans: [
          {
            resource: {
              attributes: [
                { key: "service.name", value: { stringValue: "api" } },
              ],
            },
            spanSet: {
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
          },
        ],
      });

      const result = await repo.getConversationsByTraceIds(datasource, {
        traceIds: ["trace-1"],
        projectTraceFilter: {
          attributeName: "project.id",
          attributeValue: "project-123",
        },
      });

      expect(result.traces.length).toBe(1);
      expect(result.traces[0].traceID).toBe("trace-1");

      expect(mockCustomApiTraceRepository.searchByTraceId).toHaveBeenCalledWith(
        datasource,
        "trace-1",
        undefined,
        { attributeName: "project.id", attributeValue: "project-123" },
      );
    });

    it("should exclude traces that do not match project filter in any attribute", async () => {
      const repo = new CustomApiConversationRepository(
        mockCustomApiTraceRepository as any,
      );
      const datasource = createMockDatasource();

      mockCustomApiTraceRepository.searchByTraceId.mockRejectedValueOnce(
        new NotFoundException(
          formatError(ERROR_MESSAGES.TRACE_NOT_FOUND, "trace-1"),
        ),
      );

      const result = await repo.getConversationsByTraceIds(datasource, {
        traceIds: ["trace-1"],
        projectTraceFilter: {
          attributeName: "project.id",
          attributeValue: "project-123",
        },
      });

      expect(result.traces.length).toBe(0);

      expect(mockCustomApiTraceRepository.searchByTraceId).toHaveBeenCalledWith(
        datasource,
        "trace-1",
        undefined,
        { attributeName: "project.id", attributeValue: "project-123" },
      );
    });
  });
});
