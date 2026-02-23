import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AnnotationQueue } from "./entities/annotation-queue.entity";
import { Annotation } from "./entities/annotation.entity";
import { AnnotationTemplate } from "./entities/annotation-template.entity";
import { AnnotationQuestion } from "./entities/annotation-question.entity";
import { AnnotationAnswer } from "./entities/annotation-answer.entity";
import { QueuedTrace } from "./entities/queued-trace.entity";
import { QueuedConversation } from "./entities/queued-conversation.entity";
import { ProjectsModule } from "../projects/projects.module";
import { OrganisationsModule } from "../organisations/organisations.module";
import { DatasourcesModule } from "../datasources/datasources.module";
import { ConversationConfigModule } from "../conversation-configuration/conversation-config.module";
import { RbacModule } from "../rbac/rbac.module";
import { AnnotationQueueController } from "./controllers/annotation-queue.controller";
import { QueueTraceController } from "./controllers/queue-trace.controller";
import { ConversationController } from "./controllers/conversation.controller";
import { AnnotationController } from "./controllers/annotation.controller";
import { QueuedTraceService } from "./services/queued-trace.service";
import { ConversationService } from "./services/conversation.service";
import { AnnotationService } from "./services/annotation.service";
import { AnnotationCreationService } from "./services/annotation-creation.service";
import { AnnotationUpdateService } from "./services/annotation-update.service";
import { AnnotationManagementService } from "./services/annotation-management.service";
import { AnnotationQueueService } from "./services/annotation-queue.service";
import { QueueTemplateService } from "./services/queue-template.service";
import { AnnotationQueueValidator } from "./validators/annotation-queue.validator";
import { AnnotationQueueUpdater } from "./services/annotation-queue-updater.service";
import { QueueBelongsToProjectGuard } from "./guards/queue-belongs-to-project.guard";
import { AnnotationBelongsToQueueGuard } from "./guards/annotation-belongs-to-queue.guard";
import { DatasourceBelongsToOrganisationInterceptor } from "./interceptors/datasource-belongs-to-organisation.interceptor";
import { ConversationConfigExistsGuard } from "./guards/conversation-config-exists.guard";
import { ConversationsQueueGuard } from "./guards/conversations-queue.guard";
import { AnnotationValidator } from "./validators/annotation.validator";
import { Project } from "../projects/entities/project.entity";
import { ConversationConfiguration } from "../conversation-configuration/entities/conversation-configuration.entity";
import { Datasource } from "../datasources/entities/datasource.entity";
import { AuditModule } from "../audit/audit.module";
@Module({
  imports: [
    TypeOrmModule.forFeature([
      AnnotationQueue,
      Annotation,
      AnnotationTemplate,
      AnnotationQuestion,
      AnnotationAnswer,
      QueuedTrace,
      QueuedConversation,
      Project,
      ConversationConfiguration,
      Datasource,
    ]),
    ProjectsModule,
    OrganisationsModule,
    DatasourcesModule,
    ConversationConfigModule,
    RbacModule,
    AuditModule,
  ],
  controllers: [
    AnnotationQueueController,
    QueueTraceController,
    ConversationController,
    AnnotationController,
  ],
  providers: [
    AnnotationQueueService,
    QueueTemplateService,
    QueuedTraceService,
    ConversationService,
    AnnotationService,
    AnnotationCreationService,
    AnnotationUpdateService,
    AnnotationManagementService,
    AnnotationQueueValidator,
    AnnotationQueueUpdater,
    QueueBelongsToProjectGuard,
    AnnotationBelongsToQueueGuard,
    DatasourceBelongsToOrganisationInterceptor,
    ConversationConfigExistsGuard,
    ConversationsQueueGuard,
    AnnotationValidator,
  ],
  exports: [
    AnnotationQueueService,
    QueuedTraceService,
    ConversationService,
    AnnotationService,
    AnnotationCreationService,
    AnnotationUpdateService,
    AnnotationManagementService,
  ],
})
export class AnnotationQueueModule {}
