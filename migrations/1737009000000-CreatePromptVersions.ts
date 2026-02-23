import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreatePromptVersions1737009000000 implements MigrationInterface {
  name = 'CreatePromptVersions1737009000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "prompt_versions_template_type_enum" AS ENUM('CHAT', 'STR')
    `);
    await queryRunner.query(`
      CREATE TYPE "prompt_versions_template_format_enum" AS ENUM('MUSTACHE', 'F_STRING', 'NONE')
    `);
    await queryRunner.query(`
      CREATE TABLE "prompt_versions" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "prompt_id" uuid NOT NULL,
        "user_id" character varying,
        "version_name" character varying,
        "description" text,
        "model_configuration_id" uuid NOT NULL,
        "template_type" "prompt_versions_template_type_enum" NOT NULL,
        "template_format" "prompt_versions_template_format_enum" NOT NULL,
        "template" jsonb NOT NULL,
        "invocation_parameters" jsonb NOT NULL,
        "tools" jsonb,
        "response_format" jsonb,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_prompt_versions" PRIMARY KEY ("id"),
        CONSTRAINT "FK_prompt_versions_prompt" FOREIGN KEY ("prompt_id") REFERENCES "prompts"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_prompt_versions_model_configuration" FOREIGN KEY ("model_configuration_id") REFERENCES "model_configurations"("id") ON DELETE RESTRICT
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "prompt_versions" CASCADE`);
    await queryRunner.query(`DROP TYPE IF EXISTS "prompt_versions_template_format_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "prompt_versions_template_type_enum"`);
  }
}
