import {
  Logger,
  NotFoundException,
  BadGatewayException,
  InternalServerErrorException,
} from "@nestjs/common";
import {
  ERROR_MESSAGES,
  formatError,
} from "../../common/constants/error-messages.constants";
import { Datasource } from "../../datasources/entities/datasource.entity";

export interface TraceQueryErrorContext {
  datasourceId: string;
  traceId: string;
  datasourceUrl: string;
}

export class TraceQueryErrorHandler {
  private static readonly logger = new Logger(TraceQueryErrorHandler.name);

  static handleSearchByTraceIdError(
    error: unknown,
    datasource: Datasource,
    context: TraceQueryErrorContext,
  ): never {
    const errorMessage = this.getErrorMessage(error);

    if (error instanceof NotFoundException) {
      throw error;
    }
    if (errorMessage.startsWith("TRACE_NOT_FOUND:")) {
      const extractedTraceId = errorMessage.split(":")[1];
      this.logger.warn(
        `Trace ${extractedTraceId} not found in datasource ${context.datasourceId}`,
      );
      throw new NotFoundException(
        formatError(ERROR_MESSAGES.TRACE_NOT_FOUND, extractedTraceId),
      );
    }
    if (errorMessage.startsWith("TEMPO_CONNECTION_ERROR:")) {
      this.throwConnectionError(errorMessage, context);
    }
    if (errorMessage.startsWith("TEMPO_TIMEOUT_ERROR:")) {
      const tempoUrl = errorMessage.slice("TEMPO_TIMEOUT_ERROR:".length);
      this.logger.error(`Request to Tempo timed out at ${tempoUrl}`, {
        datasourceId: context.datasourceId,
        traceId: context.traceId,
      });
      throw new BadGatewayException(
        formatError(ERROR_MESSAGES.TEMPO_TIMEOUT_ERROR, tempoUrl),
      );
    }
    if (errorMessage.startsWith("TEMPO_AUTH_ERROR:")) {
      const parts = errorMessage.split(":");
      this.logger.error("Tempo authentication error", {
        status: parts[1],
        statusText: parts[2] || "Unauthorized",
        datasourceId: context.datasourceId,
        traceId: context.traceId,
      });
      throw new BadGatewayException(
        formatError(ERROR_MESSAGES.TEMPO_AUTHENTICATION_ERROR, datasource.url),
      );
    }
    if (errorMessage.startsWith("TEMPO_SERVICE_ERROR:")) {
      const parts = errorMessage.split(":");
      this.logger.error("Tempo service error", {
        status: parts[1],
        statusText: parts[2] || "Internal Server Error",
        datasourceId: context.datasourceId,
        traceId: context.traceId,
      });
      throw new BadGatewayException(
        formatError(ERROR_MESSAGES.TEMPO_SERVICE_ERROR, parts[1]),
      );
    }
    if (error instanceof InternalServerErrorException) {
      throw error;
    }

    this.logger.error("Error searching trace by ID", {
      error: errorMessage,
      errorStack: (error as Error).stack,
      ...context,
    });
    throw new InternalServerErrorException(
      formatError(ERROR_MESSAGES.TRACE_QUERY_FAILED),
    );
  }

  private static throwConnectionError(
    errorMessage: string,
    context: TraceQueryErrorContext,
  ): never {
    const payload = errorMessage.slice("TEMPO_CONNECTION_ERROR:".length);
    let tempoUrl = payload;
    let errorCode = "unknown";
    const lastColonIndex = payload.lastIndexOf(":");
    if (lastColonIndex > -1) {
      const possibleCode = payload.slice(lastColonIndex + 1);
      if (possibleCode) {
        tempoUrl = payload.slice(0, lastColonIndex);
        errorCode = possibleCode;
      }
    }
    this.logger.error(`Cannot connect to Tempo at ${tempoUrl}`, {
      errorCode,
      datasourceId: context.datasourceId,
      traceId: context.traceId,
    });
    throw new BadGatewayException(
      formatError(ERROR_MESSAGES.TEMPO_CONNECTION_ERROR, tempoUrl),
    );
  }

  private static getErrorMessage(error: unknown): string {
    if (error instanceof Error) return error.message;
    if (typeof error === "string") return error;
    return "Unknown error";
  }
}
