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
import { AnnotationAnswer } from "./annotation-answer.entity";
import { QueuedTrace } from "./queued-trace.entity";
import { QueuedConversation } from "./queued-conversation.entity";

@Entity("annotations")
@Unique(["traceId"])
@Unique(["conversationId"])
export class Annotation {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @ManyToOne(() => QueuedTrace, (queuedTrace) => queuedTrace.annotations, {
    onDelete: "CASCADE",
    nullable: true,
  })
  @JoinColumn({ name: "trace_id" })
  trace: QueuedTrace | null;

  @Column({ nullable: true, name: "trace_id" })
  traceId: string | null;

  @ManyToOne(
    () => QueuedConversation,
    (qeuedConversation) => qeuedConversation.annotations,
    {
      onDelete: "CASCADE",
      nullable: true,
    },
  )
  @JoinColumn({ name: "conversation_id" })
  conversation: QueuedConversation | null;

  @Column({ nullable: true, name: "conversation_id" })
  conversationId: string | null;

  @OneToMany(() => AnnotationAnswer, (answer) => answer.annotation, {
    cascade: true,
    eager: true,
  })
  answers: AnnotationAnswer[];

  @Column({ type: "timestamp", nullable: true, name: "start_date" })
  startDate?: Date;

  @Column({ type: "timestamp", nullable: true, name: "end_date" })
  endDate?: Date;

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt: Date;

  @Column({ nullable: false, name: "created_by_id" })
  createdById: string;
}
