import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateConversationConfigurations1737004000000 implements MigrationInterface {
  name = 'CreateConversationConfigurations1737004000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "conversation_configurations" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "name" character varying(255) NOT NULL,
        "description" text,
        "stitching_attributes_name" text[] DEFAULT ARRAY[]::text[],
        "organisation_id" uuid NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_conversation_configurations" PRIMARY KEY ("id"),
        CONSTRAINT "FK_conversation_configurations_organisation" FOREIGN KEY ("organisation_id") REFERENCES "organisations"("id") ON DELETE CASCADE
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "conversation_configurations" CASCADE`);
  }
}
