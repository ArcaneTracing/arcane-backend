import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateDatasources1737002000000 implements MigrationInterface {
  name = 'CreateDatasources1737002000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "datasources_type_enum" AS ENUM('traces')
    `);
    await queryRunner.query(`
      CREATE TYPE "datasources_source_enum" AS ENUM('tempo', 'jaeger', 'clickhouse', 'custom_api')
    `);
    await queryRunner.query(`
      CREATE TABLE "datasources" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "name" character varying NOT NULL,
        "description" text,
        "url" character varying,
        "type" "datasources_type_enum" NOT NULL,
        "source" "datasources_source_enum" NOT NULL,
        "config" jsonb,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "created_by_id" character varying NOT NULL,
        "organisation_id" uuid NOT NULL,
        CONSTRAINT "PK_datasources" PRIMARY KEY ("id"),
        CONSTRAINT "FK_datasources_organisation" FOREIGN KEY ("organisation_id") REFERENCES "organisations"("id") ON DELETE CASCADE
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "datasources" CASCADE`);
    await queryRunner.query(`DROP TYPE IF EXISTS "datasources_source_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "datasources_type_enum"`);
  }
}
