import {
  Logger,
  InternalServerErrorException,
  NotFoundException,
} from "@nestjs/common";
import { AxiosError } from "axios";
import {
  ERROR_MESSAGES,
  formatError,
} from "src/common/constants/error-messages.constants";

export interface JaegerErrorContext {
  url: string;
  datasourceId: string;
  [key: string]: any;
}

export interface JaegerErrorOptions {
  allowEmptyResultOn404?: boolean;
  traceId?: string;
  isSearch?: boolean;
}

type JaegerResponseData = { error?: { message?: string } } | string | undefined;

export class JaegerErrorHandler {
  private static readonly logger = new Logger(JaegerErrorHandler.name);

  static handle(
    error: unknown,
    baseUrl: string,
    context: JaegerErrorContext,
    options?: JaegerErrorOptions,
  ): never {
    if (
      error instanceof NotFoundException ||
      error instanceof InternalServerErrorException
    ) {
      throw error;
    }

    const axiosError = error as AxiosError;
    const errorContext = {
      ...context,
      errorMessage: axiosError.message,
      errorCode: (axiosError as any).code,
      errorStatus: axiosError.response?.status,
      errorStatusText: axiosError.response?.statusText,
    };
    this.logger.error("Error in Jaeger API request", errorContext);

    if (axiosError.response) {
      this.handleResponseError(axiosError, errorContext, options);
    }
    if (axiosError.request) {
      this.handleRequestError(axiosError, baseUrl, errorContext);
    }
    this.logger.error("Unexpected error in Jaeger API request", {
      ...errorContext,
      errorStack: axiosError.stack,
    });
    const errorMessage =
      (options?.isSearch ?? true)
        ? ERROR_MESSAGES.TRACE_SEARCH_FAILED
        : ERROR_MESSAGES.TRACE_QUERY_FAILED;
    throw new InternalServerErrorException(formatError(errorMessage));
  }

  private static handleResponseError(
    axiosError: AxiosError,
    errorContext: object,
    options?: JaegerErrorOptions,
  ): never {
    const response = axiosError.response;
    if (!response)
      throw new InternalServerErrorException(
        formatError(ERROR_MESSAGES.TRACE_QUERY_FAILED),
      );
    const { status, statusText, data } = response;
    const responseData = data as JaegerResponseData;

    if (status === 404) {
      this.handle404Response(responseData, options);
    }
    this.logger.error("Jaeger API error response", {
      ...errorContext,
      status,
      statusText,
      responseData:
        typeof responseData === "object"
          ? JSON.stringify(responseData)
          : responseData,
    });
    const jaegerErrorMsg = this.extractJaegerErrorMsg(responseData, statusText);
    throw new InternalServerErrorException(
      formatError(ERROR_MESSAGES.JAEGER_API_ERROR, status, jaegerErrorMsg),
    );
  }

  private static handle404Response(
    responseData: JaegerResponseData,
    options?: JaegerErrorOptions,
  ): void {
    if (options?.allowEmptyResultOn404) {
      const errorMsg = this.extractErrorMsg(responseData);
      if (
        errorMsg.includes("No traces found") ||
        errorMsg === "No traces found"
      ) {
        this.logger.debug(
          "Jaeger returned 404 - No traces found, returning empty result",
        );
        throw new Error("EMPTY_RESULT");
      }
    }
    if (options?.traceId) throw new Error(`TRACE_NOT_FOUND:${options.traceId}`);
  }

  private static extractErrorMsg(responseData: JaegerResponseData): string {
    if (
      typeof responseData === "object" &&
      responseData &&
      "error" in responseData
    ) {
      return (
        (responseData as { error?: { message?: string } }).error?.message ?? ""
      );
    }
    return "";
  }

  private static extractJaegerErrorMsg(
    responseData: JaegerResponseData,
    statusText: string,
  ): string {
    const errorObj =
      typeof responseData === "object" &&
      responseData &&
      "error" in responseData
        ? (responseData as { error?: { message?: string } })
        : null;
    return (
      errorObj?.error?.message ??
      (typeof responseData === "string" ? responseData : statusText)
    );
  }

  private static handleRequestError(
    axiosError: AxiosError,
    baseUrl: string,
    errorContext: object,
  ): never {
    this.logger.error("Jaeger connection error - no response received", {
      ...errorContext,
      errorName: axiosError.name,
      errorCode: (axiosError as any).code,
    });
    const errorCode = (axiosError as any).code;
    if (
      errorCode === "ETIMEDOUT" ||
      errorCode === "ECONNABORTED" ||
      axiosError.message?.includes("timeout")
    ) {
      throw new InternalServerErrorException(
        formatError(ERROR_MESSAGES.JAEGER_TIMEOUT_ERROR, baseUrl),
      );
    }
    throw new InternalServerErrorException(
      formatError(
        ERROR_MESSAGES.JAEGER_CONNECTION_ERROR,
        baseUrl,
        errorCode || axiosError.message,
      ),
    );
  }
}
