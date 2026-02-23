import { MigrationInterface, QueryRunner } from "typeorm";

export class ChangeAuditLogsActorIdToText1770725520000 implements MigrationInterface {
  name = "ChangeAuditLogsActorIdToText1770725520000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_audit_logs_actor_id"`);
    await queryRunner.query(`
      ALTER TABLE "audit_logs"
      ALTER COLUMN "actor_id" TYPE text USING "actor_id"::text
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_audit_logs_actor_id" ON "audit_logs" ("actor_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_audit_logs_actor_id"`);
    await queryRunner.query(`
      ALTER TABLE "audit_logs"
      ALTER COLUMN "actor_id" TYPE uuid USING "actor_id"::uuid
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_audit_logs_actor_id" ON "audit_logs" ("actor_id")
    `);
  }
}
