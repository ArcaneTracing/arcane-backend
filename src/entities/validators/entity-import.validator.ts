import { Injectable, BadRequestException } from "@nestjs/common";

export interface EntityImportItem {
  name: string;
  description?: string;
  type: string;
  matchingAttributeName: string;
  matchingPatternType: string;
  matchingPattern?: string | null;
  matchingValue?: string | null;
  entityType: string;
  entityHighlights?: unknown[];
  messageMatching?: unknown;
  iconId?: string | null;
  externalId?: string | null;
}

@Injectable()
export class EntityImportValidator {
  validateItems(entitiesArray: unknown[]): EntityImportItem[] {
    this.validateNotEmpty(entitiesArray);
    return entitiesArray.map((entityData: unknown) =>
      this.validateItem(entityData),
    );
  }

  private validateNotEmpty(entitiesArray: unknown[]): void {
    if (entitiesArray.length === 0) {
      throw new BadRequestException("YAML file contains no entities to import");
    }
  }

  private validateItem(entityData: unknown): EntityImportItem {
    if (!entityData || typeof entityData !== "object") {
      throw new BadRequestException("Entity items must be objects");
    }

    const entity = entityData as {
      name?: string;
      description?: string;
      type?: string;
      matchingAttributeName?: string;
      matchingPatternType?: string;
      matchingPattern?: string | null;
      matchingValue?: string | null;
      entityType?: string;
      entityHighlights?: unknown[];
      messageMatching?: unknown;
      iconId?: string | null;
      externalId?: string | null;
    };

    if (!entity.name) {
      throw new BadRequestException("Entity name is required");
    }
    if (!entity.entityType) {
      throw new BadRequestException("Entity entityType is required");
    }
    const isCustom = entity.entityType === "custom";
    if (isCustom && !entity.type) {
      throw new BadRequestException(
        "Entity type is required for custom entityType",
      );
    }
    if (isCustom && !entity.iconId) {
      throw new BadRequestException(
        "Entity iconId is required for custom entityType",
      );
    }
    if (!entity.matchingAttributeName) {
      throw new BadRequestException("Entity matchingAttributeName is required");
    }
    if (!entity.matchingPatternType) {
      throw new BadRequestException("Entity matchingPatternType is required");
    }

    const type = entity.type ?? (isCustom ? undefined : entity.entityType);
    if (!type) {
      throw new BadRequestException("Entity type is required");
    }

    return {
      name: entity.name,
      description: entity.description,
      type,
      matchingAttributeName: entity.matchingAttributeName,
      matchingPatternType: entity.matchingPatternType,
      matchingPattern: entity.matchingPattern,
      matchingValue: entity.matchingValue,
      entityType: entity.entityType,
      entityHighlights: entity.entityHighlights,
      messageMatching: entity.messageMatching ?? null,
      iconId: entity.iconId ?? null,
      externalId: entity.externalId ?? null,
    };
  }
}
