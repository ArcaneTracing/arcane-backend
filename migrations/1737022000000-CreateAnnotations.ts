import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateAnnotations1737022000000 implements MigrationInterface {
  name = 'CreateAnnotations1737022000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "annotations" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "trace_id" uuid,
        "conversation_id" uuid,
        "start_date" TIMESTAMP,
        "end_date" TIMESTAMP,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "created_by_id" character varying NOT NULL,
        CONSTRAINT "PK_annotations" PRIMARY KEY ("id"),
        CONSTRAINT "FK_annotations_trace" FOREIGN KEY ("trace_id") REFERENCES "queued_traces"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_annotations_conversation" FOREIGN KEY ("conversation_id") REFERENCES "queued_conversations"("id") ON DELETE CASCADE,
        CONSTRAINT "UQ_annotations_trace" UNIQUE ("trace_id"),
        CONSTRAINT "UQ_annotations_conversation" UNIQUE ("conversation_id")
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "annotations" CASCADE`);
  }
}
