import type {
  Fixed64,
  IAnyValue,
  IKeyValue,
} from "@opentelemetry/otlp-transformer/build/src/common/internal-types";
import type {
  IResourceSpans,
  ISpan,
} from "@opentelemetry/otlp-transformer/build/src/trace/internal-types";
import { JaegerTracesData } from "./jaeger.types";
import type {
  TempoTraceSearchResponse,
  TempoTraceSummary,
  TempoSpanSetSpan,
} from "../tempo/tempo.types";

export class JaegerResponseMapper {
  static toTempoSearchResponse(
    data?: JaegerTracesData,
  ): TempoTraceSearchResponse {
    const resourceSpans = data?.resourceSpans ?? data?.resource_spans;
    if (!resourceSpans) {
      return { traces: [] };
    }

    const tracesMap = new Map<
      string,
      TempoTraceSummary & { _start?: bigint; _end?: bigint }
    >();

    resourceSpans.forEach((resourceSpan) => {
      const resourceTags = this.keyValuesToRecord(
        resourceSpan.resource?.attributes,
      );
      const serviceName = resourceTags["service.name"] as string | undefined;

      if (serviceName && serviceName.toLowerCase() === "jaeger") {
        return;
      }

      const scopeSpans =
        resourceSpan.scopeSpans ??
        ((resourceSpan as unknown as Record<string, unknown>).scope_spans as
          | IResourceSpans["scopeSpans"]
          | undefined) ??
        [];
      scopeSpans.forEach((scopeSpan) => {
        (scopeSpan.spans ?? []).forEach((span) => {
          const spanRecord = span as ISpan & Record<string, unknown>;

          const traceID = this.getTraceId(
            span.traceId ?? (spanRecord.trace_id as string | undefined),
          );
          if (!traceID) {
            return;
          }

          const existing = tracesMap.get(traceID);

          const start = this.toBigInt(
            span.startTimeUnixNano ??
              (spanRecord.start_time_unix_nano as string | undefined),
          );
          const end = this.toBigInt(
            span.endTimeUnixNano ??
              (spanRecord.end_time_unix_nano as string | undefined),
          );

          const spanAttributes: TempoSpanSetSpan["attributes"] = span.attributes
            ? this.normalizeAttributes(span.attributes)
            : undefined;

          const allAttributes: TempoSpanSetSpan["attributes"] = [
            ...(resourceSpan.resource?.attributes
              ? this.normalizeAttributes(resourceSpan.resource.attributes)
              : []),
            ...(spanAttributes || []),
          ];

          const spanData = {
            spanID: this.getTraceId(
              span.spanId ?? (spanRecord.span_id as string | undefined),
            ),
            startTimeUnixNano: start?.toString(),
            durationNanos: start && end ? (end - start).toString() : undefined,
            attributes: allAttributes,
            serviceName: resourceTags["service.name"] as string | undefined,
            name: span.name,
          };

          if (!existing) {
            tracesMap.set(traceID, {
              traceID,
              rootServiceName: resourceTags["service.name"] as
                | string
                | undefined,
              rootTraceName: span.name,
              startTimeUnixNano: start?.toString(),
              durationMs: this.toDurationMs(start, end),
              spanSet: {
                spans: [spanData],
              },
              _start: start,
              _end: end,
            });
            return;
          }

          if (!existing.spanSet) {
            existing.spanSet = { spans: [] };
          }
          if (!existing.spanSet.spans) {
            existing.spanSet.spans = [];
          }
          existing.spanSet.spans.push(spanData);

          if (
            !existing.rootTraceName &&
            span.parentSpanId === undefined &&
            (spanRecord.parent_span_id as string | undefined) === undefined
          ) {
            existing.rootTraceName = span.name;
          }

          existing._start = this.minBigInt(existing._start, start);
          existing._end = this.maxBigInt(existing._end, end);
          existing.startTimeUnixNano =
            existing._start?.toString() ?? existing.startTimeUnixNano;
          existing.durationMs = this.toDurationMs(
            existing._start,
            existing._end,
          );
        });
      });
    });

    const traces: TempoTraceSummary[] = Array.from(tracesMap.values())
      .map(({ _start, _end, ...summary }) => summary)
      .filter((trace) => {
        const serviceName = trace.rootServiceName?.toLowerCase();
        return serviceName !== "jaeger";
      });
    return { traces };
  }

  static toTempoTraceResponse(data?: JaegerTracesData, traceId?: string) {
    const resourceSpans = data?.resourceSpans ?? data?.resource_spans ?? [];

    const filteredResourceSpans = resourceSpans.filter((resourceSpan) => {
      const resourceTags = this.keyValuesToRecord(
        resourceSpan.resource?.attributes,
      );
      const serviceName = resourceTags["service.name"] as string | undefined;
      return !serviceName || serviceName.toLowerCase() !== "jaeger";
    });

    return {
      traceID: traceId ?? "",
      batches: filteredResourceSpans.map((resourceSpan) =>
        this.normalizeResourceSpan(resourceSpan),
      ),
    };
  }

