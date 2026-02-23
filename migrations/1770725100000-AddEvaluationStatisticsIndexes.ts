import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddEvaluationStatisticsIndexes1770725100000 implements MigrationInterface {
  name = 'AddEvaluationStatisticsIndexes1770725100000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_score_results_eval_score_er_value_done"
      ON "score_results" ("evaluation_id", "score_id", "experiment_result_id", "value")
      WHERE status = 'DONE' AND value IS NOT NULL
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_experiment_results_experiment_id_id"
      ON "experiment_results" ("experiment_id", "id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_experiment_results_experiment_id_id"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_score_results_eval_score_er_value_done"`);
  }
}