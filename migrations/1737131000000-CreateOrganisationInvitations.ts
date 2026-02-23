import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateOrganisationInvitations1737131000000 implements MigrationInterface {
  name = 'CreateOrganisationInvitations1737131000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "organisation_invitations_status_enum" AS ENUM('pending', 'accepted', 'expired', 'revoked')
    `);
    await queryRunner.query(`
      CREATE TABLE "organisation_invitations" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "organisation_id" uuid NOT NULL,
        "email" character varying NOT NULL,
        "role_id" uuid,
        "token_hash" character varying NOT NULL,
        "status" "organisation_invitations_status_enum" NOT NULL DEFAULT 'pending',
        "expires_at" TIMESTAMP NOT NULL,
        "invited_by" uuid NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "accepted_at" TIMESTAMP,
        CONSTRAINT "PK_organisation_invitations" PRIMARY KEY ("id"),
        CONSTRAINT "FK_organisation_invitations_org" FOREIGN KEY ("organisation_id") REFERENCES "organisations"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_organisation_invitations_role" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE SET NULL
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "IDX_org_invite_pending" ON "organisation_invitations" ("organisation_id", "email")
      WHERE status = 'pending'
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_org_invite_token_hash" ON "organisation_invitations" ("token_hash")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_org_invite_email" ON "organisation_invitations" ("email")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_org_invite_email"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_org_invite_token_hash"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_org_invite_pending"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "organisation_invitations" CASCADE`);
    await queryRunner.query(`DROP TYPE IF EXISTS "organisation_invitations_status_enum"`);
  }
}
