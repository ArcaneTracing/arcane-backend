import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { OrganisationsController } from "./controller/organisations.controller";
import { AdminController } from "./controller/admin.controller";
import { AdminUsersController } from "./controller/admin-users.controller";
import { OrganisationsService } from "./services/organisations.service";
import { AdminUserManagementService } from "./services/admin-user-management.service";
import { Organisation } from "./entities/organisation.entity";
import { OrganisationInvitation } from "./entities/organisation-invitation.entity";
import { RbacModule } from "../rbac/rbac.module";
import { OrganisationRbacService } from "./services/organisation-rbac.service";
import { BetterAuthUser } from "../auth/entities/user.entity";
import { Role } from "../rbac/entities/role.entity";
import { Project } from "../projects/entities/project.entity";
import { OrganisationInvitationService } from "./services/organisation-invitation.service";
import { InvitationsController } from "./controller/invitations.controller";
import { MailerModule } from "../common/mailer/mailer.module";
import { AuthModule } from "../auth/auth.module";
import { AuditModule } from "../audit/audit.module";
import { LicenseModule } from "../license/license.module";
import { AuditLog } from "../audit/entities/audit-log.entity";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Organisation,
      BetterAuthUser,
      Role,
      OrganisationInvitation,
      Project,
      AuditLog,
    ]),
    RbacModule,
    MailerModule,
    AuthModule,
    AuditModule,
    LicenseModule,
  ],
  controllers: [
    OrganisationsController,
    InvitationsController,
    AdminController,
    AdminUsersController,
  ],
  providers: [
    OrganisationsService,
    OrganisationRbacService,
    OrganisationInvitationService,
    AdminUserManagementService,
  ],
  exports: [OrganisationsService, OrganisationInvitationService],
})
export class OrganisationsModule {}
