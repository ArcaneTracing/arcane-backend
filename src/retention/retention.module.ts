import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AuditLog } from "../audit/entities/audit-log.entity";
import { Evaluation } from "../evaluations/entities/evaluation.entity";
import { Experiment } from "../experiments/entities/experiment.entity";
import { OrganisationInvitation } from "../organisations/entities/organisation-invitation.entity";
import { Organisation } from "../organisations/entities/organisation.entity";
import { Project } from "../projects/entities/project.entity";
import { AuditModule } from "../audit/audit.module";
import { RbacModule } from "../rbac/rbac.module";
import { RetentionService } from "./services/retention.service";
import { RetentionScheduler } from "./schedulers/retention.scheduler";
import { RetentionController } from "./controllers/retention.controller";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      AuditLog,
      Evaluation,
      Experiment,
      OrganisationInvitation,
      Organisation,
      Project,
    ]),
    AuditModule,
    RbacModule,
  ],
  controllers: [RetentionController],
  providers: [RetentionService, RetentionScheduler],
  exports: [RetentionService],
})
export class RetentionModule {}
