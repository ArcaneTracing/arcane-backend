import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateAnnotationAnswers1737023000000 implements MigrationInterface {
  name = 'CreateAnnotationAnswers1737023000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "annotation_answers" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "question_id" uuid NOT NULL,
        "value" text,
        "number_value" numeric,
        "boolean_value" boolean,
        "string_array_value" text[],
        "annotation_id" uuid NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_annotation_answers" PRIMARY KEY ("id"),
        CONSTRAINT "FK_annotation_answers_question" FOREIGN KEY ("question_id") REFERENCES "annotation_questions"("id") ON DELETE RESTRICT,
        CONSTRAINT "FK_annotation_answers_annotation" FOREIGN KEY ("annotation_id") REFERENCES "annotations"("id") ON DELETE CASCADE
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "annotation_answers" CASCADE`);
  }
}
