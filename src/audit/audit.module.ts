import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AuditLog } from "./entities/audit-log.entity";
import { AuditService } from "./audit.service";
import { DatabaseAuditSink } from "./sinks/database-audit-sink";

@Module({
  imports: [TypeOrmModule.forFeature([AuditLog])],
  providers: [AuditService, DatabaseAuditSink],
  exports: [AuditService],
})
export class AuditModule {}
