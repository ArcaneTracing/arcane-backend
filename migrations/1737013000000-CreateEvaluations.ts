import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateEvaluations1737013000000 implements MigrationInterface {
  name = 'CreateEvaluations1737013000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "evaluations_evaluation_type_enum" AS ENUM('AUTOMATIC', 'MANUAL')
    `);
    await queryRunner.query(`
      CREATE TYPE "evaluations_evaluation_scope_enum" AS ENUM('DATASET', 'EXPERIMENT')
    `);
    await queryRunner.query(`
      CREATE TABLE "evaluations" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "project_id" uuid NOT NULL,
        "evaluation_type" "evaluations_evaluation_type_enum" NOT NULL,
        "evaluation_scope" "evaluations_evaluation_scope_enum" NOT NULL,
        "name" character varying NOT NULL,
        "description" character varying,
        "dataset_id" uuid,
        "metadata" jsonb,
        "score_mappings" jsonb,
        "ragas_model_configuration_id" character varying,
        "created_by_id" character varying,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_evaluations" PRIMARY KEY ("id"),
        CONSTRAINT "FK_evaluations_project" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_evaluations_dataset" FOREIGN KEY ("dataset_id") REFERENCES "datasets"("id") ON DELETE SET NULL
      )
    `);
    await queryRunner.query(`
      CREATE TABLE "evaluation_experiments" (
        "evaluation_id" uuid NOT NULL,
        "experiment_id" uuid NOT NULL,
        CONSTRAINT "PK_evaluation_experiments" PRIMARY KEY ("evaluation_id", "experiment_id"),
        CONSTRAINT "FK_evaluation_experiments_evaluation" FOREIGN KEY ("evaluation_id") REFERENCES "evaluations"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_evaluation_experiments_experiment" FOREIGN KEY ("experiment_id") REFERENCES "experiments"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`
      CREATE TABLE "evaluation_scores" (
        "evaluation_id" uuid NOT NULL,
        "score_id" uuid NOT NULL,
        CONSTRAINT "PK_evaluation_scores" PRIMARY KEY ("evaluation_id", "score_id"),
        CONSTRAINT "FK_evaluation_scores_evaluation" FOREIGN KEY ("evaluation_id") REFERENCES "evaluations"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_evaluation_scores_score" FOREIGN KEY ("score_id") REFERENCES "scores"("id") ON DELETE CASCADE
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "evaluation_scores" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "evaluation_experiments" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "evaluations" CASCADE`);
    await queryRunner.query(`DROP TYPE IF EXISTS "evaluations_evaluation_scope_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "evaluations_evaluation_type_enum"`);
  }
}
