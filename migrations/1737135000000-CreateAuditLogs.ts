import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateAuditLogs1737135000000 implements MigrationInterface {
  name = 'CreateAuditLogs1737135000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "audit_logs" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "action" text NOT NULL,
        "actor_id" uuid,
        "actor_type" text,
        "resource_type" text,
        "resource_id" uuid,
        "organisation_id" uuid,
        "project_id" uuid,
        "metadata" jsonb,
        "before_state" jsonb,
        "after_state" jsonb,
        CONSTRAINT "PK_audit_logs" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_audit_logs_created_at" ON "audit_logs" ("created_at" DESC)
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_audit_logs_actor_id" ON "audit_logs" ("actor_id")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_audit_logs_resource" ON "audit_logs" ("resource_type", "resource_id")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_audit_logs_org" ON "audit_logs" ("organisation_id")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_audit_logs_project" ON "audit_logs" ("project_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_audit_logs_project"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_audit_logs_org"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_audit_logs_resource"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_audit_logs_actor_id"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_audit_logs_created_at"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "audit_logs" CASCADE`);
  }
}
