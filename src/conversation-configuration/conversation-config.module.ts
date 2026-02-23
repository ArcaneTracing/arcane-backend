import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { ConversationConfiguration } from "./entities/conversation-configuration.entity";
import { ConversationConfigService } from "./services/conversation-config.service";
import { ConversationConfigController } from "./controllers/conversation-config.controller";
import { OrganisationsModule } from "../organisations/organisations.module";
import { RbacModule } from "../rbac/rbac.module";
import { AuditModule } from "../audit/audit.module";
import { Project } from "../projects/entities/project.entity";
import { ConversationConfigYamlService } from "./services/conversation-config-yaml.service";
import { ConversationConfigImportValidator } from "./validators/conversation-config-import.validator";
import { ConversationConfigImportParser } from "./validators/conversation-config-import.parser";

@Module({
  imports: [
    TypeOrmModule.forFeature([ConversationConfiguration, Project]),
    OrganisationsModule,
    RbacModule,
    AuditModule,
  ],
  controllers: [ConversationConfigController],
  providers: [
    ConversationConfigService,
    ConversationConfigYamlService,
    ConversationConfigImportValidator,
    ConversationConfigImportParser,
  ],
  exports: [ConversationConfigService],
})
export class ConversationConfigModule {}
