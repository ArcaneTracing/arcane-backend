import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateModelConfigurations1737003000000 implements MigrationInterface {
  name = 'CreateModelConfigurations1737003000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "model_configurations" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "name" character varying(255) NOT NULL,
        "configuration" jsonb NOT NULL,
        "organisation_id" uuid NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "created_by_id" character varying NOT NULL,
        CONSTRAINT "PK_model_configurations" PRIMARY KEY ("id"),
        CONSTRAINT "FK_model_configurations_organisation" FOREIGN KEY ("organisation_id") REFERENCES "organisations"("id") ON DELETE CASCADE
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "model_configurations" CASCADE`);
  }
}
