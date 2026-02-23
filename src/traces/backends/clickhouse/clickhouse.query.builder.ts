import { SearchTracesRequestDto } from "../../dto/request/search-traces-request.dto";
import type { TimeRangeDto } from "../../dto/time-range.dto";
import { ClickHouseQueryParser } from "./clickhouse.query.parser";

export class ClickHouseQueryBuilder {
  public static escapeString(str: string): string {
    return str.replaceAll("'", "''");
  }
  public static escapeIdentifier(identifier: string): string {
    return "`" + identifier.replaceAll("`", "``") + "`";
  }
  private static sanitizeLimit(limit?: number): number {
    if (limit === undefined || limit === null) {
      return 20;
    }
    if (!Number.isFinite(limit) || limit < 1) {
      return 20;
    }
    const maxLimit = 10000;
    return Math.min(Math.floor(limit), maxLimit);
  }
  private static sanitizeDuration(duration?: number): number | undefined {
    if (duration === undefined || duration === null) {
      return undefined;
    }
    if (!Number.isFinite(duration) || duration < 0) {
      return undefined;
    }
    return Math.floor(duration);
  }

  static buildSearchQuery(
    searchParams: SearchTracesRequestDto,
    tableName: string,
  ): string {
    const conditions: string[] = [];

    const timeConditions = this.buildTimeRangeConditions(
      searchParams.start,
      searchParams.end,
    );
    conditions.push(...timeConditions);

    if (searchParams.serviceName) {
      conditions.push(
        `ServiceName = '${this.escapeString(searchParams.serviceName)}'`,
      );
    }

    if (searchParams.operationName) {
      conditions.push(
        `SpanName = '${this.escapeString(searchParams.operationName)}'`,
      );
    }

    const minDuration = this.sanitizeDuration(searchParams.minDuration);
    if (minDuration !== undefined) {
      conditions.push(`Duration >= ${minDuration}`);
    }
    const maxDuration = this.sanitizeDuration(searchParams.maxDuration);
    if (maxDuration !== undefined) {
      conditions.push(`Duration <= ${maxDuration}`);
    }

    if (searchParams.attributes) {
      const attributeConditions = this.parseAttributesToConditions(
        searchParams.attributes,
      );
      conditions.push(...attributeConditions);
    }

    if (searchParams.q) {
      const qCondition = ClickHouseQueryParser.parse(searchParams.q);
      if (qCondition) {
        conditions.push(qCondition);
      }
    }

    const whereClause =
      conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    const limit = this.sanitizeLimit(searchParams.limit);

    const escapedTableName = this.escapeIdentifier(tableName);
    const query = `
      WITH aggregated_traces AS (
        SELECT 
          TraceId,
          argMin(ServiceName, Timestamp) AS ServiceName,
          argMin(SpanName, Timestamp) AS SpanName,
          min(Timestamp) AS MinTimestamp,
          sum(Duration) AS Duration
        FROM ${escapedTableName}
        ${whereClause}
        GROUP BY TraceId
      )
      SELECT 
        TraceId,
        ServiceName,
        SpanName,
        MinTimestamp AS Timestamp,
        Duration
      FROM aggregated_traces
      ORDER BY MinTimestamp DESC
      LIMIT ${limit}
    `;

    return query.trim();
  }

  static buildTraceIdQuery(
    traceId: string,
    tableName: string,
    timeRange?: TimeRangeDto,
  ): string {
    const conditions: string[] = [];

    conditions.push(`TraceId = '${this.escapeString(traceId)}'`);

    if (timeRange) {
      const startDate = new Date(timeRange.start);
      const endDate = new Date(timeRange.end);

      if (
        Number.isNaN(startDate.getTime()) ||
        Number.isNaN(endDate.getTime())
      ) {
        throw new TypeError("Invalid date format in timeRange");
      }

      const startTimestamp = Math.floor(startDate.getTime() / 1000);
      const endTimestamp = Math.floor(endDate.getTime() / 1000);

      if (startTimestamp > endTimestamp) {
        throw new TypeError("Start date must be before end date");
      }

      conditions.push(
        `Timestamp >= ${startTimestamp}`,
        `Timestamp <= ${endTimestamp}`,
      );
    }

    const whereClause =
      conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    const escapedTableName = this.escapeIdentifier(tableName);

    const query = `
      SELECT *
      FROM ${escapedTableName}
      ${whereClause}
      ORDER BY Timestamp ASC
    `;

    return query.trim();
  }

  private static buildTimeRangeConditions(
    start?: string,
    end?: string,
  ): string[] {
    if (start && end) {
      const startDate = new Date(start);
      const endDate = new Date(end);
      if (
        Number.isNaN(startDate.getTime()) ||
        Number.isNaN(endDate.getTime())
      ) {
        throw new TypeError("Invalid date format in start or end parameters");
      }
      const startTimestamp = Math.floor(startDate.getTime() / 1000);
      const endTimestamp = Math.floor(endDate.getTime() / 1000);
      if (startTimestamp > endTimestamp) {
        throw new TypeError("Start date must be before end date");
      }
      return [`Timestamp >= ${startTimestamp}`, `Timestamp <= ${endTimestamp}`];
    }
    const endTimestamp = Math.floor(Date.now() / 1000);
    const startTimestamp = endTimestamp - 3600;
    return [`Timestamp >= ${startTimestamp}`, `Timestamp <= ${endTimestamp}`];
  }

  private static parseAttributesToConditions(attributes: string): string[] {
    const conditions: string[] = [];

    const pattern = /([^\s=]+)=(?:"([^"]{0,10000})"|(\S+))/g;
    let match;

    while ((match = pattern.exec(attributes)) !== null) {
      const key = match[1];
      const value = match[2] || match[3];

      if (!key || !value) {
        continue;
      }

      const escapedKey = this.escapeString(key);
      const escapedValue = this.escapeString(value);
      conditions.push(
        `((mapContains(SpanAttributes, '${escapedKey}') AND mapValues(SpanAttributes)[indexOf(mapKeys(SpanAttributes), '${escapedKey}')] = '${escapedValue}') OR ` +
          `(mapContains(ResourceAttributes, '${escapedKey}') AND mapValues(ResourceAttributes)[indexOf(mapKeys(ResourceAttributes), '${escapedKey}')] = '${escapedValue}'))`,
      );
    }

    return conditions;
  }
}
