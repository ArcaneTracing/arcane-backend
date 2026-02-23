import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AuthModule as BetterAuthModule } from "@thallesp/nestjs-better-auth";
import { ProjectsModule } from "./projects/projects.module";
import { DatasourcesModule } from "./datasources/datasources.module";
import { TracesModule } from "./traces/traces.module";
import { HealthModule } from "./health/health.module";
import { DatasetsModule } from "./datasets/datasets.module";
import { EntitiesModule } from "./entities/entities.module";
import { ConversationConfigModule } from "./conversation-configuration/conversation-config.module";
import { AnnotationQueueModule } from "./annotation-queue/annotation-queue.module";
import { PromptsModule } from "./prompts/prompts.module";
import { ModelConfigurationModule } from "./model-configuration/model-configuration.module";
import { ConversationsModule } from "./conversations/conversations.module";
import { ScoresModule } from "./scores/scores.module";
import { ExperimentsModule } from "./experiments/experiments.module";
import { EvaluationsModule } from "./evaluations/evaluations.module";
import { OrganisationsModule } from "./organisations/organisations.module";
import { RbacModule } from "./rbac/rbac.module";
import { CacheModule } from "./common/cache/cache.module";
import { EncryptionModule } from "./common/encryption/encryption.module";
import { AuthModule } from "./auth/auth.module";
import { AuditModule } from "./audit/audit.module";
import { RetentionModule } from "./retention/retention.module";
import { LicenseModule } from "./license/license.module";
import { auth } from "./auth";
import { UserCreatedHook } from "./auth/services/auth-hooks.service";
import { ScheduleModule } from "@nestjs/schedule";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    ScheduleModule.forRoot(),
    CacheModule,
    EncryptionModule,
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => {
        const databaseUrl = configService.get("DATABASE_URL");
        if (!databaseUrl) {
          throw new Error("DATABASE_URL environment variable is not set");
        }

        const url = new URL(databaseUrl);

        return {
          type: "postgres",
          host: url.hostname,
          port: Number.parseInt(url.port) || 5432,
          username: url.username,
          password: url.password,
          database: url.pathname.slice(1),
          entities: [__dirname + "/**/*.entity{.ts,.js}"],
          synchronize: configService.get("NODE_ENV") === "local",
          logging: false,
          ssl:
            configService.get("DATABASE_SSL") === "true"
              ? { rejectUnauthorized: false }
              : false,
        };
      },
      inject: [ConfigService],
    }),
    HealthModule,
    ProjectsModule,
    DatasourcesModule,
    TracesModule,
    DatasetsModule,
    EntitiesModule,
    ConversationConfigModule,
    AnnotationQueueModule,
    PromptsModule,
    ModelConfigurationModule,
    ConversationsModule,
    ScoresModule,
    ExperimentsModule,
    EvaluationsModule,
    OrganisationsModule,
    RbacModule,
    AuthModule,
    AuditModule,
    RetentionModule,
    LicenseModule,
    BetterAuthModule.forRoot({
      auth,
      disableTrustedOriginsCors: process.env.NODE_ENV === "development",
    }),
  ],
  providers: [UserCreatedHook],
})
export class AppModule {}
