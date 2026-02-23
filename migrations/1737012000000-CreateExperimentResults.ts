import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateExperimentResults1737012000000 implements MigrationInterface {
  name = 'CreateExperimentResults1737012000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "experiment_results_status_enum" AS ENUM('PENDING', 'DONE')
    `);
    await queryRunner.query(`
      CREATE TABLE "experiment_results" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "experiment_id" uuid NOT NULL,
        "dataset_row_id" uuid NOT NULL,
        "result" text,
        "status" "experiment_results_status_enum" DEFAULT 'PENDING',
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_experiment_results" PRIMARY KEY ("id"),
        CONSTRAINT "FK_experiment_results_experiment" FOREIGN KEY ("experiment_id") REFERENCES "experiments"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_experiment_results_dataset_row" FOREIGN KEY ("dataset_row_id") REFERENCES "dataset_rows"("id") ON DELETE CASCADE
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "experiment_results" CASCADE`);
    await queryRunner.query(`DROP TYPE IF EXISTS "experiment_results_status_enum"`);
  }
}
