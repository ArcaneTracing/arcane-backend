import { Entity } from "../entities/entity.entity";
import { EntityResponseDto } from "../dto/response/entity-response.dto";

export class EntityMapper {
  static toResponseDto(entity: Entity): EntityResponseDto {
    return {
      id: entity.id,
      name: entity.name,
      description: entity.description,
      type: entity.type,
      matchingAttributeName: entity.matchingAttributeName,
      matchingPatternType: entity.matchingPatternType,
      matchingPattern: entity.matchingPattern,
      matchingValue: entity.matchingValue,
      entityType: entity.entityType,
      entityHighlights: entity.entityHighlights,
      messageMatching: entity.messageMatching ?? null,
      iconId: entity.iconId ?? null,
      externalId: entity.externalId ?? null,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
    };
  }
}
