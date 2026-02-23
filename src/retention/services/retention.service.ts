import { Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, LessThan } from "typeorm";
import { AuditLog } from "../../audit/entities/audit-log.entity";
import { Experiment } from "../../experiments/entities/experiment.entity";
import { OrganisationInvitation } from "../../organisations/entities/organisation-invitation.entity";
import { Organisation } from "../../organisations/entities/organisation.entity";
import { Project } from "../../projects/entities/project.entity";
import { AuditService } from "../../audit/audit.service";
import {
  DEFAULT_RETENTION,
  RETENTION_CONFIG,
} from "../config/retention.config";
import {
  Evaluation,
  EvaluationScope,
} from "../../evaluations/entities/evaluation.entity";
import { OrganisationInvitationStatus } from "../../organisations/enums/organisation-invitation-status.enum";

export interface RetentionReport {
  timestamp: Date;
  policies: {
    name: string;
    recordsDeleted: number;
    executionTimeMs: number;
    error?: string;
  }[];
}

@Injectable()
export class RetentionService {
  private readonly logger = new Logger(RetentionService.name);
  private readonly BATCH_SIZE = 1000;

  constructor(
    @InjectRepository(AuditLog)
    private readonly auditLogRepository: Repository<AuditLog>,
    @InjectRepository(Evaluation)
    private readonly evaluationRepository: Repository<Evaluation>,
    @InjectRepository(Experiment)
    private readonly experimentRepository: Repository<Experiment>,
    @InjectRepository(OrganisationInvitation)
    private readonly organisationInvitationRepository: Repository<OrganisationInvitation>,
    @InjectRepository(Organisation)
    private readonly organisationRepository: Repository<Organisation>,
    @InjectRepository(Project)
    private readonly projectRepository: Repository<Project>,
    private readonly auditService: AuditService,
  ) {}

