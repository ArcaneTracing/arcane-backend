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
import { ConversationConfiguration } from "../../conversation-configuration/entities/conversation-configuration.entity";
import { Annotation } from "./annotation.entity";

@Entity("queued_conversations")
@Unique([
  "queueId",
  "conversationConfigId",
  "datasourceId",
  "otelConversationId",
])
export class QueuedConversation {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @ManyToOne(() => AnnotationQueue, (queue) => queue.conversations, {
    onDelete: "CASCADE",
  })
  @JoinColumn({ name: "queue_id" })
  queue: AnnotationQueue;

  @Column({ name: "queue_id" })
  queueId: string;

  @ManyToOne(() => ConversationConfiguration, { onDelete: "RESTRICT" })
  @JoinColumn({ name: "conversation_config_id" })
  conversationConfig: ConversationConfiguration;

  @Column({ name: "conversation_config_id" })
  conversationConfigId: string;

  @ManyToOne(() => Datasource, { onDelete: "SET NULL", nullable: true })
  @JoinColumn({ name: "datasource_id" })
  datasource: Datasource | null;

  @Column({ name: "datasource_id", nullable: true })
  datasourceId: string | null;

  @Column({ name: "otel_conversation_id" })
  otelConversationId: string;

  @Column("text", {
    array: true,
    default: () => "ARRAY[]::text[]",
    name: "otel_trace_ids",
  })
  otelTraceIds: string[];

  @Column({ type: "timestamp", nullable: true, name: "start_date" })
  startDate?: Date;

  @Column({ type: "timestamp", nullable: true, name: "end_date" })
  endDate?: Date;

  @OneToMany(() => Annotation, (annotation) => annotation.conversation, {
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
