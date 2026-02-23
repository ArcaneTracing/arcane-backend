import { Injectable } from "@nestjs/common";
import { CreateProjectDto } from "../dto/request/create-project.dto";
import { ProjectResponseDto } from "../dto/response/project.dto";
import { UpdateProjectDto } from "../dto/request/update-project.dto";
import { Project } from "../entities/project.entity";
import { ProjectMessageResponseDto } from "../dto/response/project-message-response.dto";
import { ProjectManagementService } from "./project-management.service";
import { ProjectMembershipService } from "./project-membership.service";

@Injectable()
export class ProjectsService {
  constructor(
    private readonly projectManagementService: ProjectManagementService,
    private readonly projectMembershipService: ProjectMembershipService,
  ) {}

  async create(
    organisationId: string,
    createProjectDto: CreateProjectDto,
    userId: string,
  ): Promise<ProjectResponseDto> {
    return this.projectManagementService.create(
      organisationId,
      createProjectDto,
      userId,
    );
  }

  async update(
    organisationId: string,
    projectId: string,
    updateProjectDto: UpdateProjectDto,
    userId: string,
  ): Promise<ProjectResponseDto> {
    return this.projectManagementService.update(
      organisationId,
      projectId,
      updateProjectDto,
      userId,
    );
  }

  async remove(
    organisationId: string,
    id: string,
    userId?: string,
  ): Promise<ProjectMessageResponseDto> {
    return this.projectManagementService.remove(organisationId, id, userId);
  }

  async findAll(
    organisationId: string,
    userId: string,
  ): Promise<ProjectResponseDto[]> {
    return this.projectManagementService.findAll(organisationId, userId);
  }

  async findById(id: string): Promise<Project> {
    return this.projectManagementService.findById(id);
  }

  async findOne(
    organisationId: string,
    projectId: string,
  ): Promise<ProjectResponseDto> {
    return this.projectManagementService.findOne(organisationId, projectId);
  }

  async inviteUser(
    organisationId: string,
    projectId: string,
    email: string,
    roleId?: string,
    invitedById?: string,
  ): Promise<ProjectMessageResponseDto> {
    return this.projectMembershipService.inviteUser(
      organisationId,
      projectId,
      email,
      roleId,
      invitedById,
    );
  }

  async removeUser(
    organisationId: string,
    projectId: string,
    email: string,
    actorId?: string,
  ): Promise<ProjectMessageResponseDto> {
    return this.projectMembershipService.removeUser(
      organisationId,
      projectId,
      email,
      actorId,
    );
  }

  async findUsersNotInProject(
    organisationId: string,
    projectId: string,
  ): Promise<Array<{ id: string; email: string; name: string }>> {
    return this.projectMembershipService.findUsersNotInProject(
      organisationId,
      projectId,
    );
  }
}
