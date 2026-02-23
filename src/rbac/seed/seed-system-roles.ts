import { DataSource } from "typeorm";
import { Logger } from "@nestjs/common";
import { Role } from "../entities/role.entity";

const logger = new Logger("SeedSystemRoles");
import {
  INSTANCE_PERMISSIONS,
  ORGANISATION_PERMISSIONS,
  PROJECT_PERMISSIONS,
  ATTRIBUTE_VISIBILITY_RULE_PERMISSIONS,
  PROJECT_API_KEY_PERMISSIONS,
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

export async function seedSystemRoles(dataSource: DataSource): Promise<void> {
  const roleRepository = dataSource.getRepository(Role);
  const existingOwner = await roleRepository.findOne({
    where: {
      isSystemRole: true,
      isInstanceLevel: true,
      organisationId: null,
      projectId: null,
    },
  });

  if (existingOwner) {
    logger.debug("Owner role already seeded");
    return;
  }
  const ownerRole = roleRepository.create({
    name: "Owner",
    description: "Full control over the entire application instance",
    permissions: [INSTANCE_PERMISSIONS.ALL],
    isSystemRole: true,
    isInstanceLevel: true,
    organisationId: null,
    projectId: null,
  });

  await roleRepository.save(ownerRole);
  logger.log("Owner role seeded successfully");
}

export async function seedOrganisationRoles(
  dataSource: DataSource,
  organisationId: string,
): Promise<void> {
  const roleRepository = dataSource.getRepository(Role);

  const existingRoles = await roleRepository.find({
    where: {
      organisationId,
      projectId: null,
      isSystemRole: true,
    },
  });

  if (existingRoles.length > 0) {
    logger.debug(`Organisation roles already seeded for org ${organisationId}`);
    return;
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
    PROJECT_PERMISSIONS.ROLES_READ,
    PROJECT_PERMISSIONS.ROLES_CREATE,
    PROJECT_PERMISSIONS.ROLES_UPDATE,
    PROJECT_PERMISSIONS.ROLES_DELETE,
    PROJECT_PERMISSIONS.ROLES_ASSIGN,
    PROJECT_PERMISSIONS.ROLES_REMOVE,
    ...Object.values(ATTRIBUTE_VISIBILITY_RULE_PERMISSIONS),
    ...Object.values(PROJECT_API_KEY_PERMISSIONS),
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
  const organisationAdminRole = roleRepository.create({
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

  const organisationMemberRole = roleRepository.create({
    name: "Organisation Member",
    description:
      "Can view organisation details and use basic features, but has no project access",
    permissions: organisationMemberPermissions,
    isSystemRole: true,
    isInstanceLevel: false,
    organisationId,
    projectId: null,
  });

  await roleRepository.save([organisationAdminRole, organisationMemberRole]);
  logger.log(`Organisation roles seeded for org ${organisationId}`);
}

export async function seedProjectRoles(
  dataSource: DataSource,
  organisationId: string,
  projectId: string,
): Promise<void> {
  const roleRepository = dataSource.getRepository(Role);

  const existingRoles = await roleRepository.find({
    where: {
      organisationId,
      projectId,
      isSystemRole: true,
    },
  });

  if (existingRoles.length > 0) {
    logger.debug(`Project roles already seeded for project ${projectId}`);
    return;
  }

  const memberPermissions = [
    PROJECT_PERMISSIONS.READ,
    ...Object.values(ATTRIBUTE_VISIBILITY_RULE_PERMISSIONS),
    ...Object.values(PROJECT_API_KEY_PERMISSIONS),
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
  const memberRole = roleRepository.create({
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
    ATTRIBUTE_VISIBILITY_RULE_PERMISSIONS.READ,
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
  const viewerRole = roleRepository.create({
    name: "Viewer",
    description: "View-only access to project",
    permissions: viewerPermissions,
    isSystemRole: true,
    isInstanceLevel: false,
    organisationId,
    projectId,
  });

  await roleRepository.save([memberRole, viewerRole]);
  logger.log(`Project roles seeded for project ${projectId}`);
}
