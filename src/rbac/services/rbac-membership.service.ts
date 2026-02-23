import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Organisation } from "../../organisations/entities/organisation.entity";
import { Project } from "../../projects/entities/project.entity";
import { UserRole } from "../entities/user-role.entity";
import { isInstanceScope } from "../utils/role-scope.util";

@Injectable()
export class RbacMembershipService {
  constructor(
    @InjectRepository(Organisation)
    private readonly organisationRepository: Repository<Organisation>,
    @InjectRepository(Project)
    private readonly projectRepository: Repository<Project>,
    @InjectRepository(UserRole)
    private readonly userRoleRepository: Repository<UserRole>,
  ) {}

  async isMember(organisationId: string, userId: string): Promise<boolean> {
    const result = await this.organisationRepository.manager.query(
      `SELECT 1 FROM organisation_users WHERE organisation_id = $1 AND user_id = $2 LIMIT 1`,
      [organisationId, userId],
    );
    return result.length > 0;
  }

  async isProjectMember(projectId: string, userId: string): Promise<boolean> {
    const result = await this.projectRepository.manager.query(
      `SELECT 1 FROM project_users WHERE project_id = $1 AND user_id = $2 LIMIT 1`,
      [projectId, userId],
    );
    return result.length > 0;
  }

  async getUserOrganisationIds(userId: string): Promise<string[]> {
    const organisationUsers = await this.organisationRepository.manager.query(
      `SELECT organisation_id FROM organisation_users WHERE user_id = $1`,
      [userId],
    );
    return organisationUsers.map((row: any) => row.organisation_id);
  }

  async getUserProjectIds(userId: string): Promise<string[]> {
    const projectUsers = await this.projectRepository.manager.query(
      `SELECT project_id FROM project_users WHERE user_id = $1`,
      [userId],
    );
    return projectUsers.map((row: any) => row.project_id);
  }

  async getUsersWithProjectAccess(projectId: string): Promise<string[]> {
    const userRoles = await this.userRoleRepository.find({
      relations: ["role"],
    });

    const userIds = new Set<string>();

    for (const userRole of userRoles) {
      const role = userRole.role;

      const hasProjectAccess =
        isInstanceScope(role) || role.projectId === projectId;

      if (hasProjectAccess) {
        userIds.add(userRole.userId);
      }
    }

    return Array.from(userIds);
  }
}
