import { Inject, Injectable, Logger } from "@nestjs/common";
import { CACHE_MANAGER } from "@nestjs/cache-manager";
import { Cache } from "cache-manager";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Role } from "../entities/role.entity";
import { UserRole } from "../entities/user-role.entity";
import {
  isInstanceScope,
  isOrganisationScope,
  isProjectScope,
} from "../utils/role-scope.util";

@Injectable()
export class RoleRetrievalService {
  private readonly logger = new Logger(RoleRetrievalService.name);
  private readonly ROLE_CACHE_TTL = 3600;

  constructor(
    @InjectRepository(UserRole)
    private readonly userRoleRepository: Repository<UserRole>,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
  ) {}

  async getUserRoles(
    userId: string,
    organisationId?: string,
    projectId?: string,
  ): Promise<Role[]> {
    const cacheKey = `user:roles:${userId}:${organisationId || ""}:${projectId || ""}`;

    const cached = await this.cacheManager.get<Role[]>(cacheKey);
    if (cached) {
      return cached;
    }

    const roles: Role[] = [];

    const instanceRole = await this.getUserInstanceRole(userId);
    if (instanceRole) {
      roles.push(instanceRole);
    }

    if (organisationId) {
      const orgRole = await this.getUserOrganisationRole(
        organisationId,
        userId,
      );
      if (orgRole) {
        roles.push(orgRole);
      }
    }

    if (projectId) {
      const projectRole = await this.getUserProjectRole(projectId, userId);
      if (projectRole) {
        roles.push(projectRole);
      }
    }

    await this.cacheManager.set(cacheKey, roles, this.ROLE_CACHE_TTL);
    return roles;
  }

  async getUserInstanceRole(userId: string): Promise<Role | null> {
    const cacheKey = `user:role:instance:${userId}`;

    const cached = await this.cacheManager.get<Role | null>(cacheKey);
    if (cached !== undefined) {
      return cached;
    }

    const userRoles = await this.userRoleRepository.find({
      where: { userId },
      relations: ["role"],
    });

    let role: Role | null = null;
    for (const userRole of userRoles) {
      const r = userRole.role;

      const isInstanceScoped = isInstanceScope(r);

      if (isInstanceScoped) {
        role = r;
        break;
      } else if (r.isInstanceLevel) {
        this.logger.warn(
          `Data inconsistency detected: Role ${r.id} (${r.name}) has isInstanceLevel=true but organisationId=${r.organisationId}, projectId=${r.projectId}. Treating as instance role.`,
        );
        role = r;
        break;
      }
    }

    await this.cacheManager.set(cacheKey, role, this.ROLE_CACHE_TTL);
    return role;
  }

  async getUserOrganisationRole(
    organisationId: string,
    userId: string,
  ): Promise<Role | null> {
    const cacheKey = `user:role:org:${organisationId}:${userId}`;

    const cached = await this.cacheManager.get<Role | null>(cacheKey);
    if (cached !== undefined) {
      return cached;
    }

    const userRoles = await this.userRoleRepository.find({
      where: { userId },
      relations: ["role"],
    });

    let role: Role | null = null;
    for (const userRole of userRoles) {
      const r = userRole.role;
      if (isOrganisationScope(r) && r.organisationId === organisationId) {
        role = r;
        break;
      }
    }

    await this.cacheManager.set(cacheKey, role, this.ROLE_CACHE_TTL);
    return role;
  }

  async getUserProjectRole(
    projectId: string,
    userId: string,
  ): Promise<Role | null> {
    const cacheKey = `user:role:project:${projectId}:${userId}`;

    const cached = await this.cacheManager.get<Role | null>(cacheKey);
    if (cached !== undefined) {
      return cached;
    }

    const userRoles = await this.userRoleRepository.find({
      where: { userId },
      relations: ["role"],
    });

    let role: Role | null = null;
    for (const userRole of userRoles) {
      const r = userRole.role;
      if (isProjectScope(r) && r.projectId === projectId) {
        role = r;
        break;
      }
    }

    await this.cacheManager.set(cacheKey, role, this.ROLE_CACHE_TTL);
    return role;
  }

  async getUserProjectRoles(
    projectId: string,
    userId: string,
  ): Promise<Role[]> {
    const userRoles = await this.userRoleRepository.find({
      where: { userId },
      relations: ["role"],
    });

    const projectRoles: Role[] = [];
    for (const userRole of userRoles) {
      const role = userRole.role;
      if (isProjectScope(role) && role.projectId === projectId) {
        projectRoles.push(role);
      }
    }

    return projectRoles;
  }

  async getUserProjectRolesForOrganisation(
    organisationId: string,
    userId: string,
  ): Promise<Role[]> {
    const userRoles = await this.userRoleRepository.find({
      where: { userId },
      relations: ["role"],
    });

    return userRoles
      .map((userRole) => userRole.role)
      .filter(
        (role) =>
          isProjectScope(role) && role.organisationId === organisationId,
      );
  }
}
