import { SearchTracesRequestDto } from "../../dto/request/search-traces-request.dto";
import type { TimeRangeDto } from "../../dto/time-range.dto";
import type {
  TempoTraceResponse,
  TempoTraceSearchResponse,
} from "../tempo/tempo.types";
import {
  CustomApiConfigDto,
  CustomApiAuthenticationType,
} from "src/datasources/dto/custom-api-config.dto";

export class CustomApiRequestBuilder {
  static buildUrl(baseUrl: string, path: string): string {
    const normalizedBaseUrl = baseUrl.replace(/\/$/, "");
    const normalizedPath = path.startsWith("/") ? path : `/${path}`;
    return `${normalizedBaseUrl}${normalizedPath}`;
  }

  static buildHeaders(config: CustomApiConfigDto): Record<string, string> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...config.headers,
    };

    if (config.authentication) {
      const auth = config.authentication;
      if (auth.type === CustomApiAuthenticationType.BEARER && auth.value) {
        headers["Authorization"] = `Bearer ${auth.value}`;
      } else if (
        auth.type === CustomApiAuthenticationType.HEADER &&
        auth.headerName &&
        auth.value
      ) {
        headers[auth.headerName] = auth.value;
      } else if (
        auth.type === CustomApiAuthenticationType.BASIC &&
        auth.username &&
        auth.password
      ) {
        const credentials = Buffer.from(
          `${auth.username}:${auth.password}`,
        ).toString("base64");
        headers["Authorization"] = `Basic ${credentials}`;
      }
    }

    return headers;
  }

  static buildSearchParams(
    searchParams: SearchTracesRequestDto,
    config: CustomApiConfigDto,
  ): Record<string, string | number> {
    const params: Record<string, string | number> = {};

    if (searchParams.start) {
      params.start = Math.round(new Date(searchParams.start).getTime() / 1000);
    }

    if (searchParams.end) {
      params.end = Math.round(new Date(searchParams.end).getTime() / 1000);
    }

    if (searchParams.limit !== undefined) {
      params.limit = searchParams.limit;
    }

    if (config.capabilities?.searchByQuery && searchParams.q) {
      params.q = searchParams.q;
    }

    if (config.capabilities?.searchByAttributes && searchParams.attributes) {
      params.attributes = searchParams.attributes;
    }

    if (
      config.capabilities?.filterByAttributeExists &&
      searchParams.filterByAttributeExists &&
      searchParams.filterByAttributeExists.length > 0
    ) {
      params.filterByAttributeExists =
        searchParams.filterByAttributeExists.join(",");
    }

    if (searchParams.minDuration !== undefined) {
      params.minDuration = searchParams.minDuration;
    }

    if (searchParams.maxDuration !== undefined) {
      params.maxDuration = searchParams.maxDuration;
    }

    if (searchParams.serviceName) {
      params.serviceName = searchParams.serviceName;
    }

    if (searchParams.operationName) {
      params.operationName = searchParams.operationName;
    }

    return params;
  }

  static buildSearchByTraceIdParams(
    timeRange?: TimeRangeDto,
  ): Record<string, string> {
    const params: Record<string, string> = {};
    if (timeRange) {
      params.start = timeRange.start;
      params.end = timeRange.end;
    }
    return params;
  }

  static parseSearchResponse(data: unknown): TempoTraceSearchResponse {
    if (
      data &&
      typeof data === "object" &&
      "traces" in data &&
      Array.isArray((data as any).traces)
    ) {
      return data as TempoTraceSearchResponse;
    }
    if (Array.isArray(data)) {
      return { traces: data } as TempoTraceSearchResponse;
    }
    throw new Error(
      "Invalid response format: expected { traces: [...] } or traces array",
    );
  }

  static parseTraceResponse(data: unknown): TempoTraceResponse {
    if (!data || typeof data !== "object") {
      throw new Error("Invalid response format: expected an object");
    }
    const traceData = data as TempoTraceResponse;
    return traceData;
  }

  static parseAttributeNamesResponse(data: unknown): string[] {
    if (Array.isArray(data)) {
      return data.filter((item): item is string => typeof item === "string");
    }
    if (data && typeof data === "object" && "attributeNames" in data) {
      const attributeNames = (data as { attributeNames: unknown })
        .attributeNames;
      if (Array.isArray(attributeNames)) {
        return attributeNames.filter(
          (item): item is string => typeof item === "string",
        );
      }
    }
    throw new Error(
      "Invalid response format: expected array of strings or { attributeNames: string[] }",
    );
  }

  static parseAttributeValuesResponse(data: unknown): string[] {
    if (Array.isArray(data)) {
      return data.filter((item): item is string => typeof item === "string");
    }
    if (data && typeof data === "object" && "values" in data) {
      const values = (data as { values: unknown }).values;
      if (Array.isArray(values)) {
        return values.filter(
          (item): item is string => typeof item === "string",
        );
      }
    }
    throw new Error(
      "Invalid response format: expected array of strings or { values: string[] }",
    );
  }
}
