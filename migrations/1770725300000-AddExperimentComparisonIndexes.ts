import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddExperimentComparisonIndexes1770725300000 implements MigrationInterface {
  name = 'AddExperimentComparisonIndexes1770725300000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "er_exp_row_id"
      ON "experiment_results" ("experiment_id", "dataset_row_id", "id")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "sr_eval_score_done"
      ON "score_results" ("evaluation_id", "score_id", "experiment_result_id")
      WHERE status = 'DONE' AND value IS NOT NULL
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "sr_res_score_done"
      ON "score_results" ("experiment_result_id", "score_id")
      WHERE status = 'DONE' AND value IS NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "sr_res_score_done"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "sr_eval_score_done"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "er_exp_row_id"`);
  }
}