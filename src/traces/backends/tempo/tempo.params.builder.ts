import { SearchTracesRequestDto } from "../../dto/request/search-traces-request.dto";

export class TempoParamsBuilder {
  private static encodeQueryWithPreservedQuotes(query: string): string {
    const normalizedQuery = query.replaceAll(String.raw`\"`, '"');

    return normalizedQuery
      .split("")
      .map((char) => {
        if (char === '"') {
          return char;
        }

        return encodeURIComponent(char);
      })
      .join("");
  }

  static build(searchParams: SearchTracesRequestDto): {
    toString: () => string;
    entries: () => IterableIterator<[string, string]>;
  } {
    const params = new URLSearchParams();
    let customQParam: string | null = null;
    const originalQValue: string | null =
      searchParams.q !== undefined &&
      searchParams.q !== null &&
      searchParams.q !== ""
        ? searchParams.q
        : null;
    if (originalQValue !== null) {
      customQParam = this.encodeQueryWithPreservedQuotes(originalQValue);
    }
    if (!searchParams.start || !searchParams.end) {
      throw new Error(
        "start and end parameters are required for Tempo trace search",
      );
    }

    const start = Math.round(new Date(searchParams.start).getTime() / 1000);
    const end = Math.round(new Date(searchParams.end).getTime() / 1000);
    params.append("start", start.toString());
    params.append("end", end.toString());

    const limit = searchParams.limit || 20;
    params.append("limit", limit.toString());
    if (searchParams.minDuration !== undefined) {
      params.append(
        "minDuration",
        this.formatDuration(searchParams.minDuration),
      );
    }
    if (searchParams.maxDuration !== undefined) {
      params.append(
        "maxDuration",
        this.formatDuration(searchParams.maxDuration),
      );
    }

    if (
      searchParams.attributes !== undefined &&
      searchParams.attributes !== null &&
      searchParams.attributes !== ""
    ) {
      params.append("tags", searchParams.attributes);
    }

    return {
      toString: () => {
        const parts: string[] = [];

        if (customQParam !== null) {
          parts.push("q=" + customQParam);
        }

        params.forEach((value, key) => {
          if (key !== "q") {
            parts.push(key + "=" + value);
          }
        });

        return parts.join("&");
      },
      entries: () => {
        const allEntries: [string, string][] = [];
        if (originalQValue !== null) {
          allEntries.push(["q", originalQValue]);
        }
        params.forEach((value, key) => {
          if (key !== "q") {
            allEntries.push([key, value]);
          }
        });
        return allEntries[Symbol.iterator]();
      },
    };
  }
  private static formatDuration(nanoseconds: number): string {
    if (!Number.isFinite(nanoseconds) || nanoseconds < 0) {
      throw new Error("Duration must be a positive number");
    }
    const hours = nanoseconds / (1_000_000_000 * 60 * 60);
    const minutes = nanoseconds / (1_000_000_000 * 60);
    const seconds = nanoseconds / 1_000_000_000;
    const milliseconds = nanoseconds / 1_000_000;
    const microseconds = nanoseconds / 1_000;

    if (hours >= 1) {
      return `${Math.floor(hours)}h`;
    } else if (minutes >= 1) {
      return `${Math.floor(minutes)}m`;
    } else if (seconds >= 1) {
      return `${Math.floor(seconds)}s`;
    } else if (milliseconds >= 1) {
      return `${Math.floor(milliseconds)}ms`;
    } else if (microseconds >= 1) {
      return `${Math.floor(microseconds)}us`;
    } else {
      return `${nanoseconds}ns`;
    }
  }
}
