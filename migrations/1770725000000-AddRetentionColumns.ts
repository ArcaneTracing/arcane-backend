import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddRetentionColumns1770725000000 implements MigrationInterface {
  name = 'AddRetentionColumns1770725000000';

  public async up(queryRunner: QueryRunner): Promise<void> {

    await queryRunner.query(`
      ALTER TABLE "organisations"
      ADD COLUMN "audit_log_retention_days" integer
    `);


    await queryRunner.query(`
      ALTER TABLE "projects"
      ADD COLUMN "evaluation_retention_days" integer,
      ADD COLUMN "experiment_retention_days" integer
    `);


    await queryRunner.query(`
      CREATE INDEX "IDX_audit_logs_created_at_org" ON "audit_logs" ("created_at", "organisation_id")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_evaluations_created_at_project" ON "evaluations" ("created_at", "project_id")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_experiments_created_at_project" ON "experiments" ("created_at", "project_id")
    `);


    await queryRunner.query(`
      CREATE INDEX "IDX_org_invitations_status_created" ON "organisation_invitations" ("status", "created_at")
    `);


    await queryRunner.query(`
      CREATE INDEX "IDX_org_invitations_status_accepted" ON "organisation_invitations" ("status", "accepted_at")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {

    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_org_invitations_status_accepted"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_org_invitations_status_created"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_experiments_created_at_project"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_evaluations_created_at_project"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_audit_logs_created_at_org"`);


    await queryRunner.query(`
      ALTER TABLE "projects"
      DROP COLUMN IF EXISTS "experiment_retention_days",
      DROP COLUMN IF EXISTS "evaluation_retention_days"
    `);


    await queryRunner.query(`
      ALTER TABLE "organisations"
      DROP COLUMN IF EXISTS "audit_log_retention_days"
    `);
  }
}