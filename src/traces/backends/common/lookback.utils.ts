import { Lookback } from "src/traces/dto/lookback";

export function parseLookback(lookback: Lookback): number {
  switch (lookback) {
    case Lookback.MINUTE:
      return 60 * 1000;
    case Lookback.FIVE_MINUTES:
      return 5 * 60 * 1000;
    case Lookback.TEN_MINUTES:
      return 10 * 60 * 1000;
    case Lookback.THIRTY_MINUTES:
      return 30 * 60 * 1000;
    case Lookback.HOUR:
      return 60 * 60 * 1000;
    case Lookback.THREE_HOURS:
      return 3 * 60 * 60 * 1000;
    case Lookback.SIX_HOURS:
      return 6 * 60 * 60 * 1000;
    case Lookback.TWELVE_HOURS:
      return 12 * 60 * 60 * 1000;
    case Lookback.DAY:
      return 24 * 60 * 60 * 1000;
    case Lookback.WEEK:
      return 7 * 24 * 60 * 60 * 1000;
    case Lookback.MONTH:
      return 30 * 24 * 60 * 60 * 1000;
    case Lookback.YEAR:
      return 365 * 24 * 60 * 60 * 1000;
    default:
      throw new Error(
        `Invalid lookback format: ${lookback}. Expected format: <number><unit> (e.g., 30d, 1h, 2w)`,
      );
  }
}

export function getTimeRange(lookback: Lookback): {
  start: number;
  end: number;
} {
  const end = Math.floor(Date.now() / 1000);

  const lookbackSeconds = Math.floor(parseLookback(lookback) / 1000);

  const MAX_RANGE_SECONDS = 168 * 60 * 60;
  const clampedLookback = Math.min(lookbackSeconds, MAX_RANGE_SECONDS);

  const start = end - clampedLookback;
  return { start, end };
}
