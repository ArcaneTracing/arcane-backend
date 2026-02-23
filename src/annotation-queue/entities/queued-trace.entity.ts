import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Unique,
} from "typeorm";
import { AnnotationQueue } from "./annotation-queue.entity";
import { Datasource } from "../../datasources/entities/datasource.entity";
import { Annotation } from "./annotation.entity";

@Entity("queued_traces")
@Unique(["queueId", "otelTraceId", "datasourceId"])
export class QueuedTrace {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ name: "otel_trace_id" })
  otelTraceId: string;

  @ManyToOne(() => Datasource, { onDelete: "SET NULL", nullable: true })
  @JoinColumn({ name: "datasource_id" })
  datasource: Datasource | null;

  @Column({ name: "datasource_id", nullable: true })
  datasourceId: string | null;

  @ManyToOne(() => AnnotationQueue, (queue) => queue.traces, {
    onDelete: "CASCADE",
  })
  @JoinColumn({ name: "queue_id" })
  queue: AnnotationQueue;

  @Column({ name: "queue_id" })
  queueId: string;

  @Column({ type: "timestamp", nullable: true, name: "start_date" })
  startDate?: Date;

  @Column({ type: "timestamp", nullable: true, name: "end_date" })
  endDate?: Date;

  @OneToMany(() => Annotation, (annotation) => annotation.trace, {
    cascade: true,
  })
  annotations: Annotation[];

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt: Date;

  @Column({ nullable: false, name: "created_by_id" })
  createdById: string;
}
