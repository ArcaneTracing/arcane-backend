import { MigrationInterface, QueryRunner } from 'typeorm';

export class ChangeScoreResultValueToNumeric1770725200000 implements MigrationInterface {
  name = 'ChangeScoreResultValueToNumeric1770725200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "score_results"
      ALTER COLUMN "value" TYPE double precision
      USING (
        CASE
          WHEN "value" IS NULL OR TRIM("value") = '' OR LOWER(TRIM("value")) = 'n/a' THEN NULL
          ELSE "value"::double precision
        END
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "score_results"
      ALTER COLUMN "value" TYPE text
      USING ("value"::text)
    `);
  }
}
