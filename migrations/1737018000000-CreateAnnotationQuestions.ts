import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateAnnotationQuestions1737018000000 implements MigrationInterface {
  name = 'CreateAnnotationQuestions1737018000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "annotation_questions_type_enum" AS ENUM('TEXT', 'NUMBER', 'BOOLEAN', 'SINGLE_CHOICE', 'MULTIPLE_CHOICE')
    `);
    await queryRunner.query(`
      CREATE TABLE "annotation_questions" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "question" character varying NOT NULL,
        "helper_text" text,
        "placeholder" text,
        "type" "annotation_questions_type_enum" NOT NULL,
        "options" text[],
        "min" numeric,
        "max" numeric,
        "required" boolean DEFAULT false,
        "default" jsonb,
        "template_id" uuid NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_annotation_questions" PRIMARY KEY ("id"),
        CONSTRAINT "FK_annotation_questions_template" FOREIGN KEY ("template_id") REFERENCES "annotation_templates"("id") ON DELETE CASCADE
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "annotation_questions" CASCADE`);
    await queryRunner.query(`DROP TYPE IF EXISTS "annotation_questions_type_enum"`);
  }
}
