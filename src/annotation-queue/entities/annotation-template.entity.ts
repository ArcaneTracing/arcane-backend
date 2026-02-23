import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from "typeorm";
import { AnnotationQuestion } from "./annotation-question.entity";

@Entity("annotation_templates")
export class AnnotationTemplate {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @OneToMany(() => AnnotationQuestion, (question) => question.template, {
    cascade: true,
    eager: true,
  })
  questions: AnnotationQuestion[];

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt: Date;
}
