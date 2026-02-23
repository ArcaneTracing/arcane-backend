import { InternalServerErrorException } from "@nestjs/common";
import {
  ClickHouseErrorHandler,
  ClickHouseErrorContext,
  ClickHouseErrorOptions,
} from "../../../../src/traces/backends/clickhouse/clickhouse.error.handler";
import {
  ERROR_MESSAGES,
  formatError,
} from "../../../../src/common/constants/error-messages.constants";

describe("ClickHouseErrorHandler", () => {
  const clickHouseUrl = "http://localhost:8123";
  const context: ClickHouseErrorContext = {
    datasourceId: "datasource-1",
  };

  describe("handle", () => {
    it("should throw authentication error for 401 status", () => {
      const error = { status: 401, message: "Unauthorized" };

      expect(() =>
        ClickHouseErrorHandler.handle(error, clickHouseUrl, context),
      ).toThrow(InternalServerErrorException);
      expect(() =>
        ClickHouseErrorHandler.handle(error, clickHouseUrl, context),
      ).toThrow(formatError(ERROR_MESSAGES.CLICKHOUSE_AUTHENTICATION_ERROR));
    });

    it("should throw authorization error for 403 status", () => {
      const error = { status: 403, message: "Forbidden" };

      expect(() =>
        ClickHouseErrorHandler.handle(error, clickHouseUrl, context),
      ).toThrow(InternalServerErrorException);
      expect(() =>
        ClickHouseErrorHandler.handle(error, clickHouseUrl, context),
      ).toThrow(formatError(ERROR_MESSAGES.CLICKHOUSE_AUTHORIZATION_ERROR));
    });

    it('should throw authentication error for "Authentication failed" message', () => {
      const error = new Error("Authentication failed");

      expect(() =>
        ClickHouseErrorHandler.handle(error, clickHouseUrl, context),
      ).toThrow(InternalServerErrorException);
      expect(() =>
        ClickHouseErrorHandler.handle(error, clickHouseUrl, context),
      ).toThrow(formatError(ERROR_MESSAGES.CLICKHOUSE_AUTHENTICATION_ERROR));
    });

    it('should throw authorization error for "Access denied" message', () => {
      const error = new Error("Access denied");

      expect(() =>
        ClickHouseErrorHandler.handle(error, clickHouseUrl, context),
      ).toThrow(InternalServerErrorException);
      expect(() =>
        ClickHouseErrorHandler.handle(error, clickHouseUrl, context),
      ).toThrow(formatError(ERROR_MESSAGES.CLICKHOUSE_AUTHORIZATION_ERROR));
    });

    it('should throw authorization error for "Not enough privileges" message', () => {
      const error = new Error("Not enough privileges");

      expect(() =>
        ClickHouseErrorHandler.handle(error, clickHouseUrl, context),
      ).toThrow(InternalServerErrorException);
      expect(() =>
        ClickHouseErrorHandler.handle(error, clickHouseUrl, context),
      ).toThrow(formatError(ERROR_MESSAGES.CLICKHOUSE_AUTHORIZATION_ERROR));
    });

    it("should throw table not found error when tableName is provided and error mentions table", () => {
      const error = new Error("Table 'traces' doesn't exist");
      const options: ClickHouseErrorOptions = { tableName: "traces" };

      expect(() =>
        ClickHouseErrorHandler.handle(error, clickHouseUrl, context, options),
      ).toThrow(InternalServerErrorException);
      expect(() =>
        ClickHouseErrorHandler.handle(error, clickHouseUrl, context, options),
      ).toThrow(
        formatError(ERROR_MESSAGES.CLICKHOUSE_TABLE_NOT_FOUND, "traces"),
      );
    });

    it("should throw connection error for ECONNREFUSED", () => {
      const error = { code: "ECONNREFUSED", message: "Connection refused" };

      expect(() =>
        ClickHouseErrorHandler.handle(error, clickHouseUrl, context),
      ).toThrow(InternalServerErrorException);
      expect(() =>
        ClickHouseErrorHandler.handle(error, clickHouseUrl, context),
      ).toThrow(
        formatError(
          ERROR_MESSAGES.CLICKHOUSE_CONNECTION_ERROR,
          clickHouseUrl,
          "ECONNREFUSED",
        ),
      );
    });

    it("should throw connection error for ENOTFOUND", () => {
      const error = { code: "ENOTFOUND", message: "getaddrinfo ENOTFOUND" };

      expect(() =>
        ClickHouseErrorHandler.handle(error, clickHouseUrl, context),
      ).toThrow(InternalServerErrorException);
      expect(() =>
        ClickHouseErrorHandler.handle(error, clickHouseUrl, context),
      ).toThrow(
        formatError(
          ERROR_MESSAGES.CLICKHOUSE_CONNECTION_ERROR,
          clickHouseUrl,
          "ENOTFOUND",
        ),
      );
    });

    it("should throw timeout error for ETIMEDOUT", () => {
      const error = { code: "ETIMEDOUT", message: "Timeout" };

      expect(() =>
        ClickHouseErrorHandler.handle(error, clickHouseUrl, context),
      ).toThrow(InternalServerErrorException);
      expect(() =>
        ClickHouseErrorHandler.handle(error, clickHouseUrl, context),
      ).toThrow(formatError(ERROR_MESSAGES.CLICKHOUSE_TIMEOUT_ERROR));
    });

    it("should throw timeout error for timeout in message", () => {
      const error = new Error("timeout of 5000ms exceeded");

      expect(() =>
        ClickHouseErrorHandler.handle(error, clickHouseUrl, context),
      ).toThrow(InternalServerErrorException);
      expect(() =>
        ClickHouseErrorHandler.handle(error, clickHouseUrl, context),
      ).toThrow(formatError(ERROR_MESSAGES.CLICKHOUSE_TIMEOUT_ERROR));
    });

    it("should throw TRACE_NOT_FOUND for trace not found message with traceId", () => {
      const error = new Error("Trace not found");
      const options: ClickHouseErrorOptions = { traceId: "trace-123" };

      expect(() =>
        ClickHouseErrorHandler.handle(error, clickHouseUrl, context, options),
      ).toThrow("TRACE_NOT_FOUND:trace-123");
    });

    it("should throw query error for syntax errors", () => {
      const error = new Error("Syntax error: unexpected token");

      expect(() =>
        ClickHouseErrorHandler.handle(error, clickHouseUrl, context),
      ).toThrow(InternalServerErrorException);
      expect(() =>
        ClickHouseErrorHandler.handle(error, clickHouseUrl, context),
      ).toThrow(
        formatError(
          ERROR_MESSAGES.CLICKHOUSE_QUERY_ERROR,
          "Syntax error: unexpected token",
        ),
      );
    });

    it("should throw query error for DB::Exception", () => {
      const error = new Error("DB::Exception: Invalid query");

      expect(() =>
        ClickHouseErrorHandler.handle(error, clickHouseUrl, context),
      ).toThrow(InternalServerErrorException);
      expect(() =>
        ClickHouseErrorHandler.handle(error, clickHouseUrl, context),
      ).toThrow(
        formatError(
          ERROR_MESSAGES.CLICKHOUSE_QUERY_ERROR,
          "DB::Exception: Invalid query",
        ),
      );
    });

    it("should throw database error for database not found", () => {
      const error = new Error("Database 'testdb' doesn't exist");

      expect(() =>
        ClickHouseErrorHandler.handle(error, clickHouseUrl, context),
      ).toThrow(InternalServerErrorException);
      expect(() =>
        ClickHouseErrorHandler.handle(error, clickHouseUrl, context),
      ).toThrow(
        formatError(
          ERROR_MESSAGES.CLICKHOUSE_DATABASE_ERROR,
          "Database 'testdb' doesn't exist",
        ),
      );
    });

    it("should throw TRACE_SEARCH_FAILED for unexpected errors when isSearch is true", () => {
      const error = new Error("Unexpected error");
      const options: ClickHouseErrorOptions = { isSearch: true };

      expect(() =>
        ClickHouseErrorHandler.handle(error, clickHouseUrl, context, options),
      ).toThrow(InternalServerErrorException);
      expect(() =>
        ClickHouseErrorHandler.handle(error, clickHouseUrl, context, options),
      ).toThrow(formatError(ERROR_MESSAGES.TRACE_SEARCH_FAILED));
    });

    it("should throw TRACE_QUERY_FAILED for unexpected errors when isSearch is false", () => {
      const error = new Error("Unexpected error");
      const options: ClickHouseErrorOptions = { isSearch: false };

      expect(() =>
        ClickHouseErrorHandler.handle(error, clickHouseUrl, context, options),
      ).toThrow(InternalServerErrorException);
      expect(() =>
        ClickHouseErrorHandler.handle(error, clickHouseUrl, context, options),
      ).toThrow(formatError(ERROR_MESSAGES.TRACE_QUERY_FAILED));
    });

    it("should throw TRACE_QUERY_FAILED for unexpected errors by default", () => {
      const error = new Error("Unexpected error");

      expect(() =>
        ClickHouseErrorHandler.handle(error, clickHouseUrl, context),
      ).toThrow(InternalServerErrorException);
      expect(() =>
        ClickHouseErrorHandler.handle(error, clickHouseUrl, context),
      ).toThrow(formatError(ERROR_MESSAGES.TRACE_QUERY_FAILED));
    });

    it("should handle non-Error objects", () => {
      const error = "String error";

      expect(() =>
        ClickHouseErrorHandler.handle(error, clickHouseUrl, context),
      ).toThrow(InternalServerErrorException);
    });

    it("should handle error with statusCode property", () => {
      const error = { statusCode: 401, message: "Unauthorized" };

      expect(() =>
        ClickHouseErrorHandler.handle(error, clickHouseUrl, context),
      ).toThrow(InternalServerErrorException);
      expect(() =>
        ClickHouseErrorHandler.handle(error, clickHouseUrl, context),
      ).toThrow(formatError(ERROR_MESSAGES.CLICKHOUSE_AUTHENTICATION_ERROR));
    });

    it("should handle error with status property", () => {
      const error = { status: 403, message: "Forbidden" };

      expect(() =>
        ClickHouseErrorHandler.handle(error, clickHouseUrl, context),
      ).toThrow(InternalServerErrorException);
      expect(() =>
        ClickHouseErrorHandler.handle(error, clickHouseUrl, context),
      ).toThrow(formatError(ERROR_MESSAGES.CLICKHOUSE_AUTHORIZATION_ERROR));
    });

    it("should handle case-insensitive authentication error messages", () => {
      const error = new Error("AUTHENTICATION FAILED");

      expect(() =>
        ClickHouseErrorHandler.handle(error, clickHouseUrl, context),
      ).toThrow(InternalServerErrorException);
      expect(() =>
        ClickHouseErrorHandler.handle(error, clickHouseUrl, context),
      ).toThrow(formatError(ERROR_MESSAGES.CLICKHOUSE_AUTHENTICATION_ERROR));
    });

    it("should handle case-insensitive authorization error messages", () => {
      const error = new Error("ACCESS DENIED");

      expect(() =>
        ClickHouseErrorHandler.handle(error, clickHouseUrl, context),
      ).toThrow(InternalServerErrorException);
      expect(() =>
        ClickHouseErrorHandler.handle(error, clickHouseUrl, context),
      ).toThrow(formatError(ERROR_MESSAGES.CLICKHOUSE_AUTHORIZATION_ERROR));
    });

    it("should handle table not found with different error message formats", () => {
      const error1 = new Error("Table 'traces' doesn't exist");
      const error2 = new Error("Table traces doesn't exist");
      const options: ClickHouseErrorOptions = { tableName: "traces" };

      expect(() =>
        ClickHouseErrorHandler.handle(error1, clickHouseUrl, context, options),
      ).toThrow(InternalServerErrorException);
      expect(() =>
        ClickHouseErrorHandler.handle(error2, clickHouseUrl, context, options),
      ).toThrow(InternalServerErrorException);
    });

    it("should handle ECONNABORTED timeout", () => {
      const error = { code: "ECONNABORTED", message: "Connection aborted" };

      expect(() =>
        ClickHouseErrorHandler.handle(error, clickHouseUrl, context),
      ).toThrow(InternalServerErrorException);
      expect(() =>
        ClickHouseErrorHandler.handle(error, clickHouseUrl, context),
      ).toThrow(formatError(ERROR_MESSAGES.CLICKHOUSE_TIMEOUT_ERROR));
    });

    it("should handle timeout with capital T", () => {
      const error = new Error("Timeout occurred");

      expect(() =>
        ClickHouseErrorHandler.handle(error, clickHouseUrl, context),
      ).toThrow(InternalServerErrorException);
      expect(() =>
        ClickHouseErrorHandler.handle(error, clickHouseUrl, context),
      ).toThrow(formatError(ERROR_MESSAGES.CLICKHOUSE_TIMEOUT_ERROR));
    });

    it("should handle trace not found without traceId option", () => {
      const error = new Error("Trace not found");

      expect(() =>
        ClickHouseErrorHandler.handle(error, clickHouseUrl, context),
      ).toThrow(InternalServerErrorException);
    });

    it("should handle database error with different formats", () => {
      const error1 = new Error("Database 'testdb' doesn't exist");
      const error2 = new Error("Database testdb not found");

      expect(() =>
        ClickHouseErrorHandler.handle(error1, clickHouseUrl, context),
      ).toThrow(InternalServerErrorException);
      expect(() =>
        ClickHouseErrorHandler.handle(error2, clickHouseUrl, context),
      ).toThrow(InternalServerErrorException);
    });

    it("should handle query error with DB::Exception prefix", () => {
      const error = new Error("DB::Exception: Syntax error in query");

      expect(() =>
        ClickHouseErrorHandler.handle(error, clickHouseUrl, context),
      ).toThrow(InternalServerErrorException);
      expect(() =>
        ClickHouseErrorHandler.handle(error, clickHouseUrl, context),
      ).toThrow(
        formatError(
          ERROR_MESSAGES.CLICKHOUSE_QUERY_ERROR,
          "DB::Exception: Syntax error in query",
        ),
      );
    });

    it("should handle isGetAttributeNames option", () => {
      const error = new Error("Unexpected error");
      const options: ClickHouseErrorOptions = { isGetAttributeNames: true };

      expect(() =>
        ClickHouseErrorHandler.handle(error, clickHouseUrl, context, options),
      ).toThrow(InternalServerErrorException);
      expect(() =>
        ClickHouseErrorHandler.handle(error, clickHouseUrl, context, options),
      ).toThrow(formatError(ERROR_MESSAGES.TRACE_QUERY_FAILED));
    });

    it("should handle isGetAttributeValues option", () => {
      const error = new Error("Unexpected error");
      const options: ClickHouseErrorOptions = { isGetAttributeValues: true };

      expect(() =>
        ClickHouseErrorHandler.handle(error, clickHouseUrl, context, options),
      ).toThrow(InternalServerErrorException);
      expect(() =>
        ClickHouseErrorHandler.handle(error, clickHouseUrl, context, options),
      ).toThrow(formatError(ERROR_MESSAGES.TRACE_QUERY_FAILED));
    });
  });
});
