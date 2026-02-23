import { Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { AuditLog } from "../entities/audit-log.entity";
import { AuditEvent } from "../dto/audit-event.dto";

@Injectable()
export class DatabaseAuditSink {
  private readonly logger = new Logger(DatabaseAuditSink.name);

  constructor(
    @InjectRepository(AuditLog)
    private readonly auditLogRepository: Repository<AuditLog>,
  ) {}

  async write(events: AuditEvent[]): Promise<void> {
    if (events.length === 0) {
      return;
    }

    const records = events.map((event) => {
      const record = new AuditLog();
      record.action = event.action;
      record.actorId = event.actorId;
      record.actorType = event.actorType;
      record.resourceType = event.resourceType;
      record.resourceId = event.resourceId;
      record.metadata = event.metadata;
      record.beforeState = event.beforeState;
      record.afterState = event.afterState;
      record.organisationId = event.organisationId;
      record.projectId = event.projectId;
      return record;
    });

    await this.auditLogRepository.save(records);
    this.logger.debug(`Persisted ${records.length} audit events`);
  }
}
