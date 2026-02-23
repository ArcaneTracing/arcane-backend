import { Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import * as yaml from "js-yaml";
import { Entity } from "../entities/entity.entity";
import { EntityResponseDto } from "../dto/response/entity-response.dto";
import { EntityMapper } from "../mappers";
import { EntityImportParser } from "../validators/entity-import.parser";
import { EntityImportValidator } from "../validators/entity-import.validator";
import { AuditService } from "../../audit/audit.service";

@Injectable()
export class EntitiesYamlService {
  private readonly logger = new Logger(EntitiesYamlService.name);

  constructor(
    @InjectRepository(Entity)
    private readonly entityRepository: Repository<Entity>,
    private readonly importParser: EntityImportParser,
    private readonly importValidator: EntityImportValidator,
    private readonly auditService: AuditService,
  ) {}

  async exportToYaml(organisationId: string): Promise<string> {
    this.logger.debug(
      `Exporting entities to YAML for organisation ${organisationId}`,
    );

    const entities = await this.entityRepository.find({
      where: { organisationId },
      order: { createdAt: "DESC" },
    });

    const entitiesForExport = entities.map((entity) => {
      const exportEntity: Record<string, unknown> = {
        name: entity.name,
        description: entity.description,
        type: entity.type,
        matchingAttributeName: entity.matchingAttributeName,
        matchingPatternType: entity.matchingPatternType,
        matchingPattern: entity.matchingPattern,
        matchingValue: entity.matchingValue,
        entityType: entity.entityType,
        entityHighlights: entity.entityHighlights,
        messageMatching: entity.messageMatching,
        iconId: entity.iconId,
        externalId: entity.externalId,
      };

      Object.keys(exportEntity).forEach((key) => {
        if (exportEntity[key] === null || exportEntity[key] === undefined) {
          delete exportEntity[key];
        }
      });

      return exportEntity;
    });

    const yamlData = {
      version: "1.0",
      entities: entitiesForExport,
    };

    return yaml.dump(yamlData, {
      indent: 2,
      lineWidth: -1,
      noRefs: true,
      sortKeys: false,
    });
  }

  async importFromYaml(
    organisationId: string,
    userId: string,
    yamlContent: string,
  ): Promise<EntityResponseDto[]> {
    this.logger.debug(
      `Importing entities from YAML for organisation ${organisationId}`,
    );

    const parsedYaml = this.importParser.parse(yamlContent);
    const entitiesArray = this.importParser.extractEntityArray(parsedYaml);
    const validatedEntities = this.importValidator.validateItems(entitiesArray);

    return this.entityRepository.manager.transaction(async (manager) => {
      const entityRepo = manager.getRepository(Entity);
      const savedEntities: Entity[] = [];

      for (const entityData of validatedEntities) {
        let entity: Entity;

        if (entityData.externalId) {
          const existing = await entityRepo.findOne({
            where: {
              organisationId,
              externalId: entityData.externalId,
            },
          });

          if (existing) {
            const beforeState = this.toAuditState(existing);
            Object.assign(existing, {
              name: entityData.name,
              description: entityData.description,
              type: entityData.type,
              matchingAttributeName: entityData.matchingAttributeName,
              matchingPatternType: entityData.matchingPatternType,
              matchingPattern: entityData.matchingPattern,
              matchingValue: entityData.matchingValue,
              entityType: entityData.entityType,
              entityHighlights: entityData.entityHighlights,
              messageMatching: entityData.messageMatching,
              iconId: entityData.iconId,
              externalId: entityData.externalId,
            });
            entity = await entityRepo.save(existing);

            await this.auditService.record({
              action: "entity.updated",
              actorId: userId,
              actorType: "user",
              resourceType: "entity",
              resourceId: entity.id,
              organisationId,
              beforeState,
              afterState: this.toAuditState(entity),
              metadata: {
                changedFields: Object.keys(entityData),
                organisationId,
                updatedViaImport: true,
                externalId: entityData.externalId,
              },
            });
          } else {
            entity = entityRepo.create({
              ...entityData,
              organisationId,
              createdById: userId,
            } as Entity);
            entity = await entityRepo.save(entity);

            await this.auditService.record({
              action: "entity.created",
              actorId: userId,
              actorType: "user",
              resourceType: "entity",
              resourceId: entity.id,
              organisationId,
              afterState: this.toAuditState(entity),
              metadata: {
                creatorId: userId,
                organisationId,
                importedViaImport: true,
                externalId: entityData.externalId,
              },
            });
          }
        } else {
          entity = entityRepo.create({
            ...entityData,
            organisationId,
            createdById: userId,
          } as Entity);
          entity = await entityRepo.save(entity);

          await this.auditService.record({
            action: "entity.created",
            actorId: userId,
            actorType: "user",
            resourceType: "entity",
            resourceId: entity.id,
            organisationId,
            afterState: this.toAuditState(entity),
            metadata: {
              creatorId: userId,
              organisationId,
              importedViaImport: true,
            },
          });
        }

        savedEntities.push(entity);
      }

      this.logger.log(
        `Successfully imported ${savedEntities.length} entities for user ${userId}`,
      );

      await this.auditService.record({
        action: "entities.imported",
        actorId: userId,
        actorType: "user",
        resourceType: "entity",
        resourceId: organisationId,
        organisationId,
        afterState: {
          count: savedEntities.length,
          entityIds: savedEntities.map((e) => e.id).slice(0, 50),
        },
        metadata: {
          organisationId,
          importedById: userId,
          count: savedEntities.length,
        },
      });

      return savedEntities.map((e) => EntityMapper.toResponseDto(e));
    });
  }

  private toAuditState(e: Entity): Record<string, unknown> {
    return {
      id: e.id,
      name: e.name,
      description: e.description ?? null,
      type: e.type,
      entityType: e.entityType,
      matchingAttributeName: e.matchingAttributeName,
      matchingPatternType: e.matchingPatternType,
      iconId: e.iconId ?? null,
      externalId: e.externalId ?? null,
      organisationId: e.organisationId,
      createdById: e.createdById,
    };
  }
}
