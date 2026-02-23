import { ForbiddenException, Injectable, Logger } from "@nestjs/common";
import {
  ERROR_MESSAGES,
  formatError,
} from "../../common/constants/error-messages.constants";
import { Role } from "../entities/role.entity";
import { INSTANCE_PERMISSIONS } from "../permissions/permissions";
import { RbacService } from "./rbac.service";
import { RbacMembershipService } from "./rbac-membership.service";
import { LicenseService } from "../../license/license.service";

@Injectable()
export class RbacPermissionService {
  private readonly logger = new Logger(RbacPermissionService.name);

  constructor(
    private readonly rbacService: RbacService,
    private readonly membershipService: RbacMembershipService,
    private readonly licenseService: LicenseService,
  ) {}

  aggregatePermissions(roles: Role[]): string[] {
    const permissionSet = new Set<string>();

    for (const role of roles) {
      if (
        role.permissions.length === 1 &&
        role.permissions[0] === INSTANCE_PERMISSIONS.ALL
      ) {
        this.logger.debug(
          `[aggregatePermissions] Found wildcard permission "*" in role ${role.name}, granting all permissions`,
        );
        return [INSTANCE_PERMISSIONS.ALL];
      }

      for (const permission of role.permissions) {
        permissionSet.add(permission);
      }
    }

    const permissions = Array.from(permissionSet);
    this.logger.debug(
      `[aggregatePermissions] Aggregated permissions: ${JSON.stringify(permissions)}`,
    );
    return permissions;
  }

  hasPermission(roles: Role[], permission: string): boolean {
    const permissions = this.aggregatePermissions(roles);

    if (permissions.includes(INSTANCE_PERMISSIONS.ALL)) {
      this.logger.debug(
        `[hasPermission] Wildcard permission "*", granting access`,
      );
      return true;
    }

    return permissions.includes(permission);
  }

  async hasPermissionForUser(
    userId: string,
    permission: string,
    organisationId?: string,
    projectId?: string,
  ): Promise<boolean> {
    this.logger.debug(
      `[hasPermission] Checking permission "${permission}" for user ${userId} (org: ${organisationId}, project: ${projectId})`,
    );

    let roles = await this.rbacService.getUserRoles(
      userId,
      organisationId,
      projectId,
    );

    if (organisationId && !projectId) {
      const projectRoles =
        await this.rbacService.getUserProjectRolesForOrganisation(
          organisationId,
          userId,
        );
      roles = [...roles, ...projectRoles];
      this.logger.debug(
        `[hasPermission] Added ${projectRoles.length} project roles for org-level permission check`,
      );
    }

    const hasPermission = this.hasPermission(roles, permission);
    this.logger.debug(
      `[hasPermission] User ${userId} ${hasPermission ? "HAS" : "DOES NOT HAVE"} permission "${permission}"`,
    );
    return hasPermission;
  }

  async checkPermission(
    userId: string,
    permission: string,
    organisationId?: string,
    projectId?: string,
  ): Promise<void> {
    this.logger.debug(
      `[checkPermission] Checking permission "${permission}" for user ${userId} (org: ${organisationId}, project: ${projectId})`,
    );

    const hasPermission = await this.hasPermissionForUser(
      userId,
      permission,
      organisationId,
      projectId,
    );

    if (hasPermission) {
      this.logger.debug(
        `[checkPermission] User ${userId} has permission "${permission}", allowing access`,
      );
      return;
    }

    this.logger.warn(
      `[checkPermission] User ${userId} does not have permission "${permission}"`,
    );
    throw new ForbiddenException(
      formatError(ERROR_MESSAGES.USER_DOES_NOT_HAVE_PERMISSION, permission),
    );
  }

  async getUserPermissions(
    userId: string,
    organisationId?: string,
    projectId?: string,
  ): Promise<string[]> {
    const roles = await this.rbacService.getUserRoles(
      userId,
      organisationId,
      projectId,
    );
    return this.aggregatePermissions(roles);
  }

  async getUserPermissionsWithContext(
    userId: string,
    organisationId?: string,
    projectId?: string,
  ): Promise<{
    instance: string[];
    organisation: string[];
    project: string[];
    all: string[];
    features?: { enterprise: boolean };
  }> {
    let roles = await this.rbacService.getUserRoles(
      userId,
      organisationId,
      projectId,
    );

    if (organisationId && !projectId) {
      const projectRoles =
        await this.rbacService.getUserProjectRolesForOrganisation(
          organisationId,
          userId,
        );
      roles = [...roles, ...projectRoles];
    }

    const permissions = this.getPermissionsWithContext(
      roles,
      organisationId,
      projectId,
    );
    return {
      ...permissions,
      features: {
        enterprise: this.licenseService.isEnterpriseLicensed(),
      },
    };
  }

  async getAllUserPermissions(userId: string): Promise<{
    instance: string[];
    organisations: Record<string, string[]>;
    projects: Record<string, string[]>;
  }> {
    const instanceRole = await this.rbacService.getUserInstanceRole(userId);
    const instancePermissions = instanceRole
      ? this.aggregatePermissions([instanceRole])
      : [];

    const organisationIds =
      await this.membershipService.getUserOrganisationIds(userId);
    const organisationPermissions: Record<string, string[]> = {};
    for (const orgId of organisationIds) {
      const orgRole = await this.rbacService.getUserOrganisationRole(
        orgId,
        userId,
      );
      organisationPermissions[orgId] = orgRole
        ? this.aggregatePermissions([orgRole])
        : [];
    }

    const projectIds = await this.membershipService.getUserProjectIds(userId);
    const projectPermissions: Record<string, string[]> = {};
    for (const projectId of projectIds) {
      const projectRole = await this.rbacService.getUserProjectRole(
        projectId,
        userId,
      );
      projectPermissions[projectId] = projectRole
        ? this.aggregatePermissions([projectRole])
        : [];
    }

    return {
      instance: instancePermissions,
      organisations: organisationPermissions,
      projects: projectPermissions,
    };
  }

  getPermissionsWithContext(
    roles: Role[],
    organisationId?: string,
    projectId?: string,
  ): {
    instance: string[];
    organisation: string[];
    project: string[];
    all: string[];
  } {
    const instanceRole = roles.find(
      (role) =>
        role.isInstanceLevel &&
        role.organisationId === null &&
        role.projectId === null,
    );
    const organisationRole = roles.find(
      (role) =>
        role.organisationId === organisationId && role.projectId === null,
    );
    const projectRole = roles.find((role) => role.projectId === projectId);

    return {
      instance: instanceRole ? this.aggregatePermissions([instanceRole]) : [],
      organisation: organisationRole
        ? this.aggregatePermissions([organisationRole])
        : [],
      project: projectRole ? this.aggregatePermissions([projectRole]) : [],
      all: this.aggregatePermissions(roles),
    };
  }
}
