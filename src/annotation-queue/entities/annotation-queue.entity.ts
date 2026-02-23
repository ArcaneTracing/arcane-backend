import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from "typeorm";
import { Project } from "../../projects/entities/project.entity";
import { AnnotationTemplate } from "./annotation-template.entity";
import { QueuedTrace } from "./queued-trace.entity";
import { QueuedConversation } from "./queued-conversation.entity";
import { AnnotationQueueType } from "./annotation-queue-type.enum";

@Entity("annotation_queues")
export class AnnotationQueue {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column()
  name: string;

  @Column({ type: "text", nullable: true })
  description?: string;

  @Column({
    type: "enum",
    enum: AnnotationQueueType,
    default: AnnotationQueueType.TRACES,
  })
  type: AnnotationQueueType;

  @ManyToOne(() => Project, { onDelete: "CASCADE" })
  @JoinColumn({ name: "project_id" })
  project: Project;

  @Column({ name: "project_id" })
  projectId: string;

  @ManyToOne(() => AnnotationTemplate, { onDelete: "RESTRICT" })
  @JoinColumn({ name: "template_id" })
  template: AnnotationTemplate;

  @Column({ name: "template_id" })
  templateId: string;

  @OneToMany(() => QueuedTrace, (trace) => trace.queue, {
    cascade: true,
  })
  traces: QueuedTrace[];

  @OneToMany(() => QueuedConversation, (conversation) => conversation.queue, {
    cascade: true,
  })
  conversations: QueuedConversation[];

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt: Date;

  @Column({ nullable: false, name: "created_by_id" })
  createdById: string;
}
