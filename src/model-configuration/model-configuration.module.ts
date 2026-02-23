import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { ConfigModule } from "@nestjs/config";
import { ModelConfiguration } from "./entities/model-configuration.entity";
import { ModelConfigurationService } from "./services/model-configuration.service";
import { ModelConfigurationController } from "./controllers/model-configuration.controller";
import { ModelConfigurationInternalController } from "./controllers/model-configuration-internal.controller";
import { OrganisationsModule } from "../organisations/organisations.module";
import { RbacModule } from "../rbac/rbac.module";
import { AuditModule } from "../audit/audit.module";
import { Project } from "../projects/entities/project.entity";
import { ApiKeyGuard } from "../auth/guards/api-key.guard";
import { ModelConfigurationProviderConfigValidator } from "./validators/model-configuration-provider-config.validator";
import { EncryptionService } from "../common/encryption/services/encryption.service";

@Module({
  imports: [
    TypeOrmModule.forFeature([ModelConfiguration, Project]),
    ConfigModule,
    OrganisationsModule,
    RbacModule,
    AuditModule,
  ],
  controllers: [
    ModelConfigurationController,
    ModelConfigurationInternalController,
  ],
  providers: [
    ModelConfigurationService,
    EncryptionService,
    ApiKeyGuard,
    ModelConfigurationProviderConfigValidator,
  ],
  exports: [ModelConfigurationService],
})
export class ModelConfigurationModule {}
