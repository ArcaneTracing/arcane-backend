import { MigrationInterface, QueryRunner } from 'typeorm';


export class AddCompositeIndexes1737129800000 implements MigrationInterface {
  name = 'AddCompositeIndexes1737129800000';

  public async up(queryRunner: QueryRunner): Promise<void> {


    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_evaluations_project_type_scope" 
      ON "evaluations" ("project_id", "evaluation_type", "evaluation_scope");
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_experiment_results_experiment_status" 
      ON "experiment_results" ("experiment_id", "status");
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_score_results_evaluation_score" 
      ON "score_results" ("evaluation_id", "score_id");
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_roles_organisation_project" 
      ON "roles" ("organisation_id", "project_id");
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_annotation_queues_project_type" 
      ON "annotation_queues" ("project_id", "type");
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_prompts_project_name" 
      ON "prompts" ("project_id", "name");
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {

    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_prompts_project_name";`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_annotation_queues_project_type";`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_roles_organisation_project";`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_score_results_evaluation_score";`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_experiment_results_experiment_status";`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_evaluations_project_type_scope";`);
  }
}