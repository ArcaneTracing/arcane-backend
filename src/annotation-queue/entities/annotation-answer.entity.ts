import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from "typeorm";
import { Annotation } from "./annotation.entity";
import { AnnotationQuestion } from "./annotation-question.entity";

@Entity("annotation_answers")
export class AnnotationAnswer {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ name: "question_id" })
  questionId: string;

  @ManyToOne(() => AnnotationQuestion, {
    onDelete: "RESTRICT",
  })
  @JoinColumn({ name: "question_id" })
  question: AnnotationQuestion;

  @Column({ type: "text", nullable: true })
  value?: string;

  @Column({ type: "numeric", nullable: true })
  numberValue?: number;

  @Column({ type: "boolean", nullable: true, name: "boolean_value" })
  booleanValue?: boolean;

  @Column({
    type: "text",
    array: true,
    nullable: true,
    name: "string_array_value",
  })
  stringArrayValue?: string[];

  @ManyToOne(() => Annotation, (annotation) => annotation.answers, {
    onDelete: "CASCADE",
  })
  @JoinColumn({ name: "annotation_id" })
  annotation: Annotation;

  @Column({ name: "annotation_id" })
  annotationId: string;

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt: Date;
}
