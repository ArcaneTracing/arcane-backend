import { Role } from "../entities/role.entity";
import { RoleResponseDto } from "../dto/response/role-response.dto";

export class RoleMapper {
  static toEntity(params: {
    name: string;
    description?: string;
    permissions: string[];
    organisationId: string | null;
    projectId: string | null;
    isSystemRole: boolean;
    isInstanceLevel: boolean;
  }): Partial<Role> {
    return {
      name: params.name,
      description: params.description,
      permissions: params.permissions,
      organisationId: params.organisationId,
      projectId: params.projectId,
      isSystemRole: params.isSystemRole,
      isInstanceLevel: params.isInstanceLevel,
    };
  }

  static toDto(role: Role): RoleResponseDto {
    return {
      id: role.id,
      organisationId: role.organisationId,
      projectId: role.projectId,
      name: role.name,
      description: role.description,
      permissions: role.permissions,
      isSystemRole: role.isSystemRole,
      isInstanceLevel: role.isInstanceLevel,
      canDelete: !role.isSystemRole && role.organisationId !== null,
      createdAt: role.createdAt,
      updatedAt: role.updatedAt,
    };
  }
}
