import { AttributeVisibilityRule } from "../entities/attribute-visibility-rule.entity";
import { AttributeVisibilityRuleResponseDto } from "../dto/response/attribute-visibility-rule-response.dto";
import { Role } from "../../rbac/entities/role.entity";
import { RoleMapper } from "../../rbac/mappers/role.mapper";

export class AttributeVisibilityRuleMapper {
  static toDto(
    entity: AttributeVisibilityRule,
    roles: Role[] = [],
  ): AttributeVisibilityRuleResponseDto {
    const hiddenRoles = roles
      .filter((r) => entity.hiddenRoleIds.includes(r.id))
      .map((r) => RoleMapper.toDto(r));
    return {
      id: entity.id,
      projectId: entity.projectId,
      attributeName: entity.attributeName,
      hiddenRoleIds: entity.hiddenRoleIds,
      hiddenRoles,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
      createdById: entity.createdById,
      updatedById: entity.updatedById,
    };
  }
}
