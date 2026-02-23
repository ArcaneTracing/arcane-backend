import {
  Logger,
  InternalServerErrorException,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { AxiosError } from "axios";
import {
  ERROR_MESSAGES,
  formatError,
} from "src/common/constants/error-messages.constants";

export interface CustomApiErrorContext {
  url: string;
  datasourceId: string;
  [key: string]: any;
}

export interface CustomApiErrorOptions {
  traceId?: string;
  isSearch?: boolean;
  isGetAttributeNames?: boolean;
  isGetAttributeValues?: boolean;
}

export class CustomApiErrorHandler {
  private static readonly logger = new Logger(CustomApiErrorHandler.name);

  static handle(
    error: unknown,
    baseUrl: string,
    context: CustomApiErrorContext,
    options?: CustomApiErrorOptions,
  ): never {
    if (CustomApiErrorHandler.shouldRethrow(error)) throw error;
    CustomApiErrorHandler.throwIfAxios404(error, options);

    const axiosError = error as AxiosError;
    const errorContext = {
      ...context,
      errorMessage: axiosError.message,
      errorCode: (axiosError as any).code,
      errorStatus: axiosError.response?.status,
      errorStatusText: axiosError.response?.statusText,
    };
    this.logger.error("Error in Custom API request", errorContext);

    if (axiosError.response) {
      this.handleResponseError(axiosError, errorContext, options);
    }
    if (axiosError.request) {
      this.handleRequestError(errorContext, options);
    }
    this.logger.error("Unexpected error in Custom API request", {
      ...errorContext,
      errorStack: axiosError.stack,
    });
    throw new InternalServerErrorException(
      formatError(this.getErrorMessage(options)),
    );
  }

  private static shouldRethrow(error: unknown): boolean {
    if (
      error instanceof NotFoundException ||
      error instanceof BadRequestException
    )
      return true;
    return (
      error instanceof Error &&
      (error.message.includes("Invalid response format") ||
        error.message.startsWith("TRACE_NOT_FOUND:"))
    );
  }

  private static throwIfAxios404(
    error: unknown,
    options?: CustomApiErrorOptions,
  ): void {
    if (!error || typeof error !== "object" || !("response" in error)) return;
    const axiosErr = error as { response?: { status?: number } };
    if (axiosErr.response?.status !== 404) return;
    if (options?.traceId) throw new Error(`TRACE_NOT_FOUND:${options.traceId}`);
    if (options?.isSearch) throw new Error("EMPTY_RESULT");
  }

  private static handleResponseError(
    axiosError: AxiosError,
    errorContext: object,
    options?: CustomApiErrorOptions,
  ): never {
    const response = axiosError.response;
    if (!response)
      throw new InternalServerErrorException(
        formatError(ERROR_MESSAGES.TRACE_QUERY_FAILED),
      );
    const { status, statusText, data } = response;
    const responseData = data as
      | { error?: { message?: string } }
      | string
      | undefined;

    if (status === 404) {
      if (options?.traceId)
        throw new Error(`TRACE_NOT_FOUND:${options.traceId}`);
      if (options?.isSearch) throw new Error("EMPTY_RESULT");
    }
    this.logger.error("Custom API error response", {
      ...errorContext,
      status,
      statusText,
      responseData:
        typeof responseData === "object"
          ? JSON.stringify(responseData)
          : responseData,
    });
    throw new InternalServerErrorException(
      formatError(this.getErrorMessage(options)),
    );
  }

  private static handleRequestError(
    errorContext: object,
    options?: CustomApiErrorOptions,
  ): never {
    this.logger.error(
      "Custom API connection error - no response received",
      errorContext,
    );
    throw new InternalServerErrorException(
      formatError(this.getErrorMessage(options)),
    );
  }

  private static getErrorMessage(options?: CustomApiErrorOptions): string {
    return options?.isSearch
      ? ERROR_MESSAGES.TRACE_SEARCH_FAILED
      : ERROR_MESSAGES.TRACE_QUERY_FAILED;
  }
}
