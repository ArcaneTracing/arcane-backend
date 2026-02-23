import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCheckConstraints1737129600000 implements MigrationInterface {
  name = 'AddCheckConstraints1737129600000';

  public async up(queryRunner: QueryRunner): Promise<void> {


    await queryRunner.query(`
      ALTER TABLE annotations 
      ADD CONSTRAINT annotation_exclusive 
      CHECK (
        (trace_id IS NOT NULL AND conversation_id IS NULL) OR 
        (trace_id IS NULL AND conversation_id IS NOT NULL)
      );
    `);
    await queryRunner.query(`
      ALTER TABLE score_results 
      ADD CONSTRAINT score_result_reference 
      CHECK (dataset_row_id IS NOT NULL OR experiment_result_id IS NOT NULL);
    `);


    await queryRunner.query(`
      ALTER TABLE roles 
      ADD CONSTRAINT role_id_consistency
      CHECK (
        (organisation_id IS NULL AND project_id IS NULL) OR 
        (organisation_id IS NOT NULL AND project_id IS NULL) OR 
        (organisation_id IS NOT NULL AND project_id IS NOT NULL)
      );
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {

    await queryRunner.query(`ALTER TABLE roles DROP CONSTRAINT IF EXISTS role_id_consistency;`);
    await queryRunner.query(`ALTER TABLE score_results DROP CONSTRAINT IF EXISTS score_result_reference;`);
    await queryRunner.query(`ALTER TABLE annotations DROP CONSTRAINT IF EXISTS annotation_exclusive;`);
  }
}