import { Injectable, BadRequestException } from "@nestjs/common";

export interface ConversationConfigImportItem {
  name: string;
  description?: string;
  stitchingAttributesName: string[];
}

@Injectable()
export class ConversationConfigImportValidator {
  validateItems(configsArray: unknown[]): ConversationConfigImportItem[] {
    this.validateNotEmpty(configsArray);

    return configsArray.map((configData: unknown) =>
      this.validateItem(configData),
    );
  }

  private validateNotEmpty(configsArray: unknown[]): void {
    if (configsArray.length === 0) {
      throw new BadRequestException(
        "YAML file contains no conversation configurations to import",
      );
    }
  }

  private validateItem(configData: unknown): ConversationConfigImportItem {
    if (!configData || typeof configData !== "object") {
      throw new BadRequestException(
        "Conversation configuration items must be objects",
      );
    }

    const config = configData as {
      name?: string;
      description?: string;
      stitchingAttributesName?: unknown;
    };

    if (!config.name) {
      throw new BadRequestException(
        "Conversation configuration name is required",
      );
    }

    if (!Array.isArray(config.stitchingAttributesName)) {
      throw new BadRequestException(
        "Conversation configuration stitchingAttributesName must be an array",
      );
    }

    return {
      name: config.name,
      description: config.description,
      stitchingAttributesName: config.stitchingAttributesName,
    };
  }
}
