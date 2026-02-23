import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import {
  ERROR_MESSAGES,
  formatError,
} from "../../common/constants/error-messages.constants";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Project } from "../entities/project.entity";
import { OrganisationsService } from "../../organisations/services/organisations.service";
import { RbacAssignmentService } from "../../rbac/services/rbac-assignment.service";
import { RbacMembershipService } from "../../rbac/services/rbac-membership.service";
import { RolesService } from "../../rbac/services/roles.service";
import { Role } from "../../rbac/entities/role.entity";
import { BetterAuthUserService } from "../../auth/services/better-auth-user.service";
import { ProjectRbacService } from "./project-rbac.service";
import { ProjectMessageResponseDto } from "../dto/response/project-message-response.dto";
import { ProjectManagementService } from "./project-management.service";
import { AuditService } from "../../audit/audit.service";

@Injectable()
export class ProjectMembershipService {
  private readonly logger = new Logger(ProjectMembershipService.name);

  constructor(
    @InjectRepository(Project)
    private readonly projectRepository: Repository<Project>,
    private readonly projectManagementService: ProjectManagementService,
    private readonly betterAuthUserService: BetterAuthUserService,
    private readonly organisationsService: OrganisationsService,
    private readonly membershipService: RbacMembershipService,
    private readonly assignmentService: RbacAssignmentService,
    private readonly rolesService: RolesService,
    private readonly projectRbacService: ProjectRbacService,
    private readonly auditService: AuditService,
  ) {}

  private async getProjectMemberIds(projectId: string): Promise<string[]> {
    const members = await this.projectRepository
      .createQueryBuilder("project")
      .innerJoin("project.users", "user")
      .select("user.id", "id")
      .where("project.id = :projectId", { projectId })
      .getRawMany();
    return members.map((row) => row.id);
  }

  async findUsersNotInProject(
    organisationId: string,
    projectId: string,
  ): Promise<Array<{ id: string; email: string; name: string }>> {
    const project =
      await this.projectManagementService.getByIdAndOrganisationOrThrow(
        organisationId,
        projectId,
      );

    const userIdsInProject = new Set<string>();

    if (project.createdById) {
      userIdsInProject.add(project.createdById);
    }

    const memberIds = await this.getProjectMemberIds(projectId);
    memberIds.forEach((userId) => userIdsInProject.add(userId));

    const userIdsArray = Array.from(userIdsInProject);
    const users =
      await this.betterAuthUserService.getUsersNotInList(userIdsArray);

    this.logger.debug(
      `Found ${users.length} users not in project ${projectId}`,
    );

    return users;
  }

  async inviteUser(
    organisationId: string,
    projectId: string,
    email: string,
    roleId?: string,
    invitedById?: string,
  ): Promise<ProjectMessageResponseDto> {
    await this.projectManagementService.getByIdAndOrganisationOrThrow(
      organisationId,
      projectId,
    );

    const userIdToAdd =
      await this.betterAuthUserService.getUserIdByEmail(email);
    if (!userIdToAdd) {
      throw new NotFoundException(
        formatError(ERROR_MESSAGES.USER_NOT_FOUND_BY_EMAIL, email),
      );
    }

    const isInOrganisation =
      await this.organisationsService.isUserInOrganisation(
        userIdToAdd,
        organisationId,
      );
    if (!isInOrganisation) {
      throw new UnauthorizedException(
        formatError(ERROR_MESSAGES.USER_NOT_IN_ORGANISATION),
      );
    }

    const isInProject = await this.membershipService.isProjectMember(
      projectId,
      userIdToAdd,
    );
    if (isInProject) {
      return { message: "User is already a member of this project" };
    }

    await this.projectRepository
      .createQueryBuilder()
      .relation(Project, "users")
      .of(projectId)
      .add(userIdToAdd);

    let roleToAssign: Role;
    roleToAssign =
      roleId !== undefined && roleId !== null
        ? await this.rolesService.findOne(roleId)
        : await this.projectRbacService.getDefaultProjectRole(
            organisationId,
            projectId,
          );

    await this.assignmentService.assignRole(userIdToAdd, roleToAssign.id);
    this.logger.log(
      `Assigned role "${roleToAssign.name}" to user ${email} in project ${projectId}`,
    );

    this.logger.log(`User ${email} invited to project ${projectId}`);

    await this.auditService.record({
      action: "project_member.added",
      actorId: invitedById,
      actorType: "user",
      resourceType: "project_member",
      resourceId: projectId,
      organisationId,
      projectId,
      beforeState: { wasMember: false },
      afterState: {
        userId: userIdToAdd,
        email,
        roleId: roleToAssign.id,
        roleName: roleToAssign.name,
      },
      metadata: {
        projectId,
        organisationId,
        invitedById: invitedById ?? null,
        inviteType: "member_added",
      },
    });

    return { message: "User invited successfully" };
  }

  async removeUser(
    organisationId: string,
    projectId: string,
    email: string,
    actorId?: string,
  ): Promise<ProjectMessageResponseDto> {
    const project =
      await this.projectManagementService.getByIdAndOrganisationOrThrow(
        organisationId,
        projectId,
      );

    const userIdToRemove =
      await this.betterAuthUserService.getUserIdByEmail(email);
    if (!userIdToRemove) {
      return { message: "User not found" };
    }

    if (project.createdById === userIdToRemove) {
      throw new ForbiddenException(
        formatError(ERROR_MESSAGES.CANNOT_REMOVE_PROJECT_CREATOR),
      );
    }

    const isInProject = await this.membershipService.isProjectMember(
      projectId,
      userIdToRemove,
    );
    if (!isInProject) {
      return { message: "User is not a member of this project" };
    }

    const beforeState = { userId: userIdToRemove, email };

    await this.projectRepository
      .createQueryBuilder()
      .relation(Project, "users")
      .of(projectId)
      .remove(userIdToRemove);

    this.logger.log(`User ${email} removed from project ${projectId}`);

    await this.auditService.record({
      action: "project_member.removed",
      actorId,
      actorType: "user",
      resourceType: "project_member",
      resourceId: projectId,
      organisationId,
      projectId,
      beforeState,
      afterState: null,
      metadata: { organisationId, projectId, removedBy: actorId ?? null },
    });

    return { message: "User removed successfully" };
  }
}
