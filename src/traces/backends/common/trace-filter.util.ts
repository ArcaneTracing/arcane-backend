import { Injectable, Logger } from "@nestjs/common";
import { ProjectTraceFilter } from "../trace-repository.interface";
import type {
  TempoTraceSummary,
  TempoTraceResponse,
} from "../tempo/tempo.types";

@Injectable()
export class TraceFilterUtil {
  private readonly logger = new Logger(TraceFilterUtil.name);
  private static readonly OTLP_VALUE_KEYS = [
    "stringValue",
    "intValue",
    "boolValue",
    "doubleValue",
  ] as const;

  private extractAttributeValue(value: unknown): string | null {
    if (value == null) return null;
    if (
      typeof value === "string" ||
      typeof value === "number" ||
      typeof value === "boolean"
    ) {
      return String(value);
    }
    if (typeof value === "object") {
      return this.extractFromOtlpObject(value as Record<string, unknown>);
    }
    return null;
  }

  private extractFromOtlpObject(obj: Record<string, unknown>): string | null {
    for (const key of TraceFilterUtil.OTLP_VALUE_KEYS) {
      const v = obj[key];
      if (v != null) return String(v);
    }
    return null;
  }

  private traceSummaryHasMatchingAttribute(
    trace: TempoTraceSummary,
    filter: ProjectTraceFilter,
  ): boolean {
    const spans = trace.spanSet?.spans;
    if (!spans?.length) return false;
    return spans.some((span) =>
      span.attributes?.some(
        (attr) =>
          attr.key === filter.attributeName &&
          this.extractAttributeValue(attr.value) === filter.attributeValue,
      ),
    );
  }

  filterTraceSummaries(
    traces: TempoTraceSummary[],
    projectTraceFilter: ProjectTraceFilter,
  ): TempoTraceSummary[] {
    const filtered = traces.filter((trace) =>
      this.traceSummaryHasMatchingAttribute(trace, projectTraceFilter),
    );

    if (traces.length > 0 && filtered.length === 0) {
      const firstTrace = traces[0];
      const spanCount = firstTrace.spanSet?.spans?.length ?? 0;

      const allAttributeKeys = new Set<string>();
      let foundAttributeInAnySpan: {
        key: string;
        value: string;
        spanIndex: number;
      } | null = null;

      if (firstTrace.spanSet?.spans) {
        firstTrace.spanSet.spans.forEach((span, spanIndex) => {
          if (span.attributes) {
            span.attributes.forEach((attr) => {
              allAttributeKeys.add(attr.key);
              if (
                attr.key === projectTraceFilter.attributeName &&
                !foundAttributeInAnySpan
              ) {
                foundAttributeInAnySpan = {
                  key: attr.key,
                  value: this.extractAttributeValue(attr.value),
                  spanIndex,
                };
              }
            });
          }
        });
      }

      this.logger.debug(
        "Trace filtered out - missing project filter attribute",
        {
          traceID: firstTrace.traceID,
          lookingFor: `${projectTraceFilter.attributeName}=${projectTraceFilter.attributeValue}`,
          spanCount,
          availableAttributeKeys: Array.from(allAttributeKeys).sort((a, b) =>
            a.localeCompare(b),
          ),
          foundAttribute: foundAttributeInAnySpan,
        },
      );
    }

    return filtered;
  }

  filterFullTrace(
    trace: {
      batches: Array<{
        resource?: { attributes?: Array<{ key: string; value: unknown }> };
        scopeSpans?: Array<{
          spans?: Array<{
            attributes?: Array<{ key: string; value: unknown }>;
          }>;
        }>;
      }>;
    },
    projectTraceFilter: ProjectTraceFilter,
  ): boolean {
    return (
      trace.batches?.some((batch) =>
        this.batchHasMatchingAttribute(batch, projectTraceFilter),
      ) ?? false
    );
  }

  private attributeMatchesFilter(
    attr: { key: string; value: unknown },
    filter: ProjectTraceFilter,
  ): boolean {
    return (
      attr.key === filter.attributeName &&
      this.extractAttributeValue(attr.value) === filter.attributeValue
    );
  }

  private resourceHasMatchingAttribute(
    resource:
      | { attributes?: Array<{ key: string; value: unknown }> }
      | undefined,
    filter: ProjectTraceFilter,
  ): boolean {
    return (
      resource?.attributes?.some((a) =>
        this.attributeMatchesFilter(a, filter),
      ) ?? false
    );
  }

  private spanHasMatchingAttribute(
    span: { attributes?: Array<{ key: string; value: unknown }> } | undefined,
    filter: ProjectTraceFilter,
  ): boolean {
    return (
      span?.attributes?.some((a) => this.attributeMatchesFilter(a, filter)) ??
      false
    );
  }

  private batchHasMatchingAttribute(
    batch: {
      resource?: { attributes?: Array<{ key: string; value: unknown }> };
      scopeSpans?: Array<{
        spans?: Array<{ attributes?: Array<{ key: string; value: unknown }> }>;
      }>;
    },
    filter: ProjectTraceFilter,
  ): boolean {
    if (this.resourceHasMatchingAttribute(batch.resource, filter)) return true;
    return (
      batch.scopeSpans?.some((scopeSpan) =>
        scopeSpan.spans?.some((span) =>
          this.spanHasMatchingAttribute(span, filter),
        ),
      ) ?? false
    );
  }

  filterFullTraces(
    traces: TempoTraceResponse[],
    projectTraceFilter: ProjectTraceFilter,
  ): TempoTraceResponse[] {
    return traces.filter((trace) =>
      this.filterFullTrace(trace, projectTraceFilter),
    );
  }
}
