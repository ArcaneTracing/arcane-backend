import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateAnnotationQueues1737019000000 implements MigrationInterface {
  name = 'CreateAnnotationQueues1737019000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "annotation_queues_type_enum" AS ENUM('TRACES', 'CONVERSATIONS')
    `);
    await queryRunner.query(`
      CREATE TABLE "annotation_queues" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "name" character varying NOT NULL,
        "description" text,
        "type" "annotation_queues_type_enum" DEFAULT 'TRACES',
        "project_id" uuid NOT NULL,
        "template_id" uuid NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "created_by_id" character varying NOT NULL,
        CONSTRAINT "PK_annotation_queues" PRIMARY KEY ("id"),
        CONSTRAINT "FK_annotation_queues_project" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_annotation_queues_template" FOREIGN KEY ("template_id") REFERENCES "annotation_templates"("id") ON DELETE RESTRICT
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "annotation_queues" CASCADE`);
    await queryRunner.query(`DROP TYPE IF EXISTS "annotation_queues_type_enum"`);
  }
}
