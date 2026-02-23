import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateScoreResults1737014000000 implements MigrationInterface {
  name = 'CreateScoreResults1737014000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "score_results_status_enum" AS ENUM('PENDING', 'DONE')
    `);
    await queryRunner.query(`
      CREATE TABLE "score_results" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "evaluation_id" uuid NOT NULL,
        "score_id" uuid NOT NULL,
        "dataset_row_id" uuid,
        "experiment_result_id" uuid,
        "value" text,
        "reasoning" text,
        "status" "score_results_status_enum" DEFAULT 'PENDING',
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_score_results" PRIMARY KEY ("id"),
        CONSTRAINT "FK_score_results_evaluation" FOREIGN KEY ("evaluation_id") REFERENCES "evaluations"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_score_results_score" FOREIGN KEY ("score_id") REFERENCES "scores"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_score_results_dataset_row" FOREIGN KEY ("dataset_row_id") REFERENCES "dataset_rows"("id") ON DELETE SET NULL,
        CONSTRAINT "FK_score_results_experiment_result" FOREIGN KEY ("experiment_result_id") REFERENCES "experiment_results"("id") ON DELETE SET NULL
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "score_results" CASCADE`);
    await queryRunner.query(`DROP TYPE IF EXISTS "score_results_status_enum"`);
  }
}
