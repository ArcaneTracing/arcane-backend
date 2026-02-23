import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCustomEntityTypeAndIconId1737200000000 implements MigrationInterface {
  name = 'AddCustomEntityTypeAndIconId1737200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {


    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TYPE "entities_entity_type_enum" ADD VALUE IF NOT EXISTS 'custom';
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);
    const iconIdColumnExists = await queryRunner.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'entities' AND column_name = 'icon_id'
    `);

    if (iconIdColumnExists.length === 0) {
      await queryRunner.query(`
        ALTER TABLE "entities" 
        ADD COLUMN "icon_id" VARCHAR(255) NULL
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {

    await queryRunner.query(`
      ALTER TABLE "entities" 
      DROP COLUMN IF EXISTS "icon_id"
    `);

  }
}