import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateExperiments1737011000000 implements MigrationInterface {
  name = 'CreateExperiments1737011000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "experiments" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "project_id" uuid NOT NULL,
        "name" character varying NOT NULL,
        "description" character varying,
        "prompt_version_id" uuid NOT NULL,
        "dataset_id" uuid NOT NULL,
        "prompt_input_mappings" jsonb DEFAULT '{}'::jsonb,
        "created_by_id" character varying,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_experiments" PRIMARY KEY ("id"),
        CONSTRAINT "FK_experiments_project" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_experiments_prompt_version" FOREIGN KEY ("prompt_version_id") REFERENCES "prompt_versions"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_experiments_dataset" FOREIGN KEY ("dataset_id") REFERENCES "datasets"("id") ON DELETE CASCADE
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "experiments" CASCADE`);
  }
}
