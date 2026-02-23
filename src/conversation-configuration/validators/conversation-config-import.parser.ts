import { Injectable, BadRequestException } from "@nestjs/common";
import * as yaml from "js-yaml";

@Injectable()
export class ConversationConfigImportParser {
  parse(yamlContent: string): unknown {
    try {
      return yaml.load(yamlContent);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      throw new BadRequestException(`Failed to parse YAML file: ${message}`);
    }
  }

  extractConfigArray(parsedYaml: unknown): unknown[] {
    if (!parsedYaml || typeof parsedYaml !== "object") {
      throw new BadRequestException("Invalid YAML format: expected an object");
    }

    const configsArray = Array.isArray(parsedYaml)
      ? parsedYaml
      : (parsedYaml as { conversationConfigurations?: unknown })
          .conversationConfigurations || [];

    if (!Array.isArray(configsArray)) {
      throw new BadRequestException(
        "Invalid YAML format: conversationConfigurations must be an array",
      );
    }

    return configsArray;
  }
}
