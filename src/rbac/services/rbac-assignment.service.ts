import { Inject, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { CACHE_MANAGER } from "@nestjs/cache-manager";
import { Cache } from "cache-manager";
import {
  ERROR_MESSAGES,
  formatError,
} from "../../common/constants/error-messages.constants";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, EntityManager } from "typeorm";
import { Role } from "../entities/role.entity";
import { UserRole } from "../entities/user-role.entity";

@Injectable()
export class RbacAssignmentService {
  private readonly logger = new Logger(RbacAssignmentService.name);

  constructor(
    @InjectRepository(Role)
    private readonly roleRepository: Repository<Role>,
    @InjectRepository(UserRole)
    private readonly userRoleRepository: Repository<UserRole>,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
  ) {}

  async assignRole(
    userId: string,
    roleId: string,
    entityManager?: EntityManager,
  ): Promise<void> {
    const userRoleRepo = entityManager
      ? entityManager.getRepository(UserRole)
      : this.userRoleRepository;
    const roleRepo = entityManager
      ? entityManager.getRepository(Role)
      : this.roleRepository;

    const existing = await userRoleRepo.findOne({
      where: { userId, roleId },
    });

    if (existing) {
      return;
    }

    const role = await roleRepo.findOne({
      where: { id: roleId },
    });

    if (!role) {
      throw new NotFoundException(
        formatError(ERROR_MESSAGES.ROLE_NOT_FOUND, roleId),
      );
    }

    const userRole = userRoleRepo.create({
      userId,
      roleId,
    });

    await userRoleRepo.save(userRole);
    this.logger.log(`Assigned role ${role.name} (${roleId}) to user ${userId}`);

    if (!entityManager) {
      await this.invalidateUserRoleCaches(userId);
    }
  }

  async removeRole(
    userId: string,
    roleId: string,
    entityManager?: EntityManager,
  ): Promise<void> {
    const userRoleRepo = entityManager
      ? entityManager.getRepository(UserRole)
      : this.userRoleRepository;

    const userRole = await userRoleRepo.findOne({
      where: { userId, roleId },
    });

    if (userRole) {
      await userRoleRepo.remove(userRole);

      if (!entityManager) {
        await this.invalidateUserRoleCaches(userId);
      }
    }
  }

  private async invalidateUserRoleCaches(userId: string): Promise<void> {
    const keysToDelete = [`user:role:instance:${userId}`];
    await Promise.all(keysToDelete.map((key) => this.cacheManager.del(key)));
  }

  async getUserIdsForRole(roleId: string): Promise<string[]> {
    const userRoles = await this.userRoleRepository.find({
      where: { roleId },
    });
    return userRoles.map((userRole) => userRole.userId);
  }
}
