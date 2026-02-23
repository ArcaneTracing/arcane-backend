import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateScores1737010000000 implements MigrationInterface {
  name = 'CreateScores1737010000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "scores_scoring_type_enum" AS ENUM('NUMERIC', 'ORDINAL', 'NOMINAL', 'RAGAS')
    `);
    await queryRunner.query(`
      CREATE TABLE "scores" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "project_id" uuid,
        "name" text NOT NULL,
        "description" text,
        "scoring_type" "scores_scoring_type_enum" NOT NULL,
        "ragas_score_key" character varying,
        "scale" jsonb,
        "ordinal_config" jsonb,
        "evaluator_prompt_id" uuid,
        "created_by_id" character varying,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_scores" PRIMARY KEY ("id"),
        CONSTRAINT "FK_scores_project" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_scores_prompt" FOREIGN KEY ("evaluator_prompt_id") REFERENCES "prompts"("id") ON DELETE SET NULL
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "scores" CASCADE`);
    await queryRunner.query(`DROP TYPE IF EXISTS "scores_scoring_type_enum"`);
  }
}