  async deleteOldAuditLogs(): Promise<number> {
    const startTime = Date.now();
    this.logger.log("Starting audit logs retention job");

    try {
      let totalDeleted = 0;
      const organisations = await this.organisationRepository.find();

      for (const org of organisations) {
        const retentionDays =
          org.auditLogRetentionDays ?? DEFAULT_RETENTION.AUDIT_LOGS;
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

        let batchDeleted = 0;
        const hasMore = true;

        while (hasMore) {
          const batch = await this.auditLogRepository.find({
            where: {
              organisationId: org.id,
              createdAt: LessThan(cutoffDate),
            },
            take: this.BATCH_SIZE,
          });

          if (batch.length === 0) {
            break;
          }

          const ids = batch.map((log) => log.id);
          await this.auditLogRepository.delete(ids);
          batchDeleted += batch.length;
          totalDeleted += batch.length;

          this.logger.debug(
            `Deleted ${batch.length} audit logs for organisation ${org.id}`,
          );
        }

        if (batchDeleted > 0) {
          await this.auditService.record({
            action: "retention.deleted",
            actorId: null,
            actorType: "system",
            resourceType: "audit_log",
            resourceId: null,
            organisationId: org.id,
            metadata: {
              retentionPolicy: "audit_logs",
              retentionDays,
              recordsDeleted: batchDeleted,
            },
          });
        }
      }

      const executionTime = Date.now() - startTime;
      this.logger.log(
        `Audit logs retention job completed: ${totalDeleted} records deleted in ${executionTime}ms`,
      );

      return totalDeleted;
    } catch (error) {
      const executionTime = Date.now() - startTime;
      this.logger.error(
        `Audit logs retention job failed after ${executionTime}ms: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  async deleteOldEvaluations(): Promise<number> {
    const startTime = Date.now();
    this.logger.log("Starting evaluations retention job");

    try {
      let totalDeleted = 0;
      const projects = await this.projectRepository.find();

      for (const project of projects) {
        const retentionDays =
          project.evaluationRetentionDays ?? DEFAULT_RETENTION.EVALUATIONS;
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

        let batchDeleted = 0;
        const hasMore = true;

        while (hasMore) {
          const batch = await this.evaluationRepository.find({
            where: {
              projectId: project.id,
              createdAt: LessThan(cutoffDate),
            },
            take: this.BATCH_SIZE,
          });

          if (batch.length === 0) {
            break;
          }

          const ids = batch.map((evaluation) => evaluation.id);
          await this.evaluationRepository.delete(ids);
          batchDeleted += batch.length;
          totalDeleted += batch.length;

          this.logger.debug(
            `Deleted ${batch.length} evaluations for project ${project.id}`,
          );
        }

        if (batchDeleted > 0) {
          await this.auditService.record({
            action: "retention.deleted",
            actorId: null,
            actorType: "system",
            resourceType: "evaluation",
            resourceId: null,
            organisationId: project.organisationId,
            projectId: project.id,
            metadata: {
              retentionPolicy: "evaluations",
              retentionDays,
              recordsDeleted: batchDeleted,
            },
          });
        }
      }

      const executionTime = Date.now() - startTime;
      this.logger.log(
        `Evaluations retention job completed: ${totalDeleted} records deleted in ${executionTime}ms`,
      );

      return totalDeleted;
    } catch (error) {
      const executionTime = Date.now() - startTime;
      this.logger.error(
        `Evaluations retention job failed after ${executionTime}ms: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  async deleteOldExperiments(): Promise<number> {
    const startTime = Date.now();
    this.logger.log("Starting experiments retention job");

    try {
      let totalDeleted = 0;
      let evaluationsDeleted = 0;
      const projects = await this.projectRepository.find({
        where: { experimentRetentionDays: LessThan(999999) },
      });

      for (const project of projects) {
        const retentionDays =
          project.experimentRetentionDays ?? DEFAULT_RETENTION.EXPERIMENTS;
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

        const experimentsToDelete = await this.experimentRepository.find({
          where: {
            projectId: project.id,
            createdAt: LessThan(cutoffDate),
          },
        });

        const experimentIds = experimentsToDelete.map((exp) => exp.id);
        if (experimentIds.length > 0) {
          const evaluationsToDelete = await this.evaluationRepository
            .createQueryBuilder("eval")
            .innerJoin(
              "evaluation_experiments",
              "ee",
              "ee.evaluation_id = eval.id",
            )
            .where("eval.evaluationScope = :scope", {
              scope: EvaluationScope.EXPERIMENT,
            })
            .andWhere("eval.projectId = :projectId", { projectId: project.id })
            .andWhere("ee.experiment_id IN (:...ids)", { ids: experimentIds })
            .getMany();

          if (evaluationsToDelete.length > 0) {
            const evalIds = evaluationsToDelete.map(
              (evaluation) => evaluation.id,
            );
            await this.evaluationRepository.delete(evalIds);
            evaluationsDeleted += evaluationsToDelete.length;
            this.logger.log(
              `Deleted ${evaluationsToDelete.length} evaluations referencing experiments for project ${project.id}`,
            );
          }
        }

        let batchDeleted = 0;
        const hasMore = true;

        while (hasMore) {
          const batch = await this.experimentRepository.find({
            where: {
              projectId: project.id,
              createdAt: LessThan(cutoffDate),
            },
            take: this.BATCH_SIZE,
          });

          if (batch.length === 0) {
            break;
          }

          const ids = batch.map((exp) => exp.id);
          await this.experimentRepository.delete(ids);
          batchDeleted += batch.length;
          totalDeleted += batch.length;

          this.logger.debug(
            `Deleted ${batch.length} experiments for project ${project.id}`,
          );
        }

        if (batchDeleted > 0 || evaluationsDeleted > 0) {
          await this.auditService.record({
            action: "retention.deleted",
            actorId: null,
            actorType: "system",
            resourceType: "experiment",
            resourceId: null,
            organisationId: project.organisationId,
            projectId: project.id,
            metadata: {
              retentionPolicy: "experiments",
              retentionDays,
              experimentsDeleted: batchDeleted,
              evaluationsDeleted,
            },
          });
        }
      }

      const executionTime = Date.now() - startTime;
      this.logger.log(
        `Experiments retention job completed: ${totalDeleted} experiments deleted, ${evaluationsDeleted} evaluations deleted in ${executionTime}ms`,
      );

      return totalDeleted;
    } catch (error) {
      const executionTime = Date.now() - startTime;
      this.logger.error(
        `Experiments retention job failed after ${executionTime}ms: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  async deleteOldOrganisationInvitations(): Promise<number> {
    const startTime = Date.now();
    this.logger.log("Starting organisation invitations retention job");

    try {
      const cutoffDateExpiredRevoked = new Date();
      cutoffDateExpiredRevoked.setDate(
        cutoffDateExpiredRevoked.getDate() -
          RETENTION_CONFIG.INVITATIONS.EXPIRED_REJECTED_RETENTION_DAYS,
      );

      const cutoffDateAccepted = new Date();
      cutoffDateAccepted.setDate(
        cutoffDateAccepted.getDate() -
          RETENTION_CONFIG.INVITATIONS.ACCEPTED_RETENTION_DAYS,
      );

      const result1 = await this.organisationInvitationRepository
        .createQueryBuilder()
        .delete()
        .where(
          "(status = :expired OR status = :revoked) AND created_at < :cutoffExpiredRevoked",
          {
            expired: OrganisationInvitationStatus.EXPIRED,
            revoked: OrganisationInvitationStatus.REVOKED,
            cutoffExpiredRevoked: cutoffDateExpiredRevoked,
          },
        )
        .execute();

      const result2 = await this.organisationInvitationRepository
        .createQueryBuilder()
        .delete()
        .where("status = :accepted AND accepted_at < :cutoffAccepted", {
          accepted: OrganisationInvitationStatus.ACCEPTED,
          cutoffAccepted: cutoffDateAccepted,
        })
        .execute();

      const totalDeleted = (result1.affected || 0) + (result2.affected || 0);

      if (totalDeleted > 0) {
        await this.auditService.record({
          action: "retention.deleted",
          actorId: null,
          actorType: "system",
          resourceType: "organisation_invitation",
          resourceId: null,
          metadata: {
            retentionPolicy: "organisation_invitations",
            recordsDeleted: totalDeleted,
          },
        });
      }

      const executionTime = Date.now() - startTime;
      this.logger.log(
        `Organisation invitations retention job completed: ${totalDeleted} records deleted in ${executionTime}ms`,
      );

      return totalDeleted;
    } catch (error) {
      const executionTime = Date.now() - startTime;
      this.logger.error(
        `Organisation invitations retention job failed after ${executionTime}ms: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  async runAllRetentionPolicies(): Promise<RetentionReport> {
    const timestamp = new Date();
    const policies: RetentionReport["policies"] = [];

    const policiesToRun = [
      {
        name: "audit_logs",
        fn: () => this.deleteOldAuditLogs(),
      },
      {
        name: "evaluations",
        fn: () => this.deleteOldEvaluations(),
      },
      {
        name: "experiments",
        fn: () => this.deleteOldExperiments(),
      },
      {
        name: "organisation_invitations",
        fn: () => this.deleteOldOrganisationInvitations(),
      },
    ];

    for (const policy of policiesToRun) {
      const policyStartTime = Date.now();
      try {
        const recordsDeleted = await policy.fn();
        const executionTime = Date.now() - policyStartTime;
        policies.push({
          name: policy.name,
          recordsDeleted,
          executionTimeMs: executionTime,
        });
      } catch (error) {
        const executionTime = Date.now() - policyStartTime;
        policies.push({
          name: policy.name,
          recordsDeleted: 0,
          executionTimeMs: executionTime,
          error: error.message,
        });
        this.logger.error(
          `Retention policy ${policy.name} failed: ${error.message}`,
          error.stack,
        );
      }
    }

    return {
      timestamp,
      policies,
    };
  }
}
