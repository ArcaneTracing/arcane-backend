import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTraceFilterAttributesToProjects1770625254000 implements MigrationInterface {
  name = 'AddTraceFilterAttributesToProjects1770625254000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "projects" 
      ADD COLUMN "trace_filter_attribute_name" VARCHAR(255) NULL,
      ADD COLUMN "trace_filter_attribute_value" VARCHAR(255) NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "projects" 
      DROP COLUMN IF EXISTS "trace_filter_attribute_name",
      DROP COLUMN IF EXISTS "trace_filter_attribute_value"
    `);
  }
}
