import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { EntitiesService } from "./services/entities.service";
import { Entity } from "./entities/entity.entity";
import { RbacModule } from "../rbac/rbac.module";
import { AuditModule } from "../audit/audit.module";
import { ProjectsModule } from "../projects/projects.module";
import { EntitiesController } from "./controllers/entities.controller";
import { EntitiesPublicController } from "./controllers/entities-public.controller";
import { EntitiesYamlService } from "./services/entities-yaml.service";
import { EntityImportParser } from "./validators/entity-import.parser";
import { EntityImportValidator } from "./validators/entity-import.validator";

@Module({
  imports: [
    TypeOrmModule.forFeature([Entity]),
    RbacModule,
    AuditModule,
    ProjectsModule,
  ],
  controllers: [EntitiesController, EntitiesPublicController],
  providers: [
    EntitiesService,
    EntitiesYamlService,
    EntityImportParser,
    EntityImportValidator,
  ],
  exports: [EntitiesService],
})
export class EntitiesModule {}
