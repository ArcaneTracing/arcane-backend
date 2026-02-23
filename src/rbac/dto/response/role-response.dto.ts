export class RoleResponseDto {
  id: string;
  organisationId: string | null;
  projectId: string | null;
  name: string;
  description?: string;
  permissions: string[];
  isSystemRole: boolean;
  isInstanceLevel: boolean;
  canDelete: boolean;
  createdAt: Date;
  updatedAt: Date;
}
