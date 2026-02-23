import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPromotedVersionToPrompts1737201000000 implements MigrationInterface {
  name = 'AddPromotedVersionToPrompts1737201000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "prompts" ADD COLUMN "promoted_version_id" uuid NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "prompts" ADD CONSTRAINT "FK_prompts_promoted_version"
        FOREIGN KEY ("promoted_version_id") REFERENCES "prompt_versions"("id") ON DELETE SET NULL
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_prompts_promoted_version" ON "prompts" ("promoted_version_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_prompts_promoted_version"`);
    await queryRunner.query(`ALTER TABLE "prompts" DROP CONSTRAINT IF EXISTS "FK_prompts_promoted_version"`);
    await queryRunner.query(`ALTER TABLE "prompts" DROP COLUMN IF EXISTS "promoted_version_id"`);
  }
}
