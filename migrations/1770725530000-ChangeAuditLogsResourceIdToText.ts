import { MigrationInterface, QueryRunner } from "typeorm";

export class ChangeAuditLogsResourceIdToText1770725530000
  implements MigrationInterface
{
  name = "ChangeAuditLogsResourceIdToText1770725530000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_audit_logs_resource"`);
    await queryRunner.query(`
      ALTER TABLE "audit_logs"
      ALTER COLUMN "resource_id" TYPE text USING "resource_id"::text
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_audit_logs_resource" ON "audit_logs" ("resource_type", "resource_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_audit_logs_resource"`);
    await queryRunner.query(`
      ALTER TABLE "audit_logs"
      ALTER COLUMN "resource_id" TYPE uuid USING "resource_id"::uuid
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_audit_logs_resource" ON "audit_logs" ("resource_type", "resource_id")
    `);
  }
}
