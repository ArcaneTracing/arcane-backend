import { SearchTracesRequestDto } from "../../dto/request/search-traces-request.dto";
import type { TimeRangeDto } from "../../dto/time-range.dto";

export class JaegerParamsBuilder {
  private static readonly MAX_SEARCH_DEPTH = 10;

  static build(searchParams: SearchTracesRequestDto): URLSearchParams {
    const params = new URLSearchParams();
    const { start, end } = this.resolveTimeRange(searchParams);

    params.append("query.start_time_min", start);
    params.append("query.start_time_max", end);
    if (typeof searchParams.limit === "number" && searchParams.limit > 0) {
      const numTraces = Math.min(
        Math.max(10, Math.floor(searchParams.limit)),
        this.MAX_SEARCH_DEPTH,
      );
      params.append("query.num_traces", numTraces.toString());
    }

    if (typeof searchParams.minDuration === "number") {
      params.append(
        "query.duration_min",
        this.formatDuration(searchParams.minDuration),
      );
    }

    if (typeof searchParams.maxDuration === "number") {
      params.append(
        "query.duration_max",
        this.formatDuration(searchParams.maxDuration),
      );
    }
    if (searchParams.serviceName) {
      params.append("query.service_name", searchParams.serviceName);
    }

    if (searchParams.operationName) {
      params.append("query.operation_name", searchParams.operationName);
    }

    return params;
  }

  private static resolveTimeRange(
    searchParams: SearchTracesRequestDto,
  ): TimeRangeDto {
    if (!searchParams.start || !searchParams.end) {
      throw new Error(
        "start and end parameters are required for Jaeger trace search",
      );
    }
    const startSeconds = this.parseTimestamp(searchParams.start);
    const endSeconds = this.parseTimestamp(searchParams.end);

    return {
      start: this.toRfc3339Nano(startSeconds),
      end: this.toRfc3339Nano(endSeconds),
    };
  }

  private static parseTimestamp(timestamp: string): number {
    const numericValue = Number(timestamp);
    if (Number.isFinite(numericValue) && !Number.isNaN(numericValue)) {
      return numericValue;
    }

    const dateValue = new Date(timestamp);
    if (!Number.isNaN(dateValue.getTime())) {
      return Math.floor(dateValue.getTime() / 1000);
    }

    throw new TypeError(
      `Invalid timestamp format: ${timestamp}. Expected Unix epoch seconds (as string) or ISO 8601 date string.`,
    );
  }

  private static toRfc3339Nano(seconds: number): string {
    if (!Number.isFinite(seconds)) {
      throw new TypeError("Invalid timestamp provided for Jaeger time range");
    }

    const date = new Date(seconds * 1000);
    const iso = date.toISOString();
    const [base, fractionWithZone = "000Z"] = iso.split(".");
    const fraction = fractionWithZone.replace("Z", "");
    const paddedFraction = (fraction + "000000000").substring(0, 9);
    return `${base}.${paddedFraction}Z`;
  }

  private static formatDuration(duration: number): string {
    if (!Number.isFinite(duration) || duration < 0) {
      throw new Error("Duration must be a positive number");
    }

    return `${duration}ns`;
  }
}
