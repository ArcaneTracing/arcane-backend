import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateDatasetRows1737007000000 implements MigrationInterface {
  name = 'CreateDatasetRows1737007000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "dataset_rows" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "values" jsonb NOT NULL,
        "dataset_id" uuid NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_dataset_rows" PRIMARY KEY ("id"),
        CONSTRAINT "FK_dataset_rows_dataset" FOREIGN KEY ("dataset_id") REFERENCES "datasets"("id") ON DELETE CASCADE
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "dataset_rows" CASCADE`);
  }
}
