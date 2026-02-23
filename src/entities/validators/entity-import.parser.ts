import { Injectable, BadRequestException } from "@nestjs/common";
import * as yaml from "js-yaml";

@Injectable()
export class EntityImportParser {
  parse(yamlContent: string): unknown {
    try {
      return yaml.load(yamlContent);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      throw new BadRequestException(`Failed to parse YAML file: ${message}`);
    }
  }

  extractEntityArray(parsedYaml: unknown): unknown[] {
    if (!parsedYaml || typeof parsedYaml !== "object") {
      throw new BadRequestException("Invalid YAML format: expected an object");
    }

    const entitiesArray = Array.isArray(parsedYaml)
      ? parsedYaml
      : (parsedYaml as { entities?: unknown }).entities || [];

    if (!Array.isArray(entitiesArray)) {
      throw new BadRequestException(
        "Invalid YAML format: entities must be an array",
      );
    }

    return entitiesArray;
  }
}
