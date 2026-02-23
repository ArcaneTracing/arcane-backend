import { InternalServerErrorException } from "@nestjs/common";
import { AxiosError } from "axios";
import {
  TempoErrorHandler,
  TempoErrorContext,
  TempoErrorOptions,
} from "../../../../src/traces/backends/tempo/tempo.error.handler";
import {
  ERROR_MESSAGES,
  formatError,
} from "../../../../src/common/constants/error-messages.constants";

describe("TempoErrorHandler", () => {
  const tempoUrl = "https://tempo.example.com";
  const context: TempoErrorContext = {
    url: tempoUrl,
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
      const options: TempoErrorOptions = { traceId: "trace-123" };

      expect(() =>
        TempoErrorHandler.handle(error, tempoUrl, context, options),
      ).toThrow("TRACE_NOT_FOUND:trace-123");
    });

    it("should throw InternalServerErrorException for 404 without traceId", () => {
      const error: AxiosError = {
        response: {
          status: 404,
          statusText: "Not Found",
          data: {},
        },
      } as AxiosError;

      expect(() => TempoErrorHandler.handle(error, tempoUrl, context)).toThrow(
        InternalServerErrorException,
      );
      expect(() => TempoErrorHandler.handle(error, tempoUrl, context)).toThrow(
        formatError(ERROR_MESSAGES.TEMPO_SERVICE_ERROR, 404),
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

      expect(() => TempoErrorHandler.handle(error, tempoUrl, context)).toThrow(
        InternalServerErrorException,
      );
      expect(() => TempoErrorHandler.handle(error, tempoUrl, context)).toThrow(
        formatError(ERROR_MESSAGES.TEMPO_SERVICE_ERROR, 500),
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

      expect(() => TempoErrorHandler.handle(error, tempoUrl, context)).toThrow(
        InternalServerErrorException,
      );
      expect(() => TempoErrorHandler.handle(error, tempoUrl, context)).toThrow(
        formatError(ERROR_MESSAGES.TEMPO_SERVICE_ERROR, 500),
      );
    });

    it("should throw timeout error for ETIMEDOUT", () => {
      const error: AxiosError = {
        request: {},
        code: "ETIMEDOUT",
        message: "Timeout",
      } as AxiosError;

      expect(() => TempoErrorHandler.handle(error, tempoUrl, context)).toThrow(
        InternalServerErrorException,
      );
      expect(() => TempoErrorHandler.handle(error, tempoUrl, context)).toThrow(
        formatError(ERROR_MESSAGES.TEMPO_TIMEOUT_ERROR, tempoUrl),
      );
    });

    it("should throw timeout error for ECONNABORTED", () => {
      const error: AxiosError = {
        request: {},
        code: "ECONNABORTED",
        message: "Connection aborted",
      } as AxiosError;

      expect(() => TempoErrorHandler.handle(error, tempoUrl, context)).toThrow(
        InternalServerErrorException,
      );
      expect(() => TempoErrorHandler.handle(error, tempoUrl, context)).toThrow(
        formatError(ERROR_MESSAGES.TEMPO_TIMEOUT_ERROR, tempoUrl),
      );
    });

    it("should throw timeout error for timeout in message", () => {
      const error: AxiosError = {
        request: {},
        message: "timeout of 5000ms exceeded",
      } as AxiosError;

      expect(() => TempoErrorHandler.handle(error, tempoUrl, context)).toThrow(
        InternalServerErrorException,
      );
      expect(() => TempoErrorHandler.handle(error, tempoUrl, context)).toThrow(
        formatError(ERROR_MESSAGES.TEMPO_TIMEOUT_ERROR, tempoUrl),
      );
    });

    it("should throw connection error for other connection errors", () => {
      const error: AxiosError = {
        request: {},
        code: "ECONNREFUSED",
        message: "Connection refused",
      } as AxiosError;

      expect(() => TempoErrorHandler.handle(error, tempoUrl, context)).toThrow(
        InternalServerErrorException,
      );
      expect(() => TempoErrorHandler.handle(error, tempoUrl, context)).toThrow(
        formatError(ERROR_MESSAGES.TEMPO_CONNECTION_ERROR, tempoUrl),
      );
    });

    it("should throw TRACE_SEARCH_FAILED for unexpected errors when isSearch is true", () => {
      const error = new Error("Unexpected error");
      const options: TempoErrorOptions = { isSearch: true };

      expect(() =>
        TempoErrorHandler.handle(error, tempoUrl, context, options),
      ).toThrow(InternalServerErrorException);
      expect(() =>
        TempoErrorHandler.handle(error, tempoUrl, context, options),
      ).toThrow(formatError(ERROR_MESSAGES.TRACE_SEARCH_FAILED));
    });

    it("should throw TRACE_QUERY_FAILED for unexpected errors when isSearch is false", () => {
      const error = new Error("Unexpected error");
      const options: TempoErrorOptions = { isSearch: false };

      expect(() =>
        TempoErrorHandler.handle(error, tempoUrl, context, options),
      ).toThrow(InternalServerErrorException);
      expect(() =>
        TempoErrorHandler.handle(error, tempoUrl, context, options),
      ).toThrow(formatError(ERROR_MESSAGES.TRACE_QUERY_FAILED));
    });

    it("should throw TRACE_QUERY_FAILED for unexpected errors when isGetAttributeNames is true", () => {
      const error = new Error("Unexpected error");
      const options: TempoErrorOptions = { isGetAttributeNames: true };

      expect(() =>
        TempoErrorHandler.handle(error, tempoUrl, context, options),
      ).toThrow(InternalServerErrorException);
      expect(() =>
        TempoErrorHandler.handle(error, tempoUrl, context, options),
      ).toThrow(formatError(ERROR_MESSAGES.TRACE_QUERY_FAILED));
    });

    it("should throw TRACE_QUERY_FAILED for unexpected errors when isGetAttributeValues is true", () => {
      const error = new Error("Unexpected error");
      const options: TempoErrorOptions = { isGetAttributeValues: true };

      expect(() =>
        TempoErrorHandler.handle(error, tempoUrl, context, options),
      ).toThrow(InternalServerErrorException);
      expect(() =>
        TempoErrorHandler.handle(error, tempoUrl, context, options),
      ).toThrow(formatError(ERROR_MESSAGES.TRACE_QUERY_FAILED));
    });

    it("should throw TRACE_QUERY_FAILED for unexpected errors by default", () => {
      const error = new Error("Unexpected error");

      expect(() => TempoErrorHandler.handle(error, tempoUrl, context)).toThrow(
        InternalServerErrorException,
      );
      expect(() => TempoErrorHandler.handle(error, tempoUrl, context)).toThrow(
        formatError(ERROR_MESSAGES.TRACE_QUERY_FAILED),
      );
    });
  });

  describe("handleFetchError", () => {
    it("should throw InternalServerErrorException for non-OK response", async () => {
      const response = {
        status: 500,
        statusText: "Internal Server Error",
        text: jest.fn().mockResolvedValue("Server error"),
      } as unknown as Response;

      await expect(
        TempoErrorHandler.handleFetchError(response, tempoUrl, context),
      ).rejects.toThrow(InternalServerErrorException);
      await expect(
        TempoErrorHandler.handleFetchError(response, tempoUrl, context),
      ).rejects.toThrow(formatError(ERROR_MESSAGES.TEMPO_SERVICE_ERROR, 500));
    });

    it("should read error text from response", async () => {
      const response = {
        status: 400,
        statusText: "Bad Request",
        text: jest.fn().mockResolvedValue("Bad request details"),
      } as unknown as Response;

      await expect(
        TempoErrorHandler.handleFetchError(response, tempoUrl, context),
      ).rejects.toThrow(InternalServerErrorException);
      expect(response.text).toHaveBeenCalled();
    });

    it("should handle response with empty text", async () => {
      const response = {
        status: 500,
        statusText: "Internal Server Error",
        text: jest.fn().mockResolvedValue(""),
      } as unknown as Response;

      await expect(
        TempoErrorHandler.handleFetchError(response, tempoUrl, context),
      ).rejects.toThrow(InternalServerErrorException);
    });
  });

  describe("handle edge cases", () => {
    it("should handle response with null data", () => {
      const error: AxiosError = {
        response: {
          status: 500,
          statusText: "Internal Server Error",
          data: null,
        },
      } as AxiosError;

      expect(() => TempoErrorHandler.handle(error, tempoUrl, context)).toThrow(
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

      expect(() => TempoErrorHandler.handle(error, tempoUrl, context)).toThrow(
        InternalServerErrorException,
      );
    });

    it("should handle error with no code or message", () => {
      const error: AxiosError = {
        request: {},
      } as AxiosError;

      expect(() => TempoErrorHandler.handle(error, tempoUrl, context)).toThrow(
        InternalServerErrorException,
      );
    });

    it("should handle 401 authentication error", () => {
      const error: AxiosError = {
        response: {
          status: 401,
          statusText: "Unauthorized",
          data: {},
        },
      } as AxiosError;

      expect(() => TempoErrorHandler.handle(error, tempoUrl, context)).toThrow(
        InternalServerErrorException,
      );
      expect(() => TempoErrorHandler.handle(error, tempoUrl, context)).toThrow(
        formatError(ERROR_MESSAGES.TEMPO_SERVICE_ERROR, 401),
      );
    });

    it("should handle 403 forbidden error", () => {
      const error: AxiosError = {
        response: {
          status: 403,
          statusText: "Forbidden",
          data: {},
        },
      } as AxiosError;

      expect(() => TempoErrorHandler.handle(error, tempoUrl, context)).toThrow(
        InternalServerErrorException,
      );
      expect(() => TempoErrorHandler.handle(error, tempoUrl, context)).toThrow(
        formatError(ERROR_MESSAGES.TEMPO_SERVICE_ERROR, 403),
      );
    });
  });
});
