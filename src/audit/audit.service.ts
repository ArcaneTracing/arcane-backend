import { Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { AuditEvent } from "./dto/audit-event.dto";
import { AuditLog } from "./entities/audit-log.entity";
import { DatabaseAuditSink } from "./sinks/database-audit-sink";
import { PaginatedAuditLogsResponseDto } from "./dto/response/paginated-audit-logs-response.dto";

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);
  constructor(
    private readonly sink: DatabaseAuditSink,
    @InjectRepository(AuditLog)
    private readonly auditLogRepository: Repository<AuditLog>,
  ) {}

  async record(event: AuditEvent): Promise<void> {
    await this.writeToSink(event);
  }

  async recordNow(event: AuditEvent): Promise<void> {
    await this.writeToSink(event);
  }

  async findLogs(filter: {
    organisationId?: string;
    projectId?: string;
    action?: string;
    limit?: number;
    cursor?: string;
  }): Promise<AuditLog[]> {
    const query = this.auditLogRepository.createQueryBuilder("audit");
    if (filter.organisationId) {
      query.andWhere("audit.organisation_id = :orgId", {
        orgId: filter.organisationId,
      });
    }
    if (filter.projectId) {
      query.andWhere("audit.project_id = :projectId", {
        projectId: filter.projectId,
      });
    }
    if (filter.action) {
      if (filter.action.includes("*")) {
        const pattern = filter.action.replaceAll("*", "%");
        query.andWhere("audit.action LIKE :action", { action: pattern });
      } else {
        query.andWhere("audit.action = :action", { action: filter.action });
      }
    }
    if (filter.cursor) {
      query.andWhere("audit.created_at < :cursor", {
        cursor: new Date(filter.cursor),
      });
    }
    query.orderBy("audit.created_at", "DESC").limit(filter.limit || 50);
    return await query.getMany();
  }

  async findLogsPaginated(filter: {
    organisationId?: string;
    projectId?: string;
    action?: string;
    limit?: number;
    cursor?: string;
  }): Promise<PaginatedAuditLogsResponseDto> {
    const limit = filter.limit || 50;
    const query = this.auditLogRepository.createQueryBuilder("audit");

    if (filter.organisationId) {
      query.andWhere("audit.organisation_id = :orgId", {
        orgId: filter.organisationId,
      });
    }
    if (filter.projectId) {
      query.andWhere("audit.project_id = :projectId", {
        projectId: filter.projectId,
      });
    }
    if (filter.action) {
      if (filter.action.includes("*")) {
        const pattern = filter.action.replaceAll("*", "%");
        query.andWhere("audit.action LIKE :action", { action: pattern });
      } else {
        query.andWhere("audit.action = :action", { action: filter.action });
      }
    }
    if (filter.cursor) {
      query.andWhere("audit.created_at < :cursor", {
        cursor: new Date(filter.cursor),
      });
    }

    query.orderBy("audit.created_at", "DESC").limit(limit + 1);
    const results = await query.getMany();

    const hasMore = results.length > limit;
    const data = hasMore ? results.slice(0, limit) : results;

    const nextCursor =
      data.length > 0 ? data[data.length - 1].createdAt.toISOString() : null;

    return {
      data,
      nextCursor,
      hasMore,
      limit,
    };
  }

  private async writeToSink(event: AuditEvent): Promise<void> {
    try {
      await this.sink.write([event]);
    } catch (error) {
      this.logger.error("Failed to persist audit event", error as Error);
    }
  }
}
