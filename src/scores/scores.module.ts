import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { ScoresService } from "./services/scores.service";
import { ScoresController } from "./controllers/scores.controller";
import { Score } from "./entities/score.entity";
import { Prompt } from "../prompts/entities/prompt.entity";
import { Project } from "../projects/entities/project.entity";
import { ProjectsModule } from "../projects/projects.module";
import { ScoresRagasService } from "./services/scores-ragas.service";
import { RbacModule } from "../rbac/rbac.module";
import { AuditModule } from "../audit/audit.module";

@Module({
  imports: [
    TypeOrmModule.forFeature([Score, Prompt, Project]),
    ProjectsModule,
    RbacModule,
    AuditModule,
  ],
  controllers: [ScoresController],
  providers: [ScoresService, ScoresRagasService],
  exports: [ScoresService, ScoresRagasService],
})
export class ScoresModule {}
