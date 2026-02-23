import { MigrationInterface, QueryRunner } from 'typeorm';

export class RenameVisibleToHiddenRoleIds1770625600000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE attribute_visibility_rules
      ADD COLUMN hidden_role_ids UUID[] NOT NULL DEFAULT '{}'
    `);

    await queryRunner.query(`
      UPDATE attribute_visibility_rules avr
      SET hidden_role_ids = (
        SELECT COALESCE(array_agg(r.id), ARRAY[]::uuid[])
        FROM roles r
        WHERE (
          r.project_id = avr.project_id
          OR (
            r.organisation_id = (SELECT organisation_id FROM projects p WHERE p.id = avr.project_id)
            AND r.project_id IS NULL
          )
        )
        AND NOT (r.id = ANY(avr.visible_role_ids))
      )
    `);

    await queryRunner.query(`
      ALTER TABLE attribute_visibility_rules
      DROP COLUMN visible_role_ids
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE attribute_visibility_rules
      ADD COLUMN visible_role_ids UUID[] NOT NULL DEFAULT '{}'
    `);

    await queryRunner.query(`
      UPDATE attribute_visibility_rules avr
      SET visible_role_ids = (
        SELECT COALESCE(array_agg(r.id), ARRAY[]::uuid[])
        FROM roles r
        WHERE (
          r.project_id = avr.project_id
          OR (
            r.organisation_id = (SELECT organisation_id FROM projects p WHERE p.id = avr.project_id)
            AND r.project_id IS NULL
          )
        )
        AND NOT (r.id = ANY(avr.hidden_role_ids))
      )
    `);

    await queryRunner.query(`
      ALTER TABLE attribute_visibility_rules
      DROP COLUMN hidden_role_ids
    `);
  }
}
