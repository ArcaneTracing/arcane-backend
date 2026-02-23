import { InternalServerErrorException } from "@nestjs/common";
import {
  ERROR_MESSAGES,
  formatError,
} from "src/common/constants/error-messages.constants";
import { Datasource } from "src/datasources/entities/datasource.entity";
import { CustomApiConfigDto } from "src/datasources/dto/custom-api-config.dto";

export type CustomApiConfig = CustomApiConfigDto;

export class CustomApiConfigMapper {
  static map(datasource: Datasource): CustomApiConfig {
    if (!datasource.config?.customApi) {
      throw new InternalServerErrorException(
        formatError(ERROR_MESSAGES.TRACE_QUERY_FAILED),
      );
    }

    const config = datasource.config.customApi as Partial<CustomApiConfig>;
    const baseUrl = config.baseUrl || datasource.url || "";

    return {
      baseUrl: baseUrl.replace(/\/$/, ""),
      endpoints: {
        search: {
          path: config.endpoints?.search?.path || "",
        },
        searchByTraceId: {
          path: config.endpoints?.searchByTraceId?.path || "",
        },
        attributeNames: config.endpoints?.attributeNames,
        attributeValues: config.endpoints?.attributeValues,
      },
      capabilities: {
        searchByQuery: config.capabilities?.searchByQuery !== false,
        searchByAttributes: config.capabilities?.searchByAttributes === true,
        filterByAttributeExists:
          config.capabilities?.filterByAttributeExists === true,
        getAttributeNames: config.capabilities?.getAttributeNames === true,
        getAttributeValues: config.capabilities?.getAttributeValues === true,
      },
      authentication: config.authentication,
      headers: config.headers || {},
    };
  }
}
