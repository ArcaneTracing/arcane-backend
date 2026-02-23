import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateProjectApiKeys1770725500000 implements MigrationInterface {
  name = 'CreateProjectApiKeys1770725500000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "project_api_keys" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "project_id" uuid NOT NULL,
        "fast_hashed_secret_key" character varying NOT NULL,
        "created_by_id" character varying NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "last_used_at" TIMESTAMP,
        CONSTRAINT "PK_project_api_keys" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_project_api_keys_project_id" UNIQUE ("project_id"),
        CONSTRAINT "UQ_project_api_keys_fast_hashed_secret_key" UNIQUE ("fast_hashed_secret_key"),
        CONSTRAINT "FK_project_api_keys_project" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_project_api_keys_fast_hashed_secret_key"
      ON "project_api_keys" ("fast_hashed_secret_key")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_project_api_keys_fast_hashed_secret_key"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "project_api_keys" CASCADE`);
  }
}
