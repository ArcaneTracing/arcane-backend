import { Injectable, BadRequestException } from "@nestjs/common";
import { CustomApiConfigDto } from "../dto/custom-api-config.dto";

@Injectable()
export class CustomApiConfigValidator {
  validate(
    url: string | undefined | null,
    config: Record<string, unknown> | null | undefined,
  ): void {
    if (!config?.customApi) {
      return;
    }

    const apiConfig = config.customApi as Partial<CustomApiConfigDto>;

    if (!apiConfig.baseUrl && !url) {
      throw new BadRequestException(
        "Custom API config must include baseUrl or datasource.url must be provided",
      );
    }

    if (!apiConfig.endpoints?.search?.path) {
      throw new BadRequestException(
        "Custom API config must include endpoints.search.path",
      );
    }

    if (!apiConfig.endpoints?.searchByTraceId?.path) {
      throw new BadRequestException(
        "Custom API config must include endpoints.searchByTraceId.path",
      );
    }

    if (!apiConfig.endpoints.searchByTraceId.path.includes("{traceId}")) {
      throw new BadRequestException(
        "Custom API endpoints.searchByTraceId.path must contain {traceId} placeholder",
      );
    }

    if (
      apiConfig.capabilities?.getAttributeNames &&
      !apiConfig.endpoints?.attributeNames?.path
    ) {
      throw new BadRequestException(
        "Custom API config must include endpoints.attributeNames.path when getAttributeNames capability is enabled",
      );
    }

    if (apiConfig.capabilities?.getAttributeValues) {
      if (!apiConfig.endpoints?.attributeValues?.path) {
        throw new BadRequestException(
          "Custom API config must include endpoints.attributeValues.path when getAttributeValues capability is enabled",
        );
      }
      if (
        !apiConfig.endpoints.attributeValues.path.includes("{attributeName}")
      ) {
        throw new BadRequestException(
          "Custom API endpoints.attributeValues.path must contain {attributeName} placeholder",
        );
      }
    }
  }
}
