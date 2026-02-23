import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateQueuedConversations1737021000000 implements MigrationInterface {
  name = 'CreateQueuedConversations1737021000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "queued_conversations" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "queue_id" uuid NOT NULL,
        "conversation_config_id" uuid NOT NULL,
        "datasource_id" uuid,
        "otel_conversation_id" character varying NOT NULL,
        "otel_trace_ids" text[] DEFAULT ARRAY[]::text[],
        "start_date" TIMESTAMP,
        "end_date" TIMESTAMP,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "created_by_id" character varying NOT NULL,
        CONSTRAINT "PK_queued_conversations" PRIMARY KEY ("id"),
        CONSTRAINT "FK_queued_conversations_queue" FOREIGN KEY ("queue_id") REFERENCES "annotation_queues"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_queued_conversations_conversation_config" FOREIGN KEY ("conversation_config_id") REFERENCES "conversation_configurations"("id") ON DELETE RESTRICT,
        CONSTRAINT "FK_queued_conversations_datasource" FOREIGN KEY ("datasource_id") REFERENCES "datasources"("id") ON DELETE SET NULL,
        CONSTRAINT "UQ_queued_conversations_unique" UNIQUE ("queue_id", "conversation_config_id", "datasource_id", "otel_conversation_id")
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "queued_conversations" CASCADE`);
  }
}
