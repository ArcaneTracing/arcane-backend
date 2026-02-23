import { Inject, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { CACHE_MANAGER } from "@nestjs/cache-manager";
import { Cache } from "cache-manager";
import {
  ERROR_MESSAGES,
  formatError,
} from "../../common/constants/error-messages.constants";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Role } from "../entities/role.entity";

@Injectable()
export class DefaultRoleService {
  private readonly logger = new Logger(DefaultRoleService.name);
  private readonly DEFAULT_ROLE_CACHE_TTL = 1800;

  constructor(
    @InjectRepository(Role)
    private readonly roleRepository: Repository<Role>,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
  ) {}

  async getDefaultProjectRole(
    organisationId: string,
    projectId: string,
  ): Promise<Role> {
    const cacheKey = `role:default:project:${organisationId}:${projectId}`;

    const cached = await this.cacheManager.get<Role>(cacheKey);
    if (cached) {
      return cached;
    }

    const role = await this.roleRepository.findOne({
      where: {
        name: "Member",
        isSystemRole: true,
        organisationId,
        projectId,
      },
    });

    if (!role) {
      throw new NotFoundException(
        formatError(ERROR_MESSAGES.DEFAULT_MEMBER_ROLE_NOT_FOUND, projectId),
      );
    }

    await this.cacheManager.set(cacheKey, role, this.DEFAULT_ROLE_CACHE_TTL);
    return role;
  }

  async getDefaultOrganisationRole(organisationId: string): Promise<Role> {
    const cacheKey = `role:default:org:${organisationId}`;

    const cached = await this.cacheManager.get<Role>(cacheKey);
    if (cached) {
      return cached;
    }

    const role = await this.roleRepository.findOne({
      where: {
        name: "Organisation Member",
        isSystemRole: true,
        organisationId,
        projectId: null,
      },
    });

    if (!role) {
      throw new NotFoundException(
        formatError(
          ERROR_MESSAGES.DEFAULT_ORGANISATION_MEMBER_ROLE_NOT_FOUND,
          organisationId,
        ),
      );
    }

    await this.cacheManager.set(cacheKey, role, this.DEFAULT_ROLE_CACHE_TTL);
    return role;
  }

  async getOwnerRoleId(): Promise<string | null> {
    const cacheKey = "role:owner";

    const cached = await this.cacheManager.get<string | null>(cacheKey);
    if (cached !== undefined) {
      return cached;
    }

    const ownerRole = await this.roleRepository.findOne({
      where: {
        name: "Owner",
        isSystemRole: true,
        isInstanceLevel: true,
        organisationId: null,
        projectId: null,
      },
    });

    if (!ownerRole) {
      this.logger.warn("Owner role not found in database");
    }

    const roleId = ownerRole?.id || null;
    await this.cacheManager.set(cacheKey, roleId, this.DEFAULT_ROLE_CACHE_TTL);
    return roleId;
  }
}
