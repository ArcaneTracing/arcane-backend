import { JaegerParamsBuilder } from "../../../../src/traces/backends/jaeger/jaeger.params.builder";
import { SearchTracesRequestDto } from "../../../../src/traces/dto/request/search-traces-request.dto";

describe("JaegerParamsBuilder", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("build", () => {
    it("should build params with start and end timestamps", () => {
      const searchParams: SearchTracesRequestDto = {
        start: "2024-01-01T00:00:00Z",
        end: "2024-01-02T00:00:00Z",
      };

      const params = JaegerParamsBuilder.build(searchParams);

      expect(params.get("query.start_time_min")).toBeDefined();
      expect(params.get("query.start_time_max")).toBeDefined();
    });

    it("should include num_traces when limit is provided", () => {
      const searchParams: SearchTracesRequestDto = {
        start: "2024-01-01T00:00:00Z",
        end: "2024-01-02T00:00:00Z",
        limit: 10,
      };

      const params = JaegerParamsBuilder.build(searchParams);

      expect(params.get("query.num_traces")).toBe("10");
    });

    it("should cap num_traces to MAX_SEARCH_DEPTH", () => {
      const searchParams: SearchTracesRequestDto = {
        start: "2024-01-01T00:00:00Z",
        end: "2024-01-02T00:00:00Z",
        limit: 100,
      };

      const params = JaegerParamsBuilder.build(searchParams);

      expect(params.get("query.num_traces")).toBe("10");
    });

    it("should floor limit value", () => {
      const searchParams: SearchTracesRequestDto = {
        start: "2024-01-01T00:00:00Z",
        end: "2024-01-02T00:00:00Z",
        limit: 5.7,
      };

      const params = JaegerParamsBuilder.build(searchParams);

      expect(params.get("query.num_traces")).toBe("10");
    });

    it("should set minimum num_traces to 10", () => {
      const searchParams: SearchTracesRequestDto = {
        start: "2024-01-01T00:00:00Z",
        end: "2024-01-02T00:00:00Z",
        limit: 0.5,
      };

      const params = JaegerParamsBuilder.build(searchParams);

      expect(params.get("query.num_traces")).toBe("10");
    });

    it("should include minDuration when provided", () => {
      const searchParams: SearchTracesRequestDto = {
        start: "2024-01-01T00:00:00Z",
        end: "2024-01-02T00:00:00Z",
        minDuration: 1000000,
      };

      const params = JaegerParamsBuilder.build(searchParams);

      expect(params.get("query.duration_min")).toBe("1000000ns");
    });

    it("should include maxDuration when provided", () => {
      const searchParams: SearchTracesRequestDto = {
        start: "2024-01-01T00:00:00Z",
        end: "2024-01-02T00:00:00Z",
        maxDuration: 10000000,
      };

      const params = JaegerParamsBuilder.build(searchParams);

      expect(params.get("query.duration_max")).toBe("10000000ns");
    });

    it("should include serviceName when provided", () => {
      const searchParams: SearchTracesRequestDto = {
        start: "2024-01-01T00:00:00Z",
        end: "2024-01-02T00:00:00Z",
        serviceName: "test-service",
      };

      const params = JaegerParamsBuilder.build(searchParams);

      expect(params.get("query.service_name")).toBe("test-service");
    });

    it("should include operationName when provided", () => {
      const searchParams: SearchTracesRequestDto = {
        start: "2024-01-01T00:00:00Z",
        end: "2024-01-02T00:00:00Z",
        operationName: "test-operation",
      };

      const params = JaegerParamsBuilder.build(searchParams);

      expect(params.get("query.operation_name")).toBe("test-operation");
    });

    it("should parse Unix epoch seconds timestamp", () => {
      const searchParams: SearchTracesRequestDto = {
        start: "1704067200",
        end: "1704153600",
      };

      const params = JaegerParamsBuilder.build(searchParams);

      expect(params.get("query.start_time_min")).toBeDefined();
      expect(params.get("query.start_time_max")).toBeDefined();
    });

    it("should parse ISO 8601 timestamp", () => {
      const searchParams: SearchTracesRequestDto = {
        start: "2024-01-01T00:00:00Z",
        end: "2024-01-02T00:00:00Z",
      };

      const params = JaegerParamsBuilder.build(searchParams);

      expect(params.get("query.start_time_min")).toBeDefined();
      expect(params.get("query.start_time_max")).toBeDefined();
    });

    it("should throw error when start is missing", () => {
      const searchParams: SearchTracesRequestDto = {
        end: "2024-01-02T00:00:00Z",
      };

      expect(() => JaegerParamsBuilder.build(searchParams)).toThrow(
        "start and end parameters are required for Jaeger trace search",
      );
    });

    it("should throw error when end is missing", () => {
      const searchParams: SearchTracesRequestDto = {
        start: "2024-01-01T00:00:00Z",
      };

      expect(() => JaegerParamsBuilder.build(searchParams)).toThrow(
        "start and end parameters are required for Jaeger trace search",
      );
    });

    it("should throw error for invalid timestamp format", () => {
      const searchParams: SearchTracesRequestDto = {
        start: "invalid-timestamp",
        end: "2024-01-02T00:00:00Z",
      };

      expect(() => JaegerParamsBuilder.build(searchParams)).toThrow(
        "Invalid timestamp format",
      );
    });

    it("should build params with all optional fields", () => {
      const searchParams: SearchTracesRequestDto = {
        start: "2024-01-01T00:00:00Z",
        end: "2024-01-02T00:00:00Z",
        limit: 5,
        minDuration: 1000000,
        maxDuration: 10000000,
        serviceName: "test-service",
        operationName: "test-operation",
      };

      const params = JaegerParamsBuilder.build(searchParams);

      expect(params.get("query.start_time_min")).toBeDefined();
      expect(params.get("query.start_time_max")).toBeDefined();

      expect(params.get("query.num_traces")).toBe("10");
      expect(params.get("query.duration_min")).toBe("1000000ns");
      expect(params.get("query.duration_max")).toBe("10000000ns");
      expect(params.get("query.service_name")).toBe("test-service");
      expect(params.get("query.operation_name")).toBe("test-operation");
    });
  });
});
