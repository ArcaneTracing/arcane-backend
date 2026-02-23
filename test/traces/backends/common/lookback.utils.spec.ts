import {
  parseLookback,
  getTimeRange,
} from "../../../../src/traces/backends/common/lookback.utils";
import { Lookback } from "../../../../src/traces/dto/lookback";

describe("lookback.utils", () => {
  describe("parseLookback", () => {
    it("should parse MINUTE to 60 seconds in milliseconds", () => {
      const result = parseLookback(Lookback.MINUTE);
      expect(result).toBe(60 * 1000);
    });

    it("should parse FIVE_MINUTES to 5 minutes in milliseconds", () => {
      const result = parseLookback(Lookback.FIVE_MINUTES);
      expect(result).toBe(5 * 60 * 1000);
    });

    it("should parse TEN_MINUTES to 10 minutes in milliseconds", () => {
      const result = parseLookback(Lookback.TEN_MINUTES);
      expect(result).toBe(10 * 60 * 1000);
    });

    it("should parse THIRTY_MINUTES to 30 minutes in milliseconds", () => {
      const result = parseLookback(Lookback.THIRTY_MINUTES);
      expect(result).toBe(30 * 60 * 1000);
    });

    it("should parse HOUR to 1 hour in milliseconds", () => {
      const result = parseLookback(Lookback.HOUR);
      expect(result).toBe(60 * 60 * 1000);
    });

    it("should parse THREE_HOURS to 3 hours in milliseconds", () => {
      const result = parseLookback(Lookback.THREE_HOURS);
      expect(result).toBe(3 * 60 * 60 * 1000);
    });

    it("should parse SIX_HOURS to 6 hours in milliseconds", () => {
      const result = parseLookback(Lookback.SIX_HOURS);
      expect(result).toBe(6 * 60 * 60 * 1000);
    });

    it("should parse TWELVE_HOURS to 12 hours in milliseconds", () => {
      const result = parseLookback(Lookback.TWELVE_HOURS);
      expect(result).toBe(12 * 60 * 60 * 1000);
    });

    it("should parse DAY to 24 hours in milliseconds", () => {
      const result = parseLookback(Lookback.DAY);
      expect(result).toBe(24 * 60 * 60 * 1000);
    });

    it("should parse WEEK to 7 days in milliseconds", () => {
      const result = parseLookback(Lookback.WEEK);
      expect(result).toBe(7 * 24 * 60 * 60 * 1000);
    });

    it("should parse MONTH to 30 days in milliseconds", () => {
      const result = parseLookback(Lookback.MONTH);
      expect(result).toBe(30 * 24 * 60 * 60 * 1000);
    });

    it("should parse YEAR to 365 days in milliseconds", () => {
      const result = parseLookback(Lookback.YEAR);
      expect(result).toBe(365 * 24 * 60 * 60 * 1000);
    });

    it("should throw error for invalid lookback", () => {
      const invalidLookback = "INVALID" as Lookback;
      expect(() => parseLookback(invalidLookback)).toThrow(
        "Invalid lookback format: INVALID. Expected format: <number><unit> (e.g., 30d, 1h, 2w)",
      );
    });
  });

  describe("getTimeRange", () => {
    beforeEach(() => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date("2024-01-01T12:00:00Z"));
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it("should return time range for MINUTE lookback", () => {
      const result = getTimeRange(Lookback.MINUTE);
      const expectedEnd = Math.floor(
        new Date("2024-01-01T12:00:00Z").getTime() / 1000,
      );
      const expectedStart = expectedEnd - 60;

      expect(result.end).toBe(expectedEnd);
      expect(result.start).toBe(expectedStart);
    });

    it("should return time range for HOUR lookback", () => {
      const result = getTimeRange(Lookback.HOUR);
      const expectedEnd = Math.floor(
        new Date("2024-01-01T12:00:00Z").getTime() / 1000,
      );
      const expectedStart = expectedEnd - 3600;

      expect(result.end).toBe(expectedEnd);
      expect(result.start).toBe(expectedStart);
    });

    it("should clamp lookback to maximum 168 hours (7 days)", () => {
      const result = getTimeRange(Lookback.MONTH);
      const expectedEnd = Math.floor(
        new Date("2024-01-01T12:00:00Z").getTime() / 1000,
      );
      const maxRangeSeconds = 168 * 60 * 60;
      const expectedStart = expectedEnd - maxRangeSeconds;

      expect(result.end).toBe(expectedEnd);
      expect(result.start).toBe(expectedStart);
    });

    it("should clamp YEAR lookback to maximum 168 hours", () => {
      const result = getTimeRange(Lookback.YEAR);
      const expectedEnd = Math.floor(
        new Date("2024-01-01T12:00:00Z").getTime() / 1000,
      );
      const maxRangeSeconds = 168 * 60 * 60;
      const expectedStart = expectedEnd - maxRangeSeconds;

      expect(result.end).toBe(expectedEnd);
      expect(result.start).toBe(expectedStart);
    });

    it("should not clamp lookback that is less than 168 hours", () => {
      const result = getTimeRange(Lookback.DAY);
      const expectedEnd = Math.floor(
        new Date("2024-01-01T12:00:00Z").getTime() / 1000,
      );
      const expectedStart = expectedEnd - 24 * 60 * 60;

      expect(result.end).toBe(expectedEnd);
      expect(result.start).toBe(expectedStart);
    });
  });
});
