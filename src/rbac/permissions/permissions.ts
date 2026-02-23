export const INSTANCE_PERMISSIONS = {
  ALL: "*",
} as const;

export const ORGANISATION_PERMISSIONS = {
  READ: "organisations:read",
  UPDATE: "organisations:update",
  DELETE: "organisations:delete",
  MEMBERS_READ: "organisations:members:read",
  MEMBERS_CREATE: "organisations:members:create",
  MEMBERS_UPDATE: "organisations:members:update",
  MEMBERS_DELETE: "organisations:members:delete",
  ROLES_READ: "organisations:roles:read",
  ROLES_CREATE: "organisations:roles:create",
  ROLES_UPDATE: "organisations:roles:update",
  ROLES_DELETE: "organisations:roles:delete",
  CONFIGURATIONS_READ: "organisations:configurations:read",
} as const;

export const PROJECT_PERMISSIONS = {
  CREATE: "projects:create",
  READ: "projects:read",
  UPDATE: "projects:update",
  DELETE: "projects:delete",
  MEMBERS_READ: "projects:members:read",
  MEMBERS_CREATE: "projects:members:create",
  MEMBERS_DELETE: "projects:members:delete",
  ROLES_READ: "projects:roles:read",
  ROLES_CREATE: "projects:roles:create",
  ROLES_UPDATE: "projects:roles:update",
  ROLES_DELETE: "projects:roles:delete",
  ROLES_ASSIGN: "projects:roles:assign",
  ROLES_REMOVE: "projects:roles:remove",
} as const;

export const ATTRIBUTE_VISIBILITY_RULE_PERMISSIONS = {
  READ: "projects:attribute-visibility:read",
  MANAGE: "projects:attribute-visibility:manage",
} as const;

export const PROJECT_API_KEY_PERMISSIONS = {
  READ: "projects:api-keys:read",
  MANAGE: "projects:api-keys:manage",
} as const;

export const DATASOURCE_PERMISSIONS = {
  READ: "datasources:read",
  CREATE: "datasources:create",
  UPDATE: "datasources:update",
  DELETE: "datasources:delete",
} as const;

export const DATASET_PERMISSIONS = {
  READ: "datasets:read",
  CREATE: "datasets:create",
  UPDATE: "datasets:update",
  DELETE: "datasets:delete",
  IMPORT: "datasets:import",
  EXPORT: "datasets:export",
  ROWS_CREATE: "datasets:rows:create",
} as const;

export const TRACE_PERMISSIONS = {
  READ: "traces:read",
} as const;

export const CONVERSATION_PERMISSIONS = {
  READ: "conversations:read",
} as const;

export const PROMPT_PERMISSIONS = {
  READ: "prompts:read",
  CREATE: "prompts:create",
  UPDATE: "prompts:update",
  DELETE: "prompts:delete",
} as const;

export const EXPERIMENT_PERMISSIONS = {
  READ: "experiments:read",
  CREATE: "experiments:create",
  UPDATE: "experiments:update",
  DELETE: "experiments:delete",
  RERUN: "experiments:rerun",
} as const;

export const EVALUATION_PERMISSIONS = {
  READ: "evaluations:read",
  CREATE: "evaluations:create",
  UPDATE: "evaluations:update",
  DELETE: "evaluations:delete",
  RERUN: "evaluations:rerun",
  RESULTS_READ: "evaluations:results:read",
} as const;

export const SCORE_PERMISSIONS = {
  READ: "scores:read",
  CREATE: "scores:create",
  UPDATE: "scores:update",
  DELETE: "scores:delete",
} as const;

export const ANNOTATION_QUEUE_PERMISSIONS = {
  READ: "annotation-queues:read",
  CREATE: "annotation-queues:create",
  UPDATE: "annotation-queues:update",
  DELETE: "annotation-queues:delete",
  TRACES_CREATE: "annotation-queues:traces:create",
  TRACES_DELETE: "annotation-queues:traces:delete",
  CONVERSATIONS_CREATE: "annotation-queues:conversations:create",
  CONVERSATIONS_DELETE: "annotation-queues:conversations:delete",
} as const;

export const ANNOTATION_PERMISSIONS = {
  READ: "annotations:read",
  CREATE: "annotations:create",
  UPDATE: "annotations:update",
  DELETE: "annotations:delete",
} as const;

export const MODEL_CONFIGURATION_PERMISSIONS = {
  READ: "model-configurations:read",
  CREATE: "model-configurations:create",
  UPDATE: "model-configurations:update",
  DELETE: "model-configurations:delete",
} as const;

export const CONVERSATION_CONFIG_PERMISSIONS = {
  READ: "conversation-configurations:read",
  CREATE: "conversation-configurations:create",
  UPDATE: "conversation-configurations:update",
  DELETE: "conversation-configurations:delete",
} as const;

export const ENTITY_PERMISSIONS = {
  READ: "entities:read",
  CREATE: "entities:create",
  UPDATE: "entities:update",
  DELETE: "entities:delete",
} as const;

export const ALL_PERMISSIONS = [
  INSTANCE_PERMISSIONS.ALL,
  ...Object.values(ORGANISATION_PERMISSIONS),
  ...Object.values(PROJECT_PERMISSIONS),
  ...Object.values(ATTRIBUTE_VISIBILITY_RULE_PERMISSIONS),
  ...Object.values(PROJECT_API_KEY_PERMISSIONS),
  ...Object.values(DATASOURCE_PERMISSIONS),
  ...Object.values(DATASET_PERMISSIONS),
  ...Object.values(TRACE_PERMISSIONS),
  ...Object.values(CONVERSATION_PERMISSIONS),
  ...Object.values(PROMPT_PERMISSIONS),
  ...Object.values(EXPERIMENT_PERMISSIONS),
  ...Object.values(EVALUATION_PERMISSIONS),
  ...Object.values(SCORE_PERMISSIONS),
  ...Object.values(ANNOTATION_QUEUE_PERMISSIONS),
  ...Object.values(ANNOTATION_PERMISSIONS),
  ...Object.values(MODEL_CONFIGURATION_PERMISSIONS),
  ...Object.values(CONVERSATION_CONFIG_PERMISSIONS),
  ...Object.values(ENTITY_PERMISSIONS),
] as const;

export type Permission = (typeof ALL_PERMISSIONS)[number];
