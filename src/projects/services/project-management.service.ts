import { Inject, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { CACHE_MANAGER } from "@nestjs/cache-manager";
import { Cache } from "cache-manager";
import {
  ERROR_MESSAGES,
  formatError,
} from "../../common/constants/error-messages.constants";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { CreateProjectDto } from "../dto/request/create-project.dto";
import { ProjectResponseDto } from "../dto/response/project.dto";
import { UpdateProjectDto } from "../dto/request/update-project.dto";
import { Project } from "../entities/project.entity";
import { RbacAssignmentService } from "../../rbac/services/rbac-assignment.service";
import { RbacSeedService } from "../../rbac/services/rbac-seed.service";
import { ProjectMapper } from "../mappers";
import { ProjectMessageResponseDto } from "../dto/response/project-message-response.dto";
import { AuditService } from "../../audit/audit.service";

@Injectable()
export class ProjectManagementService {
  private readonly logger = new Logger(ProjectManagementService.name);
  private readonly PROJECT_CACHE_TTL = 1800;

  constructor(
    @InjectRepository(Project)
    private readonly projectRepository: Repository<Project>,
    private readonly assignmentService: RbacAssignmentService,
    private readonly seedService: RbacSeedService,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
    private readonly auditService: AuditService,
  ) {}

  async getByIdAndOrganisationOrThrow(
    organisationId: string,
    projectId: string,
  ): Promise<Project> {
    const project = await this.projectRepository.findOne({
      where: { id: projectId, organisationId },
    });

    if (!project) {
      throw new NotFoundException(
        formatError(ERROR_MESSAGES.PROJECT_NOT_FOUND, projectId),
      );
    }

    return project;
  }

  private toAuditState(p: Project): Record<string, unknown> {
    return {
      id: p.id,
      name: p.name,
      description: p.description ?? null,
      organisationId: p.organisationId,
      createdById: p.createdById,
    };
  }

  async create(
    organisationId: string,
    createProjectDto: CreateProjectDto,
    userId: string,
  ): Promise<ProjectResponseDto> {
    return this.projectRepository.manager.transaction(async (manager) => {
      const projectRepo = manager.getRepository(Project);

      const savedProject = await projectRepo.save({
        name: createProjectDto.name,
        description: createProjectDto.description,
        traceFilterAttributeName: createProjectDto.traceFilterAttributeName,
        traceFilterAttributeValue: createProjectDto.traceFilterAttributeValue,
        createdById: userId,
        organisationId,
      });

      await projectRepo
        .createQueryBuilder()
        .relation(Project, "users")
        .of(savedProject.id)
        .add(userId);

      const projectAdminRole = await this.seedService.seedProjectRoles(
        organisationId,
        savedProject.id,
        manager,
      );

      if (projectAdminRole) {
        await this.assignmentService.assignRole(
          userId,
          projectAdminRole.id,
          manager,
        );
        this.logger.log(
          `Assigned Project Admin role to creator ${userId} for project ${savedProject.id}`,
        );
      }

      await this.auditService.record({
        action: "project.created",
        actorId: userId,
        actorType: "user",
        resourceType: "project",
        resourceId: savedProject.id,
        organisationId,
        projectId: savedProject.id,
        afterState: this.toAuditState(savedProject),
        metadata: {
          creatorId: userId,
          organisationId,
          projectId: savedProject.id,
        },
      });

      return ProjectMapper.toDto(savedProject);
    });
  }

  async update(
    organisationId: string,
    projectId: string,
    updateProjectDto: UpdateProjectDto,
    userId: string,
  ): Promise<ProjectResponseDto> {
    this.logger.debug(`Updating project ${projectId} by user ${userId}`);
    const project = await this.getByIdAndOrganisationOrThrow(
      organisationId,
      projectId,
    );

    const beforeState = this.toAuditState(project);

    if (updateProjectDto.name !== undefined) {
      project.name = updateProjectDto.name;
    }
    if (updateProjectDto.description !== undefined) {
      project.description = updateProjectDto.description;
    }
    if (updateProjectDto.traceFilterAttributeName !== undefined) {
      project.traceFilterAttributeName =
        updateProjectDto.traceFilterAttributeName ?? null;
    }
    if (updateProjectDto.traceFilterAttributeValue !== undefined) {
      project.traceFilterAttributeValue =
        updateProjectDto.traceFilterAttributeValue ?? null;
    }

    const updatedProject = await this.projectRepository.save(project);
    this.logger.log(`Updated project ${projectId}`);

    await this.cacheManager.del(`project:${projectId}`);

    await this.auditService.record({
      action: "project.updated",
      actorId: userId,
      actorType: "user",
      resourceType: "project",
      resourceId: projectId,
      organisationId,
      projectId,
      beforeState,
      afterState: this.toAuditState(updatedProject),
      metadata: {
        changedFields: Object.keys(updateProjectDto),
        organisationId,
        projectId,
      },
    });

    return ProjectMapper.toDto(updatedProject);
  }

  async remove(
    organisationId: string,
    id: string,
    userId?: string,
  ): Promise<ProjectMessageResponseDto> {
    const project = await this.getByIdAndOrganisationOrThrow(
      organisationId,
      id,
    );

    const beforeState = this.toAuditState(project);

    await this.projectRepository.remove(project);
    this.logger.log(`Removed project ${id}`);

    await this.cacheManager.del(`project:${id}`);

    await this.auditService.record({
      action: "project.deleted",
      actorId: userId,
      actorType: "user",
      resourceType: "project",
      resourceId: id,
      organisationId,
      projectId: id,
      beforeState,
      afterState: null,
      metadata: { organisationId, projectId: id },
    });

    return { message: "Project deleted successfully" };
  }

  async findAll(
    organisationId: string,
    userId: string,
  ): Promise<ProjectResponseDto[]> {
    const projects = await this.projectRepository
      .createQueryBuilder("project")
      .leftJoinAndSelect("project.organisation", "organisation")
      .leftJoin("project.users", "user", "user.id = :userId", { userId })
      .where("project.organisation_id = :organisationId", { organisationId })
      .andWhere("(project.created_by_id = :userId OR user.id IS NOT NULL)", {
        userId,
      })
      .orderBy("project.name", "ASC")
      .getMany();

    return projects.map((project) => ProjectMapper.toDto(project));
  }

  async findById(id: string): Promise<Project> {
    const cacheKey = `project:${id}`;

    const cached = await this.cacheManager.get<Project>(cacheKey);
    if (cached) {
      return cached;
    }

    const project = await this.projectRepository.findOne({
      where: { id },
      relations: ["users", "organisation"],
    });
    if (!project) {
      throw new NotFoundException(
        formatError(ERROR_MESSAGES.PROJECT_NOT_FOUND, id),
      );
    }

    await this.cacheManager.set(cacheKey, project, this.PROJECT_CACHE_TTL);
    return project;
  }

  async findOne(
    organisationId: string,
    projectId: string,
  ): Promise<ProjectResponseDto> {
    const project = await this.getByIdAndOrganisationOrThrow(
      organisationId,
      projectId,
    );
    return ProjectMapper.toDto(project);
  }
}
