import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddExternalIdToEntities1770725510000 implements MigrationInterface {
  name = 'AddExternalIdToEntities1770725510000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const columnExists = await queryRunner.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'entities' AND column_name = 'external_id'
    `);

    if (columnExists.length === 0) {
      await queryRunner.query(`
        ALTER TABLE "entities"
        ADD COLUMN "external_id" VARCHAR(255) NULL
      `);
    }

    const indexExists = await queryRunner.query(`
      SELECT indexname
      FROM pg_indexes
      WHERE tablename = 'entities' AND indexname = 'idx_entities_organisation_external_id'
    `);

    if (indexExists.length === 0) {
      await queryRunner.query(`
        CREATE UNIQUE INDEX "idx_entities_organisation_external_id"
        ON "entities" ("organisation_id", "external_id")
        WHERE "external_id" IS NOT NULL
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_entities_organisation_external_id"`);
    await queryRunner.query(`ALTER TABLE "entities" DROP COLUMN IF EXISTS "external_id"`);
  }
}
