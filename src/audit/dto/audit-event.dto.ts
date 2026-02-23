export type ActorType = "user" | "system" | "api-key";

export interface AuditEvent {
  action: string;
  actorId?: string;
  actorType?: ActorType;
  resourceType?: string;
  resourceId?: string;
  metadata?: Record<string, unknown>;
  beforeState?: Record<string, unknown>;
  afterState?: Record<string, unknown>;
  organisationId?: string;
  projectId?: string;
}
