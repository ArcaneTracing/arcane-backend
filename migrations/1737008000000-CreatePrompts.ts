import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreatePrompts1737008000000 implements MigrationInterface {
  name = 'CreatePrompts1737008000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "prompts" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "name" character varying NOT NULL,
        "description" text,
        "metadata" jsonb DEFAULT '{}'::jsonb,
        "project_id" uuid NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_prompts" PRIMARY KEY ("id"),
        CONSTRAINT "FK_prompts_project" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE,
        CONSTRAINT "UQ_prompts_project_name" UNIQUE ("project_id", "name")
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "prompts" CASCADE`);
  }
}
