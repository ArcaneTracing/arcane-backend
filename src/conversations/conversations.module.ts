import { Module } from "@nestjs/common";
import { HttpModule } from "@nestjs/axios";
import { TypeOrmModule } from "@nestjs/typeorm";
import { ConversationsService } from "./conversations.service";
import { ConversationsController } from "./conversations.controller";
import { DatasourcesModule } from "../datasources/datasources.module";
import { ConversationConfigModule } from "../conversation-configuration/conversation-config.module";
import { TracesModule } from "../traces/traces.module";
import { ProjectsModule } from "../projects/projects.module";
import { RbacModule } from "../rbac/rbac.module";
import { Project } from "../projects/entities/project.entity";
import { TempoConversationRepository } from "./backends/tempo/tempo.conversation.repository";
import { JaegerConversationRepository } from "./backends/jaeger/jaeger.conversation.repository";
import { ClickHouseConversationRepository } from "./backends/clickhouse/clickhouse.conversation.repository";
import { CustomApiConversationRepository } from "./backends/custom-api/custom-api.conversation.repository";
import { ConversationRepositoryFactory } from "./backends/conversation-repository.factory";
@Module({
  imports: [
    HttpModule,
    TypeOrmModule.forFeature([Project]),
    DatasourcesModule,
    ConversationConfigModule,
    TracesModule,
    ProjectsModule,
    RbacModule,
  ],
  controllers: [ConversationsController],
  providers: [
    ConversationsService,
    TempoConversationRepository,
    JaegerConversationRepository,
    ClickHouseConversationRepository,
    CustomApiConversationRepository,
    ConversationRepositoryFactory,
  ],
  exports: [ConversationsService],
})
export class ConversationsModule {}
