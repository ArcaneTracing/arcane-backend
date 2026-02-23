import { Injectable } from "@nestjs/common";
import { Role } from "../entities/role.entity";
import { RoleRetrievalService } from "./role-retrieval.service";
import { DefaultRoleService } from "./default-role.service";
import { UserOnboardingService } from "./user-onboarding.service";

@Injectable()
export class RbacService {
  constructor(
    private readonly roleRetrievalService: RoleRetrievalService,
    private readonly defaultRoleService: DefaultRoleService,
    private readonly userOnboardingService: UserOnboardingService,
  ) {}

  async getUserRoles(
    userId: string,
    organisationId?: string,
    projectId?: string,
  ): Promise<Role[]> {
    return this.roleRetrievalService.getUserRoles(
      userId,
      organisationId,
      projectId,
    );
  }

  async getUserInstanceRole(userId: string): Promise<Role | null> {
    return this.roleRetrievalService.getUserInstanceRole(userId);
  }

  async getUserOrganisationRole(
    organisationId: string,
    userId: string,
  ): Promise<Role | null> {
    return this.roleRetrievalService.getUserOrganisationRole(
      organisationId,
      userId,
    );
  }

  async getUserProjectRole(
    projectId: string,
    userId: string,
  ): Promise<Role | null> {
    return this.roleRetrievalService.getUserProjectRole(projectId, userId);
  }

  async getUserProjectRoles(
    projectId: string,
    userId: string,
  ): Promise<Role[]> {
    return this.roleRetrievalService.getUserProjectRoles(projectId, userId);
  }

  async getUserProjectRolesForOrganisation(
    organisationId: string,
    userId: string,
  ): Promise<Role[]> {
    return this.roleRetrievalService.getUserProjectRolesForOrganisation(
      organisationId,
      userId,
    );
  }

  async getDefaultProjectRole(
    organisationId: string,
    projectId: string,
  ): Promise<Role> {
    return this.defaultRoleService.getDefaultProjectRole(
      organisationId,
      projectId,
    );
  }

  async getDefaultOrganisationRole(organisationId: string): Promise<Role> {
    return this.defaultRoleService.getDefaultOrganisationRole(organisationId);
  }

  async getOwnerRoleId(): Promise<string | null> {
    return this.defaultRoleService.getOwnerRoleId();
  }

  async isFirstUser(): Promise<boolean> {
    return this.userOnboardingService.isFirstUser();
  }
}
