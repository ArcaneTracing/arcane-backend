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

export interface TempoErrorContext {
  url: string;
  datasourceId: string;
  [key: string]: any;
}

export interface TempoErrorOptions {
  traceId?: string;
  isSearch?: boolean;
  isGetAttributeNames?: boolean;
  isGetAttributeValues?: boolean;
}

export class TempoErrorHandler {
  private static readonly logger = new Logger(TempoErrorHandler.name);

  static handle(
    error: unknown,
    tempoUrl: string,
    context: TempoErrorContext,
    options?: TempoErrorOptions,
  ): never {
    if (error instanceof NotFoundException) {
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
    this.logger.error("Error in Tempo API request", errorContext);

    if (axiosError.response) {
      this.handleResponseError(axiosError, errorContext, options);
    }
    if (axiosError.request) {
      this.handleRequestError(axiosError, tempoUrl, errorContext);
    }
    this.logger.error("Unexpected error in Tempo API request", {
      ...errorContext,
      errorStack: axiosError.stack,
    });
    const errorMessage = options?.isSearch
      ? ERROR_MESSAGES.TRACE_SEARCH_FAILED
      : ERROR_MESSAGES.TRACE_QUERY_FAILED;
    throw new InternalServerErrorException(formatError(errorMessage));
  }

  private static handleResponseError(
    axiosError: AxiosError,
    errorContext: object,
    options?: TempoErrorOptions,
  ): never {
    const response = axiosError.response;
    if (!response)
      throw new InternalServerErrorException(
        formatError(ERROR_MESSAGES.TRACE_QUERY_FAILED),
      );
    const { status, statusText, data } = response;
    const responseData = data as Record<string, unknown> | string | undefined;

    if (status === 404 && options?.traceId) {
      throw new Error(`TRACE_NOT_FOUND:${options.traceId}`);
    }
    this.logger.error("Tempo API error response", {
      ...errorContext,
      status,
      statusText,
      responseData:
        typeof responseData === "object"
          ? JSON.stringify(responseData)
          : responseData,
    });
    throw new InternalServerErrorException(
      formatError(ERROR_MESSAGES.TEMPO_SERVICE_ERROR, status),
    );
  }

  private static handleRequestError(
    axiosError: AxiosError,
    tempoUrl: string,
    errorContext: object,
  ): never {
    this.logger.error("Tempo connection error - no response received", {
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
        formatError(ERROR_MESSAGES.TEMPO_TIMEOUT_ERROR, tempoUrl),
      );
    }
    throw new InternalServerErrorException(
      formatError(ERROR_MESSAGES.TEMPO_CONNECTION_ERROR, tempoUrl),
    );
  }

  static async handleFetchError(
    response: Response,
    tempoUrl: string,
    context: TempoErrorContext,
  ): Promise<never> {
    const errorText = await response.text();
    this.logger.error("Tempo API fetch error response", {
      ...context,
      status: response.status,
      statusText: response.statusText,
      errorBody: errorText,
    });

    throw new InternalServerErrorException(
      formatError(ERROR_MESSAGES.TEMPO_SERVICE_ERROR, response.status),
    );
  }
}
