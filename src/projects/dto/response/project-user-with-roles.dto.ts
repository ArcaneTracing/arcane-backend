import { RoleResponseDto } from "src/rbac/dto/response/role-response.dto";

export class ProjectUserWithRolesResponseDto {
  id: string;
  email: string;
  name: string;
  roles: RoleResponseDto[];
}
