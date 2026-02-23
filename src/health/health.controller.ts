import { Controller, Get } from "@nestjs/common";
import {
  HealthCheck,
  HealthCheckService,
  HealthCheckResult,
} from "@nestjs/terminus";
import { AllowAnonymous } from "@thallesp/nestjs-better-auth";
import { HealthService } from "./health.service";
import { ApiTags, ApiOperation, ApiResponse } from "@nestjs/swagger";

@Controller("health")
@ApiTags("health")
@AllowAnonymous()
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly healthService: HealthService,
  ) {}

  @Get()
  @HealthCheck()
  @ApiOperation({
    summary: "Health check",
    description: "Returns the health status of the application",
  })
  @ApiResponse({ status: 200, description: "Application is healthy" })
  async check(): Promise<HealthCheckResult> {
    return this.health.check([
      async () => this.healthService.checkApplicationStartup(),
    ]);
  }

  @Get("readiness")
  @HealthCheck()
  @ApiOperation({
    summary: "Readiness check",
    description:
      "Checks if the application has completed startup and is ready to serve requests",
  })
  @ApiResponse({ status: 200, description: "Application is ready" })
  async checkReadiness(): Promise<HealthCheckResult> {
    return this.check();
  }
}
