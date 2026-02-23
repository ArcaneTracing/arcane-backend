export type RoleScope = "instance" | "organisation" | "project";

export interface RoleScopeParams {
  organisationId: string | null;
  projectId: string | null;
}
export function getRoleScope(role: RoleScopeParams): RoleScope {
  if (role.organisationId === null && role.projectId === null) {
    return "instance";
  }
  if (role.organisationId !== null && role.projectId === null) {
    return "organisation";
  }
  return "project";
}
export function isInstanceScope(role: RoleScopeParams): boolean {
  return role.organisationId === null && role.projectId === null;
}
export function isOrganisationScope(role: RoleScopeParams): boolean {
  return role.organisationId !== null && role.projectId === null;
}
export function isProjectScope(role: RoleScopeParams): boolean {
  return role.organisationId !== null && role.projectId !== null;
}
