import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from "typeorm";
import { Organisation } from "../../organisations/entities/organisation.entity";

export enum DatasourceType {
  TRACES = "traces",
}

export enum DatasourceSource {
  TEMPO = "tempo",
  JAEGER = "jaeger",
  CLICKHOUSE = "clickhouse",
  CUSTOM_API = "custom_api",
}

@Entity("datasources")
export class Datasource {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column()
  name: string;

  @Column({ type: "text", nullable: true })
  description: string;

  @Column({ nullable: true })
  url: string;

  @Column({
    type: "enum",
    enum: DatasourceType,
  })
  type: DatasourceType;

  @Column({
    type: "enum",
    enum: DatasourceSource,
  })
  source: DatasourceSource;

  @Column({ type: "jsonb", nullable: true })
  config: Record<string, any> | null;

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt: Date;

  @Column({ name: "created_by_id" })
  createdById: string;

  @ManyToOne(() => Organisation, {
    onDelete: "CASCADE",
  })
  @JoinColumn({ name: "organisation_id" })
  organisation: Organisation;

  @Column({ name: "organisation_id" })
  organisationId: string;
}
