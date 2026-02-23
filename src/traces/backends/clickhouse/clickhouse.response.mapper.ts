import { Logger } from "@nestjs/common";

export class ClickHouseResponseMapper {
  private static readonly logger = new Logger(ClickHouseResponseMapper.name);
  static toTempoSearchResponse(rows: Array<Record<string, any>>): {
    traces: Array<{
      traceID: string;
      rootServiceName: string;
      rootTraceName: string;
      startTimeUnixNano: string;
      durationMs: number;
    }>;
  } {
    const traces = rows.map((row: Record<string, any>) => {
      const timestampValue = row.Timestamp || row.MinTimestamp;
      if (timestampValue === undefined || timestampValue === null) {
        throw new Error("Invalid query result: missing timestamp");
      }

      let timestampSeconds: number;
      if (typeof timestampValue === "string") {
        const date = new Date(timestampValue);
        if (Number.isNaN(date.getTime())) {
          throw new TypeError(`Invalid timestamp value: ${timestampValue}`);
        }
        timestampSeconds = Math.floor(date.getTime() / 1000);
      } else if (typeof timestampValue === "number") {
        timestampSeconds = timestampValue;
      } else {
        throw new TypeError(
          `Invalid timestamp type: ${typeof timestampValue}, value: ${timestampValue}`,
        );
      }

      const timestampNanos = BigInt(timestampSeconds) * BigInt(1000000000);
      const durationNanos = BigInt(row.Duration || 0);
      const durationMs = Number(durationNanos) / 1000000;

      return {
        traceID: String(row.TraceId),
        rootServiceName: row.ServiceName || "",
        rootTraceName: row.SpanName || "",
        startTimeUnixNano: timestampNanos.toString(),
        durationMs: durationMs,
      };
    });

    return {
      traces: traces,
    };
  }

  static toTempoTraceResponse(
    rows: Array<Record<string, any>>,
    traceId: string,
  ): any {
    if (rows.length === 0) {
      throw new Error(`Trace not found: ${traceId}`);
    }

    const spans = [];
    for (const row of rows) {
      try {
        const span = this.transformSpanToTempoFormat(row);
        spans.push(span);
      } catch (err) {
        this.logger.debug("Skipping invalid span during transform", {
          rowKeys: Object.keys(row),
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    if (spans.length === 0) {
      throw new Error(
        `Trace found but no valid spans could be transformed: ${traceId}`,
      );
    }

    const firstRow = rows[0];

    return {
      traceID: traceId,
      batches: [
        {
          resource: {
            attributes: this.mapAttributes(firstRow.ResourceAttributes || {}),
          },
          scopeSpans: [
            {
              scope: {
                name: firstRow.ScopeName || "",
                version: firstRow.ScopeVersion || "",
              },
              spans: spans,
            },
          ],
        },
      ],
    };
  }

  static transformSpanToTempoFormat(row: Record<string, any>): any {
    const timestampSeconds = this.parseTimestamp(row.Timestamp);
    const startTimeNanos = BigInt(timestampSeconds) * BigInt(1000000000);
    const durationNanos = BigInt(row.Duration || 0);
    const endTimeNanos = startTimeNanos + durationNanos;

    return {
      traceId: String(row.TraceId),
      spanId: String(row.SpanId),
      parentSpanId: row.ParentSpanId ? String(row.ParentSpanId) : null,
      name: String(row.SpanName || ""),
      kind: this.mapSpanKind(row.SpanKind),
      startTimeUnixNano: startTimeNanos.toString(),
      endTimeUnixNano: endTimeNanos.toString(),
      attributes: this.mapAttributes(row.SpanAttributes || {}),
      status: {
        code: this.mapStatusCode(row.StatusCode),
        message: row.StatusMessage || "",
      },
      events: this.mapEvents(row),
      links: this.mapLinks(row),
    };
  }

  static parseTimestamp(timestampValue: any): number {
    if (timestampValue === undefined || timestampValue === null) {
      throw new Error("Missing timestamp value");
    }

    if (typeof timestampValue === "string") {
      const date = new Date(timestampValue);
      if (Number.isNaN(date.getTime())) {
        throw new TypeError(
          `Invalid timestamp string format: ${timestampValue}`,
        );
      }
      return Math.floor(date.getTime() / 1000);
    } else if (typeof timestampValue === "number") {
      return timestampValue;
    } else {
      throw new TypeError(
        `Invalid timestamp type: ${typeof timestampValue}, value: ${timestampValue}`,
      );
    }
  }

  static mapSpanKind(kind: string): number {
    const kindMap: Record<string, number> = {
      SPAN_KIND_UNSPECIFIED: 0,
      SPAN_KIND_INTERNAL: 1,
      SPAN_KIND_SERVER: 2,
      SPAN_KIND_CLIENT: 3,
      SPAN_KIND_PRODUCER: 4,
      SPAN_KIND_CONSUMER: 5,
    };
    return kindMap[kind] || 0;
  }

  static mapStatusCode(code: string): number {
    const codeMap: Record<string, number> = {
      STATUS_CODE_UNSET: 0,
      STATUS_CODE_OK: 1,
      STATUS_CODE_ERROR: 2,
    };
    return codeMap[code] || 0;
  }

  static mapAttributes(
    attributes: Record<string, any> | Map<string, string>,
  ): Array<{ key: string; value: { stringValue: string } }> {
    if (!attributes) {
      return [];
    }

    const attrs: Array<{ key: string; value: { stringValue: string } }> = [];

    if (attributes instanceof Map) {
      attributes.forEach((value, key) => {
        attrs.push({
          key,
          value: { stringValue: String(value) },
        });
      });
    } else if (typeof attributes === "object") {
      Object.entries(attributes).forEach(([key, value]) => {
        attrs.push({
          key,
          value: { stringValue: String(value) },
        });
      });
    }

    return attrs;
  }

  static mapEvents(row: Record<string, any>): Array<any> {
    const events: Array<any> = [];

    const timestamps = row["Events.Timestamp"] || [];
    const names = row["Events.Name"] || [];
    const attributes = row["Events.Attributes"] || [];

    for (let i = 0; i < timestamps.length; i++) {
      try {
        const timestampSeconds = this.parseTimestamp(timestamps[i]);
        const timestampNanos = BigInt(timestampSeconds) * BigInt(1000000000);

        events.push({
          timeUnixNano: timestampNanos.toString(),
          name: String(names[i] || ""),
          attributes: this.mapAttributes(attributes[i] || {}),
        });
      } catch {
        continue;
      }
    }

    return events;
  }

  static mapLinks(row: Record<string, any>): Array<any> {
    const links: Array<any> = [];

    const traceIds = row["Links.TraceId"] || [];
    const spanIds = row["Links.SpanId"] || [];
    const traceStates = row["Links.TraceState"] || [];
    const attributes = row["Links.Attributes"] || [];

    for (let i = 0; i < traceIds.length; i++) {
      links.push({
        traceId: traceIds[i],
        spanId: spanIds[i],
        traceState: traceStates[i] || "",
        attributes: this.mapAttributes(attributes[i] || {}),
      });
    }

    return links;
  }
}
