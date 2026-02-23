import { Injectable } from "@nestjs/common";
import { EntityManager } from "typeorm";
import { RbacService } from "../../rbac/services/rbac.service";
import { RoleResponseDto } from "../../rbac/dto/response/role-response.dto";
import { RoleMapper } from "../../rbac/mappers/role.mapper";
import { RbacAssignmentService } from "../../rbac/services/rbac-assignment.service";
import { RbacSeedService } from "../../rbac/services/rbac-seed.service";
import { AuditService } from "../../audit/audit.service";

@Injectable()
export class OrganisationRbacService {
  constructor(
    private readonly rbacService: RbacService,
    private readonly assignmentService: RbacAssignmentService,
    private readonly seedService: RbacSeedService,
    private readonly auditService: AuditService,
  ) {}

  async seedOrganisationRoles(
    organisationId: string,
    entityManager?: EntityManager,
  ) {
    return this.seedService.seedOrganisationRoles(
      organisationId,
      entityManager,
    );
  }

  async getDefaultOrganisationRole(organisationId: string) {
    return this.rbacService.getDefaultOrganisationRole(organisationId);
  }

  async getUserOrganisationRole(organisationId: string, userId: string) {
    return this.rbacService.getUserOrganisationRole(organisationId, userId);
  }

  async removeRole(userId: string, roleId: string) {
    return this.assignmentService.removeRole(userId, roleId);
  }

  async assignRole(
    organisationId: string,
    userId: string,
    roleId: string,
    entityManager?: EntityManager,
  ): Promise<void> {
    const existingRole = await this.rbacService.getUserOrganisationRole(
      organisationId,
      userId,
    );
    const beforeState = {
      roleId: existingRole?.id || null,
      roleName: existingRole?.name || null,
    };

    if (existingRole && existingRole.id !== roleId) {
      await this.assignmentService.removeRole(
        userId,
        existingRole.id,
        entityManager,
      );
    }

    await this.assignmentService.assignRole(userId, roleId, entityManager);

    const newRole = await this.rbacService.getUserOrganisationRole(
      organisationId,
      userId,
    );

    await this.auditService.record({
      action: "organisation.user.role.assigned",
      actorType: "user",
      resourceType: "organisation_role_assignment",
      resourceId: userId,
      organisationId,
      beforeState,
      afterState: {
        roleId: newRole?.id || roleId,
        roleName: newRole?.name || null,
      },
      metadata: {
        organisationId,
        userId,
        previousRoleId: existingRole?.id || null,
        newRoleId: roleId,
      },
    });
  }

  async getUserRole(
    organisationId: string,
    userId: string,
  ): Promise<RoleResponseDto | null> {
    const role = await this.rbacService.getUserOrganisationRole(
      organisationId,
      userId,
    );
    return role ? RoleMapper.toDto(role) : null;
  }
}
