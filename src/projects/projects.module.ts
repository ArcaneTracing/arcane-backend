import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { ProjectsService } from "./services/projects.service";
import { ProjectsController } from "./controllers/projects.controller";
import { Project } from "./entities/project.entity";
import { ProjectApiKey } from "./entities/project-api-key.entity";
import { AttributeVisibilityRule } from "./entities/attribute-visibility-rule.entity";
import { Role } from "../rbac/entities/role.entity";
import { OrganisationsModule } from "../organisations/organisations.module";
import { RbacModule } from "../rbac/rbac.module";
import { AuthModule } from "../auth/auth.module";
import { AuditModule } from "../audit/audit.module";
import { LicenseModule } from "../license/license.module";
import { ProjectRbacService } from "./services/project-rbac.service";
import { ProjectManagementService } from "./services/project-management.service";
import { ProjectMembershipService } from "./services/project-membership.service";
import { ProjectApiKeyService } from "./services/project-api-key.service";
import { AttributeVisibilityRuleService } from "./services/attribute-visibility-rule.service";
import { AttributeVisibilityRuleController } from "./controllers/attribute-visibility-rule.controller";
import { ApiKeysController } from "./controllers/api-keys.controller";
import { ProjectApiKeyGuard } from "./guards/project-api-key.guard";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Project,
      ProjectApiKey,
      AttributeVisibilityRule,
      Role,
    ]),
    OrganisationsModule,
    RbacModule,
    AuthModule,
    AuditModule,
    LicenseModule,
  ],
  controllers: [
    ProjectsController,
    AttributeVisibilityRuleController,
    ApiKeysController,
  ],
  providers: [
    ProjectsService,
    ProjectRbacService,
    ProjectManagementService,
    ProjectMembershipService,
    ProjectApiKeyService,
    ProjectApiKeyGuard,
    AttributeVisibilityRuleService,
  ],
  exports: [
    ProjectsService,
    ProjectRbacService,
    ProjectManagementService,
    ProjectMembershipService,
    ProjectApiKeyService,
    ProjectApiKeyGuard,
    AttributeVisibilityRuleService,
  ],
})
export class ProjectsModule {}
