import type { IResourceSpans } from "@opentelemetry/otlp-transformer/build/src/trace/internal-types";

export interface JaegerTracesData {
  resource_spans?: IResourceSpans[];
  resourceSpans?: IResourceSpans[];
}

export interface JaegerApiResponse<T> {
  result?: T;
  error?: {
    message?: string;
    code?: number;
    httpCode?: number;
    details?: unknown;
  };
}
