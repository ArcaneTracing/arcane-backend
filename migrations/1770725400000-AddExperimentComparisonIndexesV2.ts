import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddExperimentComparisonIndexesV21770725400000 implements MigrationInterface {
  name = 'AddExperimentComparisonIndexesV21770725400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "er_dataset_exp_id"
      ON "experiment_results" ("dataset_row_id", "experiment_id")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "sr_er_eval_score_done"
      ON "score_results" ("experiment_result_id", "evaluation_id", "score_id")
      WHERE status = 'DONE' AND value IS NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "sr_er_eval_score_done"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "er_dataset_exp_id"`);
  }
}