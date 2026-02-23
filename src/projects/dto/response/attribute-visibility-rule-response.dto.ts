import { RoleResponseDto } from "src/rbac/dto/response/role-response.dto";

export class AttributeVisibilityRuleResponseDto {
  id: string;
  projectId: string;
  attributeName: string;
  hiddenRoleIds: string[];
  hiddenRoles: RoleResponseDto[];
  createdAt: Date;
  updatedAt: Date;
  createdById: string;
  updatedById?: string | null;
}
