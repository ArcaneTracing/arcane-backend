import {
  Controller,
  Get,
  Put,
  Param,
  ParseUUIDPipe,
  UseGuards,
  Body,
  HttpCode,
  HttpStatus,
  UsePipes,
  ValidationPipe,
  NotFoundException,
} from "@nestjs/common";
import {
  ApiTags,
  ApiBearerAuth,
  ApiResponse,
  ApiOperation,
} from "@nestjs/swagger";
import { Session, UserSession } from "@thallesp/nestjs-better-auth";
import { OrgPermissionGuard } from "../../rbac/guards/org-permission.guard";
import { OrgProjectPermissionGuard } from "../../rbac/guards/org-project-permission.guard";
import { Permission } from "../../rbac/decorators/permission.decorator";
import {
  ORGANISATION_PERMISSIONS,
  PROJECT_PERMISSIONS,
} from "../../rbac/permissions/permissions";
import { RetentionService } from "../services/retention.service";
import { UpdateOrganisationRetentionRequestDto } from "../dto/request/update-organisation-retention-request.dto";
import { UpdateProjectRetentionRequestDto } from "../dto/request/update-project-retention-request.dto";
import { OrganisationRetentionResponseDto } from "../dto/response/organisation-retention-response.dto";
import { ProjectRetentionResponseDto } from "../dto/response/project-retention-response.dto";
import { AuditService } from "../../audit/audit.service";
import { DEFAULT_RETENTION } from "../config/retention.config";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Organisation } from "../../organisations/entities/organisation.entity";
import { Project } from "../../projects/entities/project.entity";
import {
  ERROR_MESSAGES,
  formatError,
} from "../../common/constants/error-messages.constants";

@Controller("v1")
@ApiTags("retention")
@ApiBearerAuth("bearer")
export class RetentionController {
  constructor(
    private readonly retentionService: RetentionService,
    private readonly auditService: AuditService,
    @InjectRepository(Organisation)
    private readonly organisationRepository: Repository<Organisation>,
    @InjectRepository(Project)
    private readonly projectRepository: Repository<Project>,
  ) {}

  @Get("organisations/:organisationId/retention")
  @UseGuards(OrgPermissionGuard)
  @Permission(ORGANISATION_PERMISSIONS.READ)
  @ApiOperation({ summary: "Get organisation retention settings" })
  @ApiResponse({
    status: 200,
    description: "Retention settings retrieved successfully",
    type: OrganisationRetentionResponseDto,
  })
  @ApiResponse({ status: 404, description: "Organisation not found" })
  async getOrganisationRetention(
    @Param("organisationId", ParseUUIDPipe) organisationId: string,
  ): Promise<OrganisationRetentionResponseDto> {
    const organisation = await this.organisationRepository.findOne({
      where: { id: organisationId },
    });

    if (!organisation) {
      throw new NotFoundException(
        formatError(
          ERROR_MESSAGES.NOT_FOUND_WITH_ID,
          "Organisation",
          organisationId,
        ),
      );
    }

    return {
      auditLogRetentionDays:
        organisation.auditLogRetentionDays ?? DEFAULT_RETENTION.AUDIT_LOGS,
    };
  }

  @Put("organisations/:organisationId/retention")
  @UseGuards(OrgPermissionGuard)
  @Permission(ORGANISATION_PERMISSIONS.UPDATE)
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Update organisation retention settings" })
  @ApiResponse({
    status: 200,
    description: "Retention settings updated successfully",
    type: OrganisationRetentionResponseDto,
  })
  @ApiResponse({ status: 404, description: "Organisation not found" })
  async updateOrganisationRetention(
    @Param("organisationId", ParseUUIDPipe) organisationId: string,
    @Body() dto: UpdateOrganisationRetentionRequestDto,
    @Session() userSession: UserSession,
  ): Promise<OrganisationRetentionResponseDto> {
    const organisation = await this.organisationRepository.findOne({
      where: { id: organisationId },
    });

    if (!organisation) {
      throw new NotFoundException(
        formatError(
          ERROR_MESSAGES.NOT_FOUND_WITH_ID,
          "Organisation",
          organisationId,
        ),
      );
    }

    const beforeState = {
      auditLogRetentionDays: organisation.auditLogRetentionDays,
    };

    if (dto.auditLogRetentionDays !== undefined) {
      organisation.auditLogRetentionDays = dto.auditLogRetentionDays;
    }

    await this.organisationRepository.save(organisation);

    const afterState = {
      auditLogRetentionDays: organisation.auditLogRetentionDays,
    };

    await this.auditService.record({
      action: "organisation.retention.updated",
      actorId: userSession?.user?.id,
      actorType: "user",
      resourceType: "organisation",
      resourceId: organisationId,
      organisationId,
      beforeState,
      afterState,
      metadata: {
        changedFields: Object.keys(dto),
      },
    });

    return {
      auditLogRetentionDays: organisation.auditLogRetentionDays,
    };
  }

