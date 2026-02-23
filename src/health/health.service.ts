import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import {
  HealthIndicatorResult,
  HealthIndicatorService,
} from "@nestjs/terminus";
import { ConfigService } from "@nestjs/config";

@Injectable()
export class HealthService implements OnModuleInit {
  private readonly logger = new Logger(HealthService.name);
  private isApplicationStarted = false;

  constructor(
    private readonly configService: ConfigService,
    private readonly health: HealthIndicatorService,
  ) {}

  onModuleInit(): void {
    const startupDelay = Number.parseInt(
      this.configService.get<string>("APP_STARTUP_DELAY_MS") || "5000",
      10,
    );
    this.logger.debug(
      `Health module initialized, setting startup delay of ${startupDelay}ms`,
    );
    setTimeout(() => {
      this.isApplicationStarted = true;
      this.logger.log("Application startup completed");
    }, startupDelay);
  }

  async checkApplicationStartup(): Promise<HealthIndicatorResult> {
    if (!this.isApplicationStarted) {
      return {
        application_startup: {
          status: "down",
          message: "Application is still starting up",
        },
      };
    }

    return {
      application_startup: {
        status: "up",
        message: "Application has completed startup",
      },
    };
  }
}
