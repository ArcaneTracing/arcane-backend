import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import {
  ERROR_MESSAGES,
  formatError,
} from "../../common/constants/error-messages.constants";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Entity } from "../entities/entity.entity";
import {
  CreateEntityRequestDto,
  UpdateEntityRequestDto,
} from "../dto/request/create-entity.dto";
import { EntityResponseDto } from "../dto/response/entity-response.dto";
import { EntityMessageResponseDto } from "../dto/response/entity-message-response.dto";
import { EntityMapper } from "../mappers";
import { AuditService } from "../../audit/audit.service";

@Injectable()
export class EntitiesService {
  private readonly logger = new Logger(EntitiesService.name);

  constructor(
    @InjectRepository(Entity)
    private readonly entityRepository: Repository<Entity>,
    private readonly auditService: AuditService,
  ) {}

  private async getByIdAndOrganisationOrThrow(
    organisationId: string,
    id: string,
  ): Promise<Entity> {
    const entity = await this.entityRepository.findOne({
      where: { id, organisationId },
    });

    if (!entity) {
      throw new NotFoundException(
        formatError(ERROR_MESSAGES.ENTITY_NOT_FOUND, id),
      );
    }

    return entity;
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

  async create(
    organisationId: string,
    userId: string,
    createEntityDto: CreateEntityRequestDto,
  ): Promise<EntityResponseDto> {
    this.logger.debug(
      `Creating entity for organisation ${organisationId} by user ${userId}`,
    );
    const entity = this.entityRepository.create({
      ...createEntityDto,
      organisationId,
      createdById: userId,
    });

    const savedEntity = await this.entityRepository.save(entity);
    this.logger.log(`Created entity ${savedEntity.id} for user ${userId}`);

    await this.auditService.record({
      action: "entity.created",
      actorId: userId,
      actorType: "user",
      resourceType: "entity",
      resourceId: savedEntity.id,
      organisationId,
      afterState: this.toAuditState(savedEntity),
      metadata: { creatorId: userId, organisationId },
    });

    return EntityMapper.toResponseDto(savedEntity);
  }

  async findOne(
    organisationId: string,
    id: string,
  ): Promise<EntityResponseDto> {
    this.logger.debug(
      `Finding entity ${id} for organisation ${organisationId}`,
    );
    const entity = await this.getByIdAndOrganisationOrThrow(organisationId, id);

    return EntityMapper.toResponseDto(entity);
  }

  async findAll(organisationId: string): Promise<EntityResponseDto[]> {
    this.logger.debug(
      `Finding all entities for organisation ${organisationId}`,
    );
    const entities = await this.entityRepository.find({
      where: { organisationId },
      order: { createdAt: "DESC" },
    });

    return entities.map((entity) => EntityMapper.toResponseDto(entity));
  }

  async update(
    organisationId: string,
    id: string,
    updateEntityDto: UpdateEntityRequestDto,
    userId?: string,
  ): Promise<EntityResponseDto> {
    this.logger.debug(
      `Updating entity ${id} for organisation ${organisationId}`,
    );
    const entity = await this.getByIdAndOrganisationOrThrow(organisationId, id);

    const beforeState = this.toAuditState(entity);

    Object.assign(entity, updateEntityDto);
    const updatedEntity = await this.entityRepository.save(entity);
    this.logger.log(`Updated entity ${id}`);

    await this.auditService.record({
      action: "entity.updated",
      actorId: userId,
      actorType: "user",
      resourceType: "entity",
      resourceId: id,
      organisationId,
      beforeState,
      afterState: this.toAuditState(updatedEntity),
      metadata: {
        changedFields: Object.keys(updateEntityDto),
        organisationId,
      },
    });

    return EntityMapper.toResponseDto(updatedEntity);
  }

  async remove(
    organisationId: string,
    id: string,
    userId?: string,
  ): Promise<EntityMessageResponseDto> {
    this.logger.debug(
      `Removing entity ${id} for organisation ${organisationId}`,
    );

    const entity = await this.getByIdAndOrganisationOrThrow(organisationId, id);

    const beforeState = this.toAuditState(entity);

    await this.entityRepository.remove(entity);
    this.logger.log(`Removed entity ${id}`);

    await this.auditService.record({
      action: "entity.deleted",
      actorId: userId,
      actorType: "user",
      resourceType: "entity",
      resourceId: id,
      organisationId,
      beforeState,
      afterState: null,
      metadata: { organisationId },
    });

    return { message: "Entity deleted successfully" };
  }
}