  @Get("organisations/:organisationId/projects/:projectId/retention")
  @UseGuards(OrgProjectPermissionGuard)
  @Permission(PROJECT_PERMISSIONS.READ)
  @ApiOperation({ summary: "Get project retention settings" })
  @ApiResponse({
    status: 200,
    description: "Retention settings retrieved successfully",
    type: ProjectRetentionResponseDto,
  })
  @ApiResponse({ status: 404, description: "Project not found" })
  async getProjectRetention(
    @Param("organisationId", ParseUUIDPipe) organisationId: string,
    @Param("projectId", ParseUUIDPipe) projectId: string,
  ): Promise<ProjectRetentionResponseDto> {
    const project = await this.projectRepository.findOne({
      where: { id: projectId, organisationId },
    });

    if (!project) {
      throw new NotFoundException(
        formatError(ERROR_MESSAGES.PROJECT_NOT_FOUND, projectId),
      );
    }

    return {
      evaluationRetentionDays:
        project.evaluationRetentionDays ?? DEFAULT_RETENTION.EVALUATIONS,
      experimentRetentionDays:
        project.experimentRetentionDays ?? DEFAULT_RETENTION.EXPERIMENTS,
    };
  }

  @Put("organisations/:organisationId/projects/:projectId/retention")
  @UseGuards(OrgProjectPermissionGuard)
  @Permission(PROJECT_PERMISSIONS.UPDATE)
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Update project retention settings" })
  @ApiResponse({
    status: 200,
    description: "Retention settings updated successfully",
    type: ProjectRetentionResponseDto,
  })
  @ApiResponse({ status: 404, description: "Project not found" })
  async updateProjectRetention(
    @Param("organisationId", ParseUUIDPipe) organisationId: string,
    @Param("projectId", ParseUUIDPipe) projectId: string,
    @Body() dto: UpdateProjectRetentionRequestDto,
    @Session() userSession: UserSession,
  ): Promise<ProjectRetentionResponseDto> {
    const project = await this.projectRepository.findOne({
      where: { id: projectId, organisationId },
    });

    if (!project) {
      throw new NotFoundException(
        formatError(ERROR_MESSAGES.PROJECT_NOT_FOUND, projectId),
      );
    }

    const beforeState = {
      evaluationRetentionDays: project.evaluationRetentionDays,
      experimentRetentionDays: project.experimentRetentionDays,
    };

    if (dto.evaluationRetentionDays !== undefined) {
      project.evaluationRetentionDays = dto.evaluationRetentionDays;
    }
    if (dto.experimentRetentionDays !== undefined) {
      project.experimentRetentionDays = dto.experimentRetentionDays;
    }

    await this.projectRepository.save(project);

    const afterState = {
      evaluationRetentionDays: project.evaluationRetentionDays,
      experimentRetentionDays: project.experimentRetentionDays,
    };

    await this.auditService.record({
      action: "project.retention.updated",
      actorId: userSession?.user?.id,
      actorType: "user",
      resourceType: "project",
      resourceId: projectId,
      organisationId,
      projectId,
      beforeState,
      afterState,
      metadata: {
        changedFields: Object.keys(dto),
      },
    });

    return {
      evaluationRetentionDays:
        project.evaluationRetentionDays ?? DEFAULT_RETENTION.EVALUATIONS,
      experimentRetentionDays:
        project.experimentRetentionDays ?? DEFAULT_RETENTION.EXPERIMENTS,
    };
  }
}
