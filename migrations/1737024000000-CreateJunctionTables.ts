import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateJunctionTables1737024000000 implements MigrationInterface {
  name = 'CreateJunctionTables1737024000000';

  public async up(queryRunner: QueryRunner): Promise<void> {

    await queryRunner.query(`
      CREATE TABLE "organisation_users" (
        "organisation_id" uuid NOT NULL,
        "user_id" text NOT NULL,
        CONSTRAINT "PK_organisation_users" PRIMARY KEY ("organisation_id", "user_id"),
        CONSTRAINT "FK_organisation_users_organisation" FOREIGN KEY ("organisation_id") REFERENCES "organisations"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_organisation_users_user" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE
      )
    `);


    await queryRunner.query(`
      CREATE TABLE "project_users" (
        "project_id" uuid NOT NULL,
        "user_id" text NOT NULL,
        CONSTRAINT "PK_project_users" PRIMARY KEY ("project_id", "user_id"),
        CONSTRAINT "FK_project_users_project" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_project_users_user" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "project_users" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "organisation_users" CASCADE`);
  }
}