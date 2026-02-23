import { Inject, Injectable, Logger } from "@nestjs/common";
import { CACHE_MANAGER } from "@nestjs/cache-manager";
import { Cache } from "cache-manager";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, In, Not } from "typeorm";
import { BetterAuthUser } from "../entities/user.entity";

export interface BetterAuthUserDto {
  id: string;
  email: string;
  name: string;
}

@Injectable()
export class BetterAuthUserService {
  private readonly logger = new Logger(BetterAuthUserService.name);
  private readonly USER_CACHE_TTL = 3600;

  constructor(
    @InjectRepository(BetterAuthUser)
    private readonly userRepository: Repository<BetterAuthUser>,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
  ) {}

  async getUserById(userId: string): Promise<BetterAuthUserDto | null> {
    const cacheKey = `user:${userId}`;

    const cached = await this.cacheManager.get<BetterAuthUserDto>(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const user = await this.userRepository.findOne({
        where: { id: userId },
        select: ["id", "email", "name"],
      });

      if (user) {
        await this.cacheManager.set(cacheKey, user, this.USER_CACHE_TTL);
      }

      return user || null;
    } catch (error) {
      this.logger.warn(
        `Failed to fetch user ${userId} from Better Auth: ${error}`,
      );
      return null;
    }
  }

  async getUserIdByEmail(email: string): Promise<string | null> {
    const cacheKey = `user:email:${email}`;

    const cached = await this.cacheManager.get<string>(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const user = await this.userRepository.findOne({
        where: { email },
        select: ["id"],
      });

      const userId = user?.id || null;
      if (userId) {
        await this.cacheManager.set(cacheKey, userId, this.USER_CACHE_TTL);
      }

      return userId;
    } catch (error) {
      this.logger.warn(`Failed to find user by email ${email}: ${error}`);
      return null;
    }
  }

  async getUsersByIds(userIds: string[]): Promise<BetterAuthUserDto[]> {
    if (!userIds || userIds.length === 0) {
      return [];
    }

    try {
      const users = await this.userRepository.find({
        where: { id: In(userIds) },
        select: ["id", "email", "name"],
        order: { name: "ASC" },
      });
      return users;
    } catch (error) {
      this.logger.warn(`Failed to fetch users by IDs: ${error}`);
      return [];
    }
  }

  async getAllUsers(): Promise<BetterAuthUserDto[]> {
    try {
      const users = await this.userRepository.find({
        select: ["id", "email", "name"],
        order: { name: "ASC" },
      });
      return users;
    } catch (error) {
      this.logger.warn(`Failed to fetch all users: ${error}`);
      return [];
    }
  }

  async searchUsersByEmail(
    searchTerm: string,
    limit: number = 50,
  ): Promise<BetterAuthUserDto[]> {
    if (!searchTerm || searchTerm.trim().length === 0) {
      return [];
    }

    try {
      const users = await this.userRepository
        .createQueryBuilder("user")
        .select(["user.id", "user.email", "user.name"])
        .where("LOWER(user.email) LIKE LOWER(:searchTerm)", {
          searchTerm: `%${searchTerm.trim()}%`,
        })
        .orderBy("user.name", "ASC")
        .limit(limit)
        .getMany();

      return users;
    } catch (error) {
      this.logger.warn(`Failed to search users by email: ${error}`);
      return [];
    }
  }

  async getUsersNotInList(userIds: string[]): Promise<BetterAuthUserDto[]> {
    if (!userIds || userIds.length === 0) {
      return this.getAllUsers();
    }

    try {
      const users = await this.userRepository.find({
        where: { id: Not(In(userIds)) },
        select: ["id", "email", "name"],
        order: { name: "ASC" },
      });
      return users;
    } catch (error) {
      this.logger.warn(`Failed to fetch users not in list: ${error}`);
      return [];
    }
  }

  async hasAnyUsers(): Promise<boolean> {
    try {
      const count = await this.userRepository.count();
      return count > 0;
    } catch (error) {
      this.logger.warn(`Failed to count users: ${error}`);
      return false;
    }
  }
}
