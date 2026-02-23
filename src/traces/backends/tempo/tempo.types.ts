import type {
  IResourceSpans,
  IScopeSpans,
  ISpan,
} from "@opentelemetry/otlp-transformer/build/src/trace/internal-types";
import type { IKeyValue } from "@opentelemetry/otlp-transformer/build/src/common/internal-types";
export type TempoResourceSpans = IResourceSpans;
export type TempoScopeSpans = IScopeSpans;
export type TempoSpan = ISpan;
export type TempoSpanSetSpanAttribute = IKeyValue;

export interface TempoTraceResponse {
  batches: TempoResourceSpans[];
}

export interface TempoSpanSetSpan {
  spanID?: string;
  startTimeUnixNano?: string;
  durationNanos?: string;
  attributes?: TempoSpanSetSpanAttribute[];
  serviceName?: string;
  name?: string;
}

export interface TempoSpanSet {
  spans?: TempoSpanSetSpan[];
  matched?: number;
}

export interface TempoTraceSummary {
  traceID: string;
  rootServiceName?: string;
  rootTraceName?: string;
  startTimeUnixNano?: string;
  durationMs?: number;
  spanSet?: TempoSpanSet;
}

export interface TempoTraceSearchResponse {
  traces: TempoTraceSummary[];
}

export interface TempoMetrics {
  inspectedBytes?: string;
}

export interface TempoAttributeNamesResponse {
  tagNames: string[];
  metrics?: TempoMetrics;
}

export interface TempoAttributeValuesResponse {
  tagValues: string[];
  metrics?: TempoMetrics;
}
