import { TempoParamsBuilder } from "../../../../src/traces/backends/tempo/tempo.params.builder";
import { SearchTracesRequestDto } from "../../../../src/traces/dto/request/search-traces-request.dto";

describe("TempoParamsBuilder", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("build", () => {
    it("should throw error when start is missing", () => {
      const searchParams: SearchTracesRequestDto = {
        end: "2024-01-02T00:00:00Z",
      };

      expect(() => TempoParamsBuilder.build(searchParams)).toThrow(
        "start and end parameters are required for Tempo trace search",
      );
    });

    it("should throw error when end is missing", () => {
      const searchParams: SearchTracesRequestDto = {
        start: "2024-01-01T00:00:00Z",
      };

      expect(() => TempoParamsBuilder.build(searchParams)).toThrow(
        "start and end parameters are required for Tempo trace search",
      );
    });

    it("should format duration in hours when >= 1 hour", () => {
      const searchParams: SearchTracesRequestDto = {
        start: "2024-01-01T00:00:00Z",
        end: "2024-01-02T00:00:00Z",
        minDuration: 3600000000000,
      };

      const params = TempoParamsBuilder.build(searchParams);
      const queryString = params.toString();
      expect(queryString).toContain("minDuration=1h");
    });

    it("should format duration in minutes when >= 1 minute", () => {
      const searchParams: SearchTracesRequestDto = {
        start: "2024-01-01T00:00:00Z",
        end: "2024-01-02T00:00:00Z",
        minDuration: 60000000000,
      };

      const params = TempoParamsBuilder.build(searchParams);
      const queryString = params.toString();
      expect(queryString).toContain("minDuration=1m");
    });

    it("should format duration in seconds when >= 1 second", () => {
      const searchParams: SearchTracesRequestDto = {
        start: "2024-01-01T00:00:00Z",
        end: "2024-01-02T00:00:00Z",
        minDuration: 1000000000,
      };

      const params = TempoParamsBuilder.build(searchParams);
      const queryString = params.toString();
      expect(queryString).toContain("minDuration=1s");
    });

    it("should format duration in milliseconds when >= 1 millisecond", () => {
      const searchParams: SearchTracesRequestDto = {
        start: "2024-01-01T00:00:00Z",
        end: "2024-01-02T00:00:00Z",
        minDuration: 1000000,
      };

      const params = TempoParamsBuilder.build(searchParams);
      const queryString = params.toString();
      expect(queryString).toContain("minDuration=1ms");
    });

    it("should format duration in microseconds when >= 1 microsecond", () => {
      const searchParams: SearchTracesRequestDto = {
        start: "2024-01-01T00:00:00Z",
        end: "2024-01-02T00:00:00Z",
        minDuration: 1000,
      };

      const params = TempoParamsBuilder.build(searchParams);
      const queryString = params.toString();
      expect(queryString).toContain("minDuration=1us");
    });

    it("should format duration in nanoseconds when < 1 microsecond", () => {
      const searchParams: SearchTracesRequestDto = {
        start: "2024-01-01T00:00:00Z",
        end: "2024-01-02T00:00:00Z",
        minDuration: 100,
      };

      const params = TempoParamsBuilder.build(searchParams);
      const queryString = params.toString();
      expect(queryString).toContain("minDuration=100ns");
    });

    it("should throw error for negative duration", () => {
      const searchParams: SearchTracesRequestDto = {
        start: "2024-01-01T00:00:00Z",
        end: "2024-01-02T00:00:00Z",
        minDuration: -1000,
      };

      expect(() => TempoParamsBuilder.build(searchParams)).toThrow(
        "Duration must be a positive number",
      );
    });

    it("should throw error for non-finite duration", () => {
      const searchParams: SearchTracesRequestDto = {
        start: "2024-01-01T00:00:00Z",
        end: "2024-01-02T00:00:00Z",
        minDuration: Infinity,
      };

      expect(() => TempoParamsBuilder.build(searchParams)).toThrow(
        "Duration must be a positive number",
      );
    });

    it("should handle fractional hours", () => {
      const searchParams: SearchTracesRequestDto = {
        start: "2024-01-01T00:00:00Z",
        end: "2024-01-02T00:00:00Z",
        minDuration: 7200000000000,
      };

      const params = TempoParamsBuilder.build(searchParams);
      const queryString = params.toString();
      expect(queryString).toContain("minDuration=2h");
    });

    it("should handle fractional minutes", () => {
      const searchParams: SearchTracesRequestDto = {
        start: "2024-01-01T00:00:00Z",
        end: "2024-01-02T00:00:00Z",
        minDuration: 120000000000,
      };

      const params = TempoParamsBuilder.build(searchParams);
      const queryString = params.toString();
      expect(queryString).toContain("minDuration=2m");
    });
  });
});
