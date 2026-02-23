import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from "typeorm";
import { Organisation } from "../../organisations/entities/organisation.entity";

@Entity("conversation_configurations")
export class ConversationConfiguration {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ type: "varchar", length: 255 })
  name: string;

  @Column({ type: "text", nullable: true })
  description?: string;

  @Column("text", {
    array: true,
    default: () => "ARRAY[]::text[]",
    name: "stitching_attributes_name",
  })
  stitchingAttributesName: string[];

  @ManyToOne(() => Organisation, {
    onDelete: "CASCADE",
  })
  @JoinColumn({ name: "organisation_id" })
  organisation: Organisation;

  @Column({ name: "organisation_id" })
  organisationId: string;

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt: Date;
}
