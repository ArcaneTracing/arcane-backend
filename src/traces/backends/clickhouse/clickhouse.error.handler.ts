import {
  Logger,
  InternalServerErrorException,
  NotFoundException,
} from "@nestjs/common";
import {
  ERROR_MESSAGES,
  formatError,
} from "src/common/constants/error-messages.constants";

export interface ClickHouseErrorContext {
  datasourceId: string;
  [key: string]: any;
}

export interface ClickHouseErrorOptions {
  traceId?: string;
  isSearch?: boolean;
  isGetAttributeNames?: boolean;
  isGetAttributeValues?: boolean;
  tableName?: string;
}

export class ClickHouseErrorHandler {
  private static readonly logger = new Logger(ClickHouseErrorHandler.name);

  static handle(
    error: unknown,
    clickHouseUrl: string,
    context: ClickHouseErrorContext,
    options?: ClickHouseErrorOptions,
  ): never {
    if (error instanceof NotFoundException) {
      throw error;
    }

    const errorMessage = this.getErrorMessage(error);
    const errorStack = error instanceof Error ? error.stack : undefined;
    const errorCode = (error as any).code;
    const errorStatus = (error as any).status || (error as any).statusCode;
    const errorContext = { ...context, errorMessage, errorCode, errorStatus };

    this.logger.error("Error in ClickHouse request", errorContext);

    const authOrAuthzError = this.checkAuthOrAuthzError(
      errorStatus,
      errorMessage,
    );
    if (authOrAuthzError) throw authOrAuthzError;

    const tableError = this.checkTableNotFoundError(
      errorMessage,
      options?.tableName,
    );
    if (tableError) throw tableError;

    const connectionError = this.checkConnectionError(
      errorCode,
      errorMessage,
      clickHouseUrl,
    );
    if (connectionError) throw connectionError;

    const timeoutError = this.checkTimeoutError(errorCode, errorMessage);
    if (timeoutError) throw timeoutError;

    const traceNotFoundError = this.checkTraceNotFoundError(
      errorMessage,
      options?.traceId,
    );
    if (traceNotFoundError) throw traceNotFoundError;

    const queryError = this.checkQueryError(
      errorMessage,
      errorContext,
      errorStack,
    );
    if (queryError) throw queryError;

    const dbError = this.checkDatabaseError(errorMessage);
    if (dbError) throw dbError;

    this.logger.error("Unexpected error in ClickHouse request", {
      ...errorContext,
      errorStack,
    });
    const errorMessageConstant = options?.isSearch
      ? ERROR_MESSAGES.TRACE_SEARCH_FAILED
      : ERROR_MESSAGES.TRACE_QUERY_FAILED;
    throw new InternalServerErrorException(formatError(errorMessageConstant));
  }

  private static getErrorMessage(error: unknown): string {
    if (error instanceof Error) return error.message;
    if (typeof error === "string") return error;
    return "Unknown error";
  }

  private static checkAuthOrAuthzError(
    errorStatus: number,
    errorMessage: string,
  ): InternalServerErrorException | null {
    if (errorStatus === 401)
      return new InternalServerErrorException(
        formatError(ERROR_MESSAGES.CLICKHOUSE_AUTHENTICATION_ERROR),
      );
    if (errorStatus === 403)
      return new InternalServerErrorException(
        formatError(ERROR_MESSAGES.CLICKHOUSE_AUTHORIZATION_ERROR),
      );
    const lower = errorMessage.toLowerCase();
    if (lower.includes("authentication failed"))
      return new InternalServerErrorException(
        formatError(ERROR_MESSAGES.CLICKHOUSE_AUTHENTICATION_ERROR),
      );
    if (
      lower.includes("access denied") ||
      lower.includes("not enough privileges")
    )
      return new InternalServerErrorException(
        formatError(ERROR_MESSAGES.CLICKHOUSE_AUTHORIZATION_ERROR),
      );
    return null;
  }

  private static checkTableNotFoundError(
    errorMessage: string,
    tableName?: string,
  ): InternalServerErrorException | null {
    if (!tableName) return null;
    if (
      errorMessage.includes("doesn't exist") ||
      (errorMessage.includes("Table") && errorMessage.includes("doesn't exist"))
    ) {
      return new InternalServerErrorException(
        formatError(ERROR_MESSAGES.CLICKHOUSE_TABLE_NOT_FOUND, tableName),
      );
    }
    return null;
  }

  private static checkConnectionError(
    errorCode: string,
    errorMessage: string,
    clickHouseUrl: string,
  ): InternalServerErrorException | null {
    if (errorCode === "ECONNREFUSED" || errorCode === "ENOTFOUND") {
      return new InternalServerErrorException(
        formatError(
          ERROR_MESSAGES.CLICKHOUSE_CONNECTION_ERROR,
          clickHouseUrl,
          errorCode || errorMessage,
        ),
      );
    }
    return null;
  }

  private static checkTimeoutError(
    errorCode: string,
    errorMessage: string,
  ): InternalServerErrorException | null {
    if (
      errorCode === "ETIMEDOUT" ||
      errorCode === "ECONNABORTED" ||
      errorMessage.includes("timeout") ||
      errorMessage.includes("Timeout")
    ) {
      return new InternalServerErrorException(
        formatError(ERROR_MESSAGES.CLICKHOUSE_TIMEOUT_ERROR),
      );
    }
    return null;
  }

  private static checkTraceNotFoundError(
    errorMessage: string,
    traceId?: string,
  ): Error | null {
    if (
      (errorMessage.includes("Trace not found") ||
        (traceId && errorMessage.includes("not found"))) &&
      traceId
    ) {
      return new Error(`TRACE_NOT_FOUND:${traceId}`);
    }
    return null;
  }

  private static checkQueryError(
    errorMessage: string,
    errorContext: object,
    errorStack?: string,
  ): InternalServerErrorException | null {
    if (
      errorMessage.includes("Syntax error") ||
      errorMessage.includes("syntax error") ||
      errorMessage.includes("DB::Exception")
    ) {
      this.logger.error("ClickHouse query error", {
        ...errorContext,
        errorStack,
      });
      return new InternalServerErrorException(
        formatError(ERROR_MESSAGES.CLICKHOUSE_QUERY_ERROR, errorMessage),
      );
    }
    return null;
  }

  private static checkDatabaseError(
    errorMessage: string,
  ): InternalServerErrorException | null {
    if (
      errorMessage.includes("Database") &&
      (errorMessage.includes("doesn't exist") ||
        errorMessage.includes("not found"))
    ) {
      return new InternalServerErrorException(
        formatError(ERROR_MESSAGES.CLICKHOUSE_DATABASE_ERROR, errorMessage),
      );
    }
    return null;
  }
}
