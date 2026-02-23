import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateDatasets1737006000000 implements MigrationInterface {
  name = 'CreateDatasets1737006000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "datasets" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "name" character varying NOT NULL,
        "description" text,
        "header" jsonb NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "created_by_id" character varying NOT NULL,
        "project_id" uuid NOT NULL,
        CONSTRAINT "PK_datasets" PRIMARY KEY ("id"),
        CONSTRAINT "FK_datasets_project" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "datasets" CASCADE`);
  }
}
