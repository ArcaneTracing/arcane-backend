import { RoleResponseDto } from "../../../rbac/dto/response/role-response.dto";

export class OrganisationUserWithRoleResponseDto {
  id: string;
  email: string;
  name: string;
  role: RoleResponseDto | null;
}
