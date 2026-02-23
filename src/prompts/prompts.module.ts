import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { HttpModule } from "@nestjs/axios";
import { ConfigModule } from "@nestjs/config";
import { ApiKeyGuard } from "../auth/guards/api-key.guard";
import { PromptsService } from "./services/prompts.service";
import { PromptVersionsService } from "./services/prompt-versions.service";
import { PromptRunnerService } from "./services/prompt-runner.service";
import { PromptConfigValidator } from "./validators/prompt-config.validator";
import { PromptsController } from "./controllers/prompts.controller";
import { PromptVersionsController } from "./controllers/prompt-versions.controller";
import { PromptsInternalController } from "./controllers/prompts-internal.controller";
import { PromptsPublicController } from "./controllers/prompts-public.controller";
import { Prompt } from "./entities/prompt.entity";
import { PromptVersion } from "./entities/prompt-version.entity";
import { ModelConfiguration } from "../model-configuration/entities/model-configuration.entity";
import { ModelConfigurationModule } from "../model-configuration/model-configuration.module";
import { ProjectsModule } from "../projects/projects.module";
import { OrganisationsModule } from "../organisations/organisations.module";
import { RbacModule } from "../rbac/rbac.module";
import { AuditModule } from "../audit/audit.module";
import { Project } from "../projects/entities/project.entity";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Prompt,
      PromptVersion,
      ModelConfiguration,
      Project,
    ]),
    HttpModule,
    ConfigModule,
    ModelConfigurationModule,
    ProjectsModule,
    OrganisationsModule,
    RbacModule,
    AuditModule,
  ],
  controllers: [
    PromptsController,
    PromptVersionsController,
    PromptsInternalController,
    PromptsPublicController,
  ],
  providers: [
    PromptsService,
    PromptVersionsService,
    PromptRunnerService,
    PromptConfigValidator,
    ApiKeyGuard,
  ],
  exports: [
    PromptsService,
    PromptVersionsService,
    PromptRunnerService,
    PromptConfigValidator,
  ],
})
export class PromptsModule {}
