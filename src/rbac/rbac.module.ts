import { Module, OnModuleInit } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { DataSource } from "typeorm";
import { Role } from "./entities/role.entity";
import { UserRole } from "./entities/user-role.entity";
import { Organisation } from "../organisations/entities/organisation.entity";
import { Project } from "../projects/entities/project.entity";
import { AuditModule } from "../audit/audit.module";
import { RbacService } from "./services/rbac.service";
import { RolesService } from "./services/roles.service";
import { InstanceOwnerService } from "./services/instance-owner.service";
import { OrgPermissionGuard } from "./guards/org-permission.guard";
import { OrgProjectPermissionGuard } from "./guards/org-project-permission.guard";
import { InstancePermissionGuard } from "./guards/instance-permission.guard";
import {
  RolesController,
  ProjectRolesController,
} from "./controllers/roles.controller";
import { InstanceOwnerController } from "./controllers/instance-owner.controller";
import { PermissionsController } from "./controllers/permissions.controller";
import { seedSystemRoles } from "./seed/seed-system-roles";
import { RoleValidator } from "./validators/role.validator";
import { RbacPermissionService } from "./services/rbac-permission.service";
import { RbacMembershipService } from "./services/rbac-membership.service";
import { RbacAssignmentService } from "./services/rbac-assignment.service";
import { RbacSeedService } from "./services/rbac-seed.service";
import { RoleRetrievalService } from "./services/role-retrieval.service";
import { DefaultRoleService } from "./services/default-role.service";
import { UserOnboardingService } from "./services/user-onboarding.service";
import { AuthModule } from "../auth/auth.module";
import { LicenseModule } from "../license/license.module";

@Module({
  imports: [
    TypeOrmModule.forFeature([Role, UserRole, Organisation, Project]),
    AuditModule,
    AuthModule,
    LicenseModule,
  ],
  controllers: [
    RolesController,
    ProjectRolesController,
    InstanceOwnerController,
    PermissionsController,
  ],
  providers: [
    RbacService,
    RoleRetrievalService,
    DefaultRoleService,
    UserOnboardingService,
    RolesService,
    InstanceOwnerService,
    InstancePermissionGuard,
    OrgPermissionGuard,
    OrgProjectPermissionGuard,
    RoleValidator,
    RbacPermissionService,
    RbacMembershipService,
    RbacAssignmentService,
    RbacSeedService,
  ],
  exports: [
    RbacService,
    RoleRetrievalService,
    DefaultRoleService,
    UserOnboardingService,
    RolesService,
    InstanceOwnerService,
    InstancePermissionGuard,
    OrgPermissionGuard,
    OrgProjectPermissionGuard,
    RoleValidator,
    RbacPermissionService,
    RbacMembershipService,
    RbacAssignmentService,
    RbacSeedService,
  ],
})
export class RbacModule implements OnModuleInit {
  constructor(private readonly dataSource: DataSource) {}

  async onModuleInit() {
    await seedSystemRoles(this.dataSource);
  }
}
