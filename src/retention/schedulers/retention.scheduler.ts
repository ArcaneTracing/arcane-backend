import { Injectable } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { RetentionService } from "../services/retention.service";
import { RETENTION_JOB_CRON } from "../config/retention.config";

@Injectable()
export class RetentionScheduler {
  constructor(private readonly retentionService: RetentionService) {}

  @Cron(RETENTION_JOB_CRON)
  async runDailyRetention() {
    await this.retentionService.runAllRetentionPolicies();
  }
}
