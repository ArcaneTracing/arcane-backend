import { Module } from "@nestjs/common";
import { TerminusModule, HealthIndicatorService } from "@nestjs/terminus";
import { HealthController } from "./health.controller";
import { HealthService } from "./health.service";

@Module({
  imports: [TerminusModule],
  controllers: [HealthController],
  providers: [HealthService, HealthIndicatorService],
})
export class HealthModule {}
