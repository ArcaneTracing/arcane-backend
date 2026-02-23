import { Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, EntityManager } from "typeorm";
import { Role } from "../entities/role.entity";
import {
  ORGANISATION_PERMISSIONS,
  PROJECT_PERMISSIONS,
  DATASOURCE_PERMISSIONS,
  DATASET_PERMISSIONS,
  TRACE_PERMISSIONS,
  CONVERSATION_PERMISSIONS,
  PROMPT_PERMISSIONS,
  EXPERIMENT_PERMISSIONS,
  EVALUATION_PERMISSIONS,
  SCORE_PERMISSIONS,
  ANNOTATION_QUEUE_PERMISSIONS,
  ANNOTATION_PERMISSIONS,
  MODEL_CONFIGURATION_PERMISSIONS,
  CONVERSATION_CONFIG_PERMISSIONS,
  ENTITY_PERMISSIONS,
} from "../permissions/permissions";

@Injectable()
export class RbacSeedService {
  private readonly logger = new Logger(RbacSeedService.name);

  constructor(
    @InjectRepository(Role)
    private readonly roleRepository: Repository<Role>,
  ) {}

  async seedOrganisationRoles(
    organisationId: string,
    entityManager?: EntityManager,
  ): Promise<Role | null> {
    const roleRepo = entityManager
      ? entityManager.getRepository(Role)
      : this.roleRepository;

    const existingRoles = await roleRepo.find({
      where: {
        organisationId,
        projectId: null,
        isSystemRole: true,
      },
    });

    if (existingRoles.length > 0) {
      this.logger.debug(
        `Organisation roles already seeded for org ${organisationId}`,
      );
      return null;
    }

    const organisationAdminPermissions = [
      ...Object.values(ORGANISATION_PERMISSIONS),
      PROJECT_PERMISSIONS.CREATE,
      PROJECT_PERMISSIONS.READ,
      PROJECT_PERMISSIONS.UPDATE,
      PROJECT_PERMISSIONS.DELETE,
      PROJECT_PERMISSIONS.MEMBERS_READ,
      PROJECT_PERMISSIONS.MEMBERS_CREATE,
      PROJECT_PERMISSIONS.MEMBERS_DELETE,
      PROJECT_PERMISSIONS.ROLES_ASSIGN,
      PROJECT_PERMISSIONS.ROLES_REMOVE,
      ...Object.values(DATASOURCE_PERMISSIONS),
      ...Object.values(DATASET_PERMISSIONS),
      TRACE_PERMISSIONS.READ,
      CONVERSATION_PERMISSIONS.READ,
      ...Object.values(PROMPT_PERMISSIONS),
      ...Object.values(EXPERIMENT_PERMISSIONS),
      ...Object.values(EVALUATION_PERMISSIONS),
      ...Object.values(SCORE_PERMISSIONS),
      ...Object.values(ANNOTATION_QUEUE_PERMISSIONS),
      ...Object.values(ANNOTATION_PERMISSIONS),
      ...Object.values(MODEL_CONFIGURATION_PERMISSIONS),
      ...Object.values(CONVERSATION_CONFIG_PERMISSIONS),
      ...Object.values(ENTITY_PERMISSIONS),
    ];

    const organisationAdminRole = roleRepo.create({
      name: "Organisation Admin",
      description: "Full control over the organisation",
      permissions: organisationAdminPermissions,
      isSystemRole: true,
      isInstanceLevel: false,
      organisationId,
      projectId: null,
    });

    const organisationMemberPermissions = [
      ORGANISATION_PERMISSIONS.READ,
      ENTITY_PERMISSIONS.READ,
      CONVERSATION_CONFIG_PERMISSIONS.READ,
      MODEL_CONFIGURATION_PERMISSIONS.READ,
    ];
    const organisationMemberRole = roleRepo.create({
      name: "Organisation Member",
      description:
        "Can view organisation details and use basic features, but has no project access",
      permissions: organisationMemberPermissions,
      isSystemRole: true,
      isInstanceLevel: false,
      organisationId,
      projectId: null,
    });

    const savedRoles = await roleRepo.save([
      organisationAdminRole,
      organisationMemberRole,
    ]);
    this.logger.log(`Seeded organisation roles for org ${organisationId}`);

    return (
      savedRoles.find((role) => role.name === "Organisation Admin") || null
    );
  }

