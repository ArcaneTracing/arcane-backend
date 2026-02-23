import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateEntities1737001000000 implements MigrationInterface {
  name = 'CreateEntities1737001000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "entities_matching_pattern_type_enum" AS ENUM('value', 'regex')
    `);
    await queryRunner.query(`
      CREATE TYPE "entities_entity_type_enum" AS ENUM('model', 'tool', 'embedding', 'retriever', 'guardrail', 'evaluator', 'agent')
    `);
    await queryRunner.query(`
      CREATE TABLE "entities" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "name" character varying NOT NULL,
        "description" text,
        "type" character varying NOT NULL,
        "matching_attribute_name" character varying NOT NULL,
        "matching_pattern_type" "entities_matching_pattern_type_enum" NOT NULL,
        "matching_pattern" text,
        "matching_value" text,
        "entity_type" "entities_entity_type_enum" NOT NULL,
        "entity_highlights" jsonb DEFAULT '[]'::jsonb,
        "message_matching" jsonb,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "created_by_id" character varying NOT NULL,
        "organisation_id" uuid NOT NULL,
        CONSTRAINT "PK_entities" PRIMARY KEY ("id"),
        CONSTRAINT "FK_entities_organisation" FOREIGN KEY ("organisation_id") REFERENCES "organisations"("id") ON DELETE CASCADE
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "entities" CASCADE`);
    await queryRunner.query(`DROP TYPE IF EXISTS "entities_entity_type_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "entities_matching_pattern_type_enum"`);
  }
}
