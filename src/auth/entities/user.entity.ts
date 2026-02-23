import {
  Entity,
  Column,
  PrimaryColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToMany,
} from "typeorm";
import { Organisation } from "../../organisations/entities/organisation.entity";
import { Project } from "../../projects/entities/project.entity";

@Entity("user", { synchronize: false })
export class BetterAuthUser {
  @PrimaryColumn("text")
  id: string;

  @Column("text")
  name: string;

  @Column("text", { unique: true })
  email: string;

  @Column("boolean")
  emailVerified: boolean;

  @Column("text", { nullable: true })
  image: string | null;

  @CreateDateColumn({ type: "timestamptz" })
  createdAt: Date;

  @UpdateDateColumn({ type: "timestamptz" })
  updatedAt: Date;

  @Column("text", { nullable: true })
  auth0Id: string | null;

  @ManyToMany(() => Organisation, (organisation) => organisation.users)
  organisations: Organisation[];

  @ManyToMany(() => Project, (project) => project.users)
  projects: Project[];
}
