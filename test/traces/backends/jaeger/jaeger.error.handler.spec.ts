import { InternalServerErrorException } from "@nestjs/common";
import { AxiosError } from "axios";
import {
  JaegerErrorHandler,
  JaegerErrorContext,
  JaegerErrorOptions,
} from "../../../../src/traces/backends/jaeger/jaeger.error.handler";
import {
  ERROR_MESSAGES,
  formatError,
} from "../../../../src/common/constants/error-messages.constants";

describe("JaegerErrorHandler", () => {
  const baseUrl = "https://jaeger.example.com";
  const context: JaegerErrorContext = {
    url: baseUrl,
    datasourceId: "datasource-1",
  };

  describe("handle", () => {
    it("should throw TRACE_NOT_FOUND error for 404 with traceId", () => {
      const error: AxiosError = {
        response: {
          status: 404,
          statusText: "Not Found",
          data: {},
        },
      } as AxiosError;
      const options: JaegerErrorOptions = { traceId: "trace-123" };

      expect(() =>
        JaegerErrorHandler.handle(error, baseUrl, context, options),
      ).toThrow("TRACE_NOT_FOUND:trace-123");
    });

    it('should throw EMPTY_RESULT for 404 with allowEmptyResultOn404 and "No traces found" message', () => {
      const error: AxiosError = {
        response: {
          status: 404,
          statusText: "Not Found",
          data: {
            error: {
              message: "No traces found",
            },
          },
        },
      } as AxiosError;
      const options: JaegerErrorOptions = { allowEmptyResultOn404: true };

      expect(() =>
        JaegerErrorHandler.handle(error, baseUrl, context, options),
      ).toThrow("EMPTY_RESULT");
    });

    it("should throw InternalServerErrorException for 404 without traceId or allowEmptyResultOn404", () => {
      const error: AxiosError = {
        response: {
          status: 404,
          statusText: "Not Found",
          data: {},
        },
      } as AxiosError;

      expect(() => JaegerErrorHandler.handle(error, baseUrl, context)).toThrow(
        InternalServerErrorException,
      );
      expect(() => JaegerErrorHandler.handle(error, baseUrl, context)).toThrow(
        formatError(ERROR_MESSAGES.JAEGER_API_ERROR, 404, "Not Found"),
      );
    });

    it("should throw InternalServerErrorException for 5xx errors", () => {
      const error: AxiosError = {
        response: {
          status: 500,
          statusText: "Internal Server Error",
          data: {
            error: {
              message: "Server error",
            },
          },
        },
      } as AxiosError;

      expect(() => JaegerErrorHandler.handle(error, baseUrl, context)).toThrow(
        InternalServerErrorException,
      );
      expect(() => JaegerErrorHandler.handle(error, baseUrl, context)).toThrow(
        formatError(ERROR_MESSAGES.JAEGER_API_ERROR, 500, "Server error"),
      );
    });

    it("should throw InternalServerErrorException for 4xx errors", () => {
      const error: AxiosError = {
        response: {
          status: 400,
          statusText: "Bad Request",
          data: {
            error: {
              message: "Invalid request",
            },
          },
        },
      } as AxiosError;

      expect(() => JaegerErrorHandler.handle(error, baseUrl, context)).toThrow(
        InternalServerErrorException,
      );
      expect(() => JaegerErrorHandler.handle(error, baseUrl, context)).toThrow(
        formatError(ERROR_MESSAGES.JAEGER_API_ERROR, 400, "Invalid request"),
      );
    });

    it("should handle string response data", () => {
      const error: AxiosError = {
        response: {
          status: 500,
          statusText: "Internal Server Error",
          data: "Server error string",
        },
      } as AxiosError;

      expect(() => JaegerErrorHandler.handle(error, baseUrl, context)).toThrow(
        InternalServerErrorException,
      );
      expect(() => JaegerErrorHandler.handle(error, baseUrl, context)).toThrow(
        formatError(
          ERROR_MESSAGES.JAEGER_API_ERROR,
          500,
          "Server error string",
        ),
      );
    });

    it("should throw timeout error for ETIMEDOUT", () => {
      const error: AxiosError = {
        request: {},
        code: "ETIMEDOUT",
        message: "Timeout",
      } as AxiosError;

      expect(() => JaegerErrorHandler.handle(error, baseUrl, context)).toThrow(
        InternalServerErrorException,
      );
      expect(() => JaegerErrorHandler.handle(error, baseUrl, context)).toThrow(
        formatError(ERROR_MESSAGES.JAEGER_TIMEOUT_ERROR, baseUrl),
      );
    });

    it("should throw timeout error for ECONNABORTED", () => {
      const error: AxiosError = {
        request: {},
        code: "ECONNABORTED",
        message: "Connection aborted",
      } as AxiosError;

      expect(() => JaegerErrorHandler.handle(error, baseUrl, context)).toThrow(
        InternalServerErrorException,
      );
      expect(() => JaegerErrorHandler.handle(error, baseUrl, context)).toThrow(
        formatError(ERROR_MESSAGES.JAEGER_TIMEOUT_ERROR, baseUrl),
      );
    });

    it("should throw timeout error for timeout in message", () => {
      const error: AxiosError = {
        request: {},
        message: "timeout of 5000ms exceeded",
      } as AxiosError;

      expect(() => JaegerErrorHandler.handle(error, baseUrl, context)).toThrow(
        InternalServerErrorException,
      );
      expect(() => JaegerErrorHandler.handle(error, baseUrl, context)).toThrow(
        formatError(ERROR_MESSAGES.JAEGER_TIMEOUT_ERROR, baseUrl),
      );
    });

    it("should throw connection error for ECONNREFUSED", () => {
      const error: AxiosError = {
        request: {},
        code: "ECONNREFUSED",
        message: "Connection refused",
      } as AxiosError;

      expect(() => JaegerErrorHandler.handle(error, baseUrl, context)).toThrow(
        InternalServerErrorException,
      );
      expect(() => JaegerErrorHandler.handle(error, baseUrl, context)).toThrow(
        formatError(
          ERROR_MESSAGES.JAEGER_CONNECTION_ERROR,
          baseUrl,
          "ECONNREFUSED",
        ),
      );
    });

    it("should throw connection error for ENOTFOUND", () => {
      const error: AxiosError = {
        request: {},
        code: "ENOTFOUND",
        message: "getaddrinfo ENOTFOUND",
      } as AxiosError;

      expect(() => JaegerErrorHandler.handle(error, baseUrl, context)).toThrow(
        InternalServerErrorException,
      );
      expect(() => JaegerErrorHandler.handle(error, baseUrl, context)).toThrow(
        formatError(
          ERROR_MESSAGES.JAEGER_CONNECTION_ERROR,
          baseUrl,
          "ENOTFOUND",
        ),
      );
    });

    it("should throw TRACE_SEARCH_FAILED for unexpected errors when isSearch is true", () => {
      const error = new Error("Unexpected error");
      const options: JaegerErrorOptions = { isSearch: true };

      expect(() =>
        JaegerErrorHandler.handle(error, baseUrl, context, options),
      ).toThrow(InternalServerErrorException);
      expect(() =>
        JaegerErrorHandler.handle(error, baseUrl, context, options),
      ).toThrow(formatError(ERROR_MESSAGES.TRACE_SEARCH_FAILED));
    });

    it("should throw TRACE_QUERY_FAILED for unexpected errors when isSearch is false", () => {
      const error = new Error("Unexpected error");
      const options: JaegerErrorOptions = { isSearch: false };

      expect(() =>
        JaegerErrorHandler.handle(error, baseUrl, context, options),
      ).toThrow(InternalServerErrorException);
      expect(() =>
        JaegerErrorHandler.handle(error, baseUrl, context, options),
      ).toThrow(formatError(ERROR_MESSAGES.TRACE_QUERY_FAILED));
    });

    it("should throw TRACE_SEARCH_FAILED for unexpected errors by default", () => {
      const error = new Error("Unexpected error");

      expect(() => JaegerErrorHandler.handle(error, baseUrl, context)).toThrow(
        InternalServerErrorException,
      );
      expect(() => JaegerErrorHandler.handle(error, baseUrl, context)).toThrow(
        formatError(ERROR_MESSAGES.TRACE_SEARCH_FAILED),
      );
    });

    it("should handle 404 with allowEmptyResultOn404 but different error message", () => {
      const error: AxiosError = {
        response: {
          status: 404,
          statusText: "Not Found",
          data: {
            error: {
              message: "Resource not found",
            },
          },
        },
      } as AxiosError;
      const options: JaegerErrorOptions = { allowEmptyResultOn404: true };

      expect(() =>
        JaegerErrorHandler.handle(error, baseUrl, context, options),
      ).toThrow(InternalServerErrorException);
    });

    it("should handle 404 with allowEmptyResultOn404 and empty error message", () => {
      const error: AxiosError = {
        response: {
          status: 404,
          statusText: "Not Found",
          data: {
            error: {},
          },
        },
      } as AxiosError;
      const options: JaegerErrorOptions = { allowEmptyResultOn404: true };

      expect(() =>
        JaegerErrorHandler.handle(error, baseUrl, context, options),
      ).toThrow(InternalServerErrorException);
    });

    it("should handle response with null data", () => {
      const error: AxiosError = {
        response: {
          status: 500,
          statusText: "Internal Server Error",
          data: null,
        },
      } as AxiosError;

      expect(() => JaegerErrorHandler.handle(error, baseUrl, context)).toThrow(
        InternalServerErrorException,
      );
    });

    it("should handle response with empty object data", () => {
      const error: AxiosError = {
        response: {
          status: 500,
          statusText: "Internal Server Error",
          data: {},
        },
      } as AxiosError;

      expect(() => JaegerErrorHandler.handle(error, baseUrl, context)).toThrow(
        InternalServerErrorException,
      );
    });

    it("should handle error with no code or message", () => {
      const error: AxiosError = {
        request: {},
      } as AxiosError;

      expect(() => JaegerErrorHandler.handle(error, baseUrl, context)).toThrow(
        InternalServerErrorException,
      );
    });

    it("should handle error with isSearch explicitly false", () => {
      const error = new Error("Unexpected error");
      const options: JaegerErrorOptions = { isSearch: false };

      expect(() =>
        JaegerErrorHandler.handle(error, baseUrl, context, options),
      ).toThrow(InternalServerErrorException);
      expect(() =>
        JaegerErrorHandler.handle(error, baseUrl, context, options),
      ).toThrow(formatError(ERROR_MESSAGES.TRACE_QUERY_FAILED));
    });
  });
});
