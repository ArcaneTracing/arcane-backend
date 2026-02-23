import { Injectable, BadRequestException } from "@nestjs/common";
import { AdapterType } from "../dto/model-configuration-types";

@Injectable()
export class ModelConfigurationProviderConfigValidator {
  validate(adapter: AdapterType, config?: Record<string, unknown>): void {
    if (!config) {
      return;
    }

    switch (adapter) {
      case "azure":
        if (!config.endpoint || typeof config.endpoint !== "string") {
          throw new BadRequestException(
            "Azure adapter requires config.endpoint to be a string",
          );
        }
        break;

      case "bedrock":
        if (!config.region || typeof config.region !== "string") {
          throw new BadRequestException(
            "Bedrock adapter requires config.region to be a string",
          );
        }
        break;

      case "openai":
      case "anthropic":
      case "google-vertex-ai":
      case "google-ai-studio":
        break;

      default:
        break;
    }
  }
}
