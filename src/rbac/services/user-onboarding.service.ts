import { Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { UserRole } from "../entities/user-role.entity";

@Injectable()
export class UserOnboardingService {
  private readonly logger = new Logger(UserOnboardingService.name);

  constructor(
    @InjectRepository(UserRole)
    private readonly userRoleRepository: Repository<UserRole>,
  ) {}

  async isFirstUser(): Promise<boolean> {
    const roleCount = await this.userRoleRepository.count();

    if (roleCount === 0) {
      const userCount = await this.userRoleRepository.manager.query(
        `SELECT COUNT(*) as count FROM "user"`,
      );
      const count = Number.parseInt(userCount[0]?.count || "0", 10);
      return count <= 1;
    }

    return false;
  }
}
