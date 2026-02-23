import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateRoles1737015000000 implements MigrationInterface {
  name = 'CreateRoles1737015000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "roles" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "organisation_id" uuid,
        "project_id" uuid,
        "name" character varying NOT NULL,
        "description" text,
        "permissions" jsonb DEFAULT '[]'::jsonb,
        "is_system_role" boolean DEFAULT false,
        "is_instance_level" boolean DEFAULT false,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_roles" PRIMARY KEY ("id"),
        CONSTRAINT "FK_roles_organisation" FOREIGN KEY ("organisation_id") REFERENCES "organisations"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_roles_project" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "roles" CASCADE`);
  }
}
