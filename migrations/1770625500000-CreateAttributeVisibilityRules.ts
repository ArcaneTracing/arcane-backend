import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateAttributeVisibilityRules1770625500000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE attribute_visibility_rules (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        attribute_name VARCHAR(255) NOT NULL,
        visible_role_ids UUID[] NOT NULL DEFAULT '{}',
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        created_by_id UUID NOT NULL,
        updated_by_id UUID NULL,
        CONSTRAINT attribute_visibility_rules_project_id_attribute_name_unique 
          UNIQUE (project_id, attribute_name)
      );

      CREATE INDEX idx_attribute_visibility_rules_project_id 
        ON attribute_visibility_rules(project_id);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS idx_attribute_visibility_rules_project_id;
      DROP TABLE IF EXISTS attribute_visibility_rules;
    `);
  }
}