  private static normalizeResourceSpan(resourceSpan: IResourceSpans) {
    const scopeSpans =
      resourceSpan.scopeSpans ??
      (resourceSpan as unknown as Record<string, unknown>).scope_spans ??
      [];
    return {
      resource: {
        attributes: this.normalizeAttributes(resourceSpan.resource?.attributes),
      },
      scopeSpans: (scopeSpans as IResourceSpans["scopeSpans"]).map(
        (scopeSpan) => ({
          scope: scopeSpan.scope,
          spans: (scopeSpan.spans ?? []).map((span) => {
            const spanRecord = span as ISpan & Record<string, unknown>;
            return {
              ...span,

              trace_id: this.getTraceId(
                span.traceId ?? (spanRecord.trace_id as string | undefined),
              ),
              span_id: this.getTraceId(
                span.spanId ?? (spanRecord.span_id as string | undefined),
              ),
              parent_span_id: this.getTraceId(
                span.parentSpanId ??
                  (spanRecord.parent_span_id as string | undefined),
              ),
              attributes: this.normalizeAttributes(span.attributes),
            };
          }),
        }),
      ),
    };
  }

  private static normalizeAttributes(attributes?: IKeyValue[]) {
    return (attributes ?? []).map((attribute) => ({
      key: attribute.key,
      value: this.deserializeAnyValue(attribute.value),
    }));
  }

  private static keyValuesToRecord(
    attributes?: IKeyValue[],
  ): Record<string, unknown> {
    return (attributes ?? []).reduce<Record<string, unknown>>(
      (acc, attribute) => {
        acc[attribute.key] = this.deserializeAnyValue(attribute.value);
        return acc;
      },
      {},
    );
  }

  private static deserializeAnyValue(value?: IAnyValue): unknown {
    if (!value) {
      return undefined;
    }
    const valueRecord = value as IAnyValue & Record<string, unknown>;
    if (
      value.stringValue !== undefined ||
      valueRecord.string_value !== undefined
    ) {
      return (
        value.stringValue ?? (valueRecord.string_value as string | undefined)
      );
    }
    if (value.boolValue !== undefined || valueRecord.bool_value !== undefined) {
      return value.boolValue ?? (valueRecord.bool_value as boolean | undefined);
    }
    if (
      value.doubleValue !== undefined ||
      valueRecord.double_value !== undefined
    ) {
      return (
        value.doubleValue ?? (valueRecord.double_value as number | undefined)
      );
    }
    if (value.intValue !== undefined || valueRecord.int_value !== undefined) {
      const raw =
        value.intValue ?? (valueRecord.int_value as number | undefined);
      return raw === undefined ? undefined : Number(raw);
    }
    if (
      value.bytesValue !== undefined ||
      valueRecord.bytes_value !== undefined
    ) {
      return (
        value.bytesValue ?? (valueRecord.bytes_value as Uint8Array | undefined)
      );
    }
    const arrayValues =
      value.arrayValue?.values ??
      (valueRecord.array_value as { values?: IAnyValue[] } | undefined)
        ?.values ??
      undefined;
    if (arrayValues) {
      return arrayValues.map((inner) => this.deserializeAnyValue(inner));
    }
    const kvlistValues =
      value.kvlistValue?.values ??
      (valueRecord.kvlist_value as { values?: IKeyValue[] } | undefined)
        ?.values ??
      undefined;
    if (kvlistValues) {
      return this.keyValuesToRecord(kvlistValues);
    }
    return undefined;
  }

  private static getTraceId(value?: string | Uint8Array): string | undefined {
    if (!value) {
      return undefined;
    }
    if (typeof value === "string") {
      return value.trim();
    }
    return Buffer.from(value).toString("hex");
  }

  private static toBigInt(value?: Fixed64): bigint | undefined {
    if (!value) {
      return undefined;
    }
    if (typeof value === "string") {
      try {
        return BigInt(value);
      } catch {
        return undefined;
      }
    }
    if (typeof value === "number") {
      return BigInt(Math.trunc(value));
    }
    const low = value.low >>> 0;
    const high = value.high >>> 0;
    return (BigInt(high) << 32n) | BigInt(low);
  }

  private static toDurationMs(
    start?: bigint,
    end?: bigint,
  ): number | undefined {
    if (start === undefined || end === undefined) {
      return undefined;
    }
    const diff = end - start;
    return Number(diff) / 1_000_000;
  }

  private static minBigInt(
    current?: bigint,
    next?: bigint,
  ): bigint | undefined {
    if (current === undefined) {
      return next;
    }
    if (next === undefined) {
      return current;
    }
    return current < next ? current : next;
  }

  private static maxBigInt(
    current?: bigint,
    next?: bigint,
  ): bigint | undefined {
    if (current === undefined) {
      return next;
    }
    if (next === undefined) {
      return current;
    }
    return current > next ? current : next;
  }
}