  async seedProjectRoles(
    organisationId: string,
    projectId: string,
    entityManager?: EntityManager,
  ): Promise<Role | null> {
    const roleRepo = entityManager
      ? entityManager.getRepository(Role)
      : this.roleRepository;

    const existingRoles = await roleRepo.find({
      where: {
        organisationId,
        projectId,
        isSystemRole: true,
      },
    });

    if (existingRoles.length > 0) {
      this.logger.debug(
        `Project roles already seeded for project ${projectId}`,
      );
      return (
        existingRoles.find((role) => role.name === "Project Admin") || null
      );
    }

    const projectAdminPermissions = [
      PROJECT_PERMISSIONS.READ,
      PROJECT_PERMISSIONS.UPDATE,
      PROJECT_PERMISSIONS.DELETE,
      PROJECT_PERMISSIONS.MEMBERS_READ,
      PROJECT_PERMISSIONS.MEMBERS_CREATE,
      PROJECT_PERMISSIONS.MEMBERS_DELETE,
      PROJECT_PERMISSIONS.ROLES_ASSIGN,
      PROJECT_PERMISSIONS.ROLES_REMOVE,
      ORGANISATION_PERMISSIONS.ROLES_READ,
      ORGANISATION_PERMISSIONS.ROLES_CREATE,
      ORGANISATION_PERMISSIONS.ROLES_UPDATE,
      ORGANISATION_PERMISSIONS.ROLES_DELETE,
      ...Object.values(DATASOURCE_PERMISSIONS),
      ...Object.values(DATASET_PERMISSIONS),
      TRACE_PERMISSIONS.READ,
      CONVERSATION_PERMISSIONS.READ,
      ...Object.values(PROMPT_PERMISSIONS),
      ...Object.values(EXPERIMENT_PERMISSIONS),
      ...Object.values(EVALUATION_PERMISSIONS),
      ...Object.values(SCORE_PERMISSIONS),
      ...Object.values(ANNOTATION_QUEUE_PERMISSIONS),
      ...Object.values(ANNOTATION_PERMISSIONS),
      ENTITY_PERMISSIONS.READ,
      CONVERSATION_CONFIG_PERMISSIONS.READ,
      MODEL_CONFIGURATION_PERMISSIONS.READ,
    ];

    const projectAdminRole = roleRepo.create({
      name: "Project Admin",
      description:
        "Full control over the project including editing, member management, and role management",
      permissions: projectAdminPermissions,
      isSystemRole: true,
      isInstanceLevel: false,
      organisationId,
      projectId,
    });

    const memberPermissions = [
      PROJECT_PERMISSIONS.READ,
      ...Object.values(DATASOURCE_PERMISSIONS),
      ...Object.values(DATASET_PERMISSIONS),
      TRACE_PERMISSIONS.READ,
      CONVERSATION_PERMISSIONS.READ,
      ...Object.values(PROMPT_PERMISSIONS),
      ...Object.values(EXPERIMENT_PERMISSIONS),
      ...Object.values(EVALUATION_PERMISSIONS),
      ...Object.values(SCORE_PERMISSIONS),
      ...Object.values(ANNOTATION_QUEUE_PERMISSIONS),
      ...Object.values(ANNOTATION_PERMISSIONS),
      ENTITY_PERMISSIONS.READ,
      CONVERSATION_CONFIG_PERMISSIONS.READ,
      MODEL_CONFIGURATION_PERMISSIONS.READ,
    ];

    const memberRole = roleRepo.create({
      name: "Member",
      description:
        "Can perform all operations except editing/deleting the project",
      permissions: memberPermissions,
      isSystemRole: true,
      isInstanceLevel: false,
      organisationId,
      projectId,
    });

    const viewerPermissions = [
      PROJECT_PERMISSIONS.READ,
      DATASOURCE_PERMISSIONS.READ,
      DATASET_PERMISSIONS.READ,
      TRACE_PERMISSIONS.READ,
      CONVERSATION_PERMISSIONS.READ,
      PROMPT_PERMISSIONS.READ,
      EXPERIMENT_PERMISSIONS.READ,
      EVALUATION_PERMISSIONS.READ,
      EVALUATION_PERMISSIONS.RESULTS_READ,
      SCORE_PERMISSIONS.READ,
      ANNOTATION_QUEUE_PERMISSIONS.READ,
      ANNOTATION_PERMISSIONS.READ,
      ENTITY_PERMISSIONS.READ,
      CONVERSATION_CONFIG_PERMISSIONS.READ,
      MODEL_CONFIGURATION_PERMISSIONS.READ,
    ];

    const viewerRole = roleRepo.create({
      name: "Viewer",
      description: "View-only access to project",
      permissions: viewerPermissions,
      isSystemRole: true,
      isInstanceLevel: false,
      organisationId,
      projectId,
    });

    const savedRoles = await roleRepo.save([
      projectAdminRole,
      memberRole,
      viewerRole,
    ]);
    this.logger.log(`Seeded project roles for project ${projectId}`);

    return savedRoles.find((role) => role.name === "Project Admin") || null;
  }
}
