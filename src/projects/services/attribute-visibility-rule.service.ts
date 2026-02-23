import {
  Injectable,
  ConflictException,
  NotFoundException,
  ForbiddenException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { In, Repository } from "typeorm";
import { AttributeVisibilityRule } from "../entities/attribute-visibility-rule.entity";
import { Role } from "../../rbac/entities/role.entity";
import { AuditService } from "../../audit/audit.service";
import { CreateAttributeVisibilityRuleDto } from "../dto/request/create-attribute-visibility-rule.dto";
import { AddRolesToVisibilityRuleDto } from "../dto/request/add-roles-to-visibility-rule.dto";
import { RemoveRolesFromVisibilityRuleDto } from "../dto/request/remove-roles-from-visibility-rule.dto";
import { AttributeVisibilityRuleResponseDto } from "../dto/response/attribute-visibility-rule-response.dto";
import { AttributeVisibilityRuleMapper } from "../mappers/attribute-visibility-rule.mapper";
import {
  ERROR_MESSAGES,
  formatError,
} from "../../common/constants/error-messages.constants";

@Injectable()
export class AttributeVisibilityRuleService {
  constructor(
    @InjectRepository(AttributeVisibilityRule)
    private readonly repository: Repository<AttributeVisibilityRule>,
    @InjectRepository(Role)
    private readonly roleRepository: Repository<Role>,
    private readonly auditService: AuditService,
  ) {}

  async create(
    projectId: string,
    organisationId: string,
    dto: CreateAttributeVisibilityRuleDto,
    userId: string,
  ): Promise<AttributeVisibilityRuleResponseDto> {
    const existing = await this.repository.findOne({
      where: { projectId, attributeName: dto.attributeName },
    });

    if (existing) {
      throw new ConflictException(
        formatError(
          ERROR_MESSAGES.ATTRIBUTE_VISIBILITY_RULE_ALREADY_EXISTS,
          dto.attributeName,
        ),
      );
    }

    const entity = this.repository.create({
      projectId,
      attributeName: dto.attributeName,
      hiddenRoleIds: dto.hiddenRoleIds,
      createdById: userId,
    });

    const saved = await this.repository.save(entity);

    await this.auditService.record({
      action: "attribute-visibility-rule.created",
      actorId: userId,
      actorType: "user",
      resourceType: "attribute-visibility-rule",
      resourceId: saved.id,
      organisationId,
      projectId,
      afterState: this.toAuditState(saved),
      metadata: {
        attributeName: dto.attributeName,
        hiddenRoleIds: dto.hiddenRoleIds,
      },
    });

    return await this.toDtoWithRoles(saved);
  }

  async findAll(
    projectId: string,
  ): Promise<AttributeVisibilityRuleResponseDto[]> {
    const entities = await this.repository.find({
      where: { projectId },
      order: { attributeName: "ASC" },
    });
    const allRoleIds = [...new Set(entities.flatMap((e) => e.hiddenRoleIds))];
    const roles =
      allRoleIds.length > 0
        ? await this.roleRepository.find({ where: { id: In(allRoleIds) } })
        : [];
    return entities.map((e) => AttributeVisibilityRuleMapper.toDto(e, roles));
  }

  async findOne(id: string): Promise<AttributeVisibilityRule> {
    const entity = await this.repository.findOne({ where: { id } });
    if (!entity) {
      throw new NotFoundException(
        formatError(ERROR_MESSAGES.ATTRIBUTE_VISIBILITY_RULE_NOT_FOUND, id),
      );
    }
    return entity;
  }

  async addRoles(
    projectId: string,
    organisationId: string,
    id: string,
    dto: AddRolesToVisibilityRuleDto,
    userId: string,
  ): Promise<AttributeVisibilityRuleResponseDto> {
    const entity = await this.findOne(id);

    if (entity.projectId !== projectId) {
      throw new ForbiddenException(
        formatError(
          ERROR_MESSAGES.ATTRIBUTE_VISIBILITY_RULE_DOES_NOT_BELONG_TO_PROJECT,
        ),
      );
    }

    const beforeState = this.toAuditState(entity);
    const existingRoleIds = new Set(entity.hiddenRoleIds);
    const newRoleIds = dto.roleIds.filter((rid) => !existingRoleIds.has(rid));

    if (newRoleIds.length === 0) {
      return await this.toDtoWithRoles(entity);
    }

    entity.hiddenRoleIds = [...entity.hiddenRoleIds, ...newRoleIds];
    entity.updatedById = userId;
    const updated = await this.repository.save(entity);

    await this.auditService.record({
      action: "attribute-visibility-rule.roles-added",
      actorId: userId,
      actorType: "user",
      resourceType: "attribute-visibility-rule",
      resourceId: id,
      organisationId,
      projectId,
      beforeState,
      afterState: this.toAuditState(updated),
      metadata: { addedRoleIds: newRoleIds },
    });

    return await this.toDtoWithRoles(updated);
  }

  async removeRoles(
    projectId: string,
    organisationId: string,
    id: string,
    dto: RemoveRolesFromVisibilityRuleDto,
    userId: string,
  ): Promise<AttributeVisibilityRuleResponseDto> {
    const entity = await this.findOne(id);

    if (entity.projectId !== projectId) {
      throw new ForbiddenException(
        formatError(
          ERROR_MESSAGES.ATTRIBUTE_VISIBILITY_RULE_DOES_NOT_BELONG_TO_PROJECT,
        ),
      );
    }

    const beforeState = this.toAuditState(entity);
    const roleIdsToRemove = new Set(dto.roleIds);
    entity.hiddenRoleIds = entity.hiddenRoleIds.filter(
      (rid) => !roleIdsToRemove.has(rid),
    );
    entity.updatedById = userId;
    const updated = await this.repository.save(entity);

    await this.auditService.record({
      action: "attribute-visibility-rule.roles-removed",
      actorId: userId,
      actorType: "user",
      resourceType: "attribute-visibility-rule",
      resourceId: id,
      organisationId,
      projectId,
      beforeState,
      afterState: this.toAuditState(updated),
      metadata: { removedRoleIds: dto.roleIds },
    });

    return await this.toDtoWithRoles(updated);
  }

  async delete(
    projectId: string,
    organisationId: string,
    id: string,
    userId: string,
  ): Promise<void> {
    const entity = await this.findOne(id);

    if (entity.projectId !== projectId) {
      throw new ForbiddenException(
        formatError(
          ERROR_MESSAGES.ATTRIBUTE_VISIBILITY_RULE_DOES_NOT_BELONG_TO_PROJECT,
        ),
      );
    }

    const beforeState = this.toAuditState(entity);

    await this.repository.remove(entity);

    await this.auditService.record({
      action: "attribute-visibility-rule.deleted",
      actorId: userId,
      actorType: "user",
      resourceType: "attribute-visibility-rule",
      resourceId: id,
      organisationId,
      projectId,
      beforeState,
      afterState: null,
      metadata: {},
    });
  }

  async getVisibilityRulesForProject(
    projectId: string,
  ): Promise<AttributeVisibilityRule[]> {
    return this.repository.find({
      where: { projectId },
    });
  }

  private async toDtoWithRoles(
    entity: AttributeVisibilityRule,
  ): Promise<AttributeVisibilityRuleResponseDto> {
    const roles =
      entity.hiddenRoleIds.length > 0
        ? await this.roleRepository.find({
            where: { id: In(entity.hiddenRoleIds) },
          })
        : [];
    return AttributeVisibilityRuleMapper.toDto(entity, roles);
  }

  private toAuditState(
    entity: AttributeVisibilityRule,
  ): Record<string, unknown> {
    return {
      id: entity.id,
      projectId: entity.projectId,
      attributeName: entity.attributeName,
      hiddenRoleIds: entity.hiddenRoleIds,
    };
  }
}
