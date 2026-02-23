import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from "typeorm";
import { AnnotationTemplate } from "./annotation-template.entity";
import { AnnotationQuestionType } from "./annotation-question-type.enum";

@Entity("annotation_questions")
export class AnnotationQuestion {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column()
  question: string;

  @Column({ type: "text", nullable: true, name: "helper_text" })
  helperText?: string;

  @Column({ type: "text", nullable: true })
  placeholder?: string;

  @Column({
    type: "enum",
    enum: AnnotationQuestionType,
  })
  type: AnnotationQuestionType;

  @Column({ type: "text", array: true, nullable: true })
  options?: string[];

  @Column({ type: "numeric", nullable: true })
  min?: number;

  @Column({ type: "numeric", nullable: true })
  max?: number;

  @Column({ type: "boolean", default: false })
  required?: boolean;

  @Column({ type: "jsonb", nullable: true })
  default?: string | number | boolean;

  @ManyToOne(() => AnnotationTemplate, (template) => template.questions, {
    onDelete: "CASCADE",
  })
  @JoinColumn({ name: "template_id" })
  template: AnnotationTemplate;

  @Column({ name: "template_id" })
  templateId: string;

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt: Date;
}
