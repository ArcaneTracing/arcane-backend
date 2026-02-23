import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateQueuedTraces1737020000000 implements MigrationInterface {
  name = 'CreateQueuedTraces1737020000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "queued_traces" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "otel_trace_id" character varying NOT NULL,
        "datasource_id" uuid,
        "queue_id" uuid NOT NULL,
        "start_date" TIMESTAMP,
        "end_date" TIMESTAMP,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "created_by_id" character varying NOT NULL,
        CONSTRAINT "PK_queued_traces" PRIMARY KEY ("id"),
        CONSTRAINT "FK_queued_traces_datasource" FOREIGN KEY ("datasource_id") REFERENCES "datasources"("id") ON DELETE SET NULL,
        CONSTRAINT "FK_queued_traces_queue" FOREIGN KEY ("queue_id") REFERENCES "annotation_queues"("id") ON DELETE CASCADE,
        CONSTRAINT "UQ_queued_traces_queue_trace_datasource" UNIQUE ("queue_id", "otel_trace_id", "datasource_id")
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "queued_traces" CASCADE`);
  }
}
