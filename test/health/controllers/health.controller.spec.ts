jest.mock("@thallesp/nestjs-better-auth", () => ({
  AllowAnonymous:
    () => (target: any, propertyKey?: string, descriptor?: any) => {},
}));

import { Test, TestingModule } from "@nestjs/testing";
import { HealthController } from "../../../src/health/health.controller";
import { HealthService } from "../../../src/health/health.service";
import { HealthCheckService, HealthCheckResult } from "@nestjs/terminus";

describe("HealthController", () => {
  let controller: HealthController;
  let healthCheckService: HealthCheckService;
  let healthService: HealthService;

  const mockHealthCheckService = {
    check: jest.fn(),
  };

  const mockHealthService = {
    checkApplicationStartup: jest.fn(),
  };

  const mockHealthResult: HealthCheckResult = {
    status: "ok",
    info: {
      application_startup: {
        status: "up",
      },
    },
    error: {},
    details: {
      application_startup: {
        status: "up",
      },
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        {
          provide: HealthCheckService,
          useValue: mockHealthCheckService,
        },
        {
          provide: HealthService,
          useValue: mockHealthService,
        },
      ],
    }).compile();

    controller = module.get<HealthController>(HealthController);
    healthCheckService = module.get<HealthCheckService>(HealthCheckService);
    healthService = module.get<HealthService>(HealthService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("check", () => {
    it("should perform basic health check", async () => {
      mockHealthCheckService.check.mockImplementation(async (checks) => {
        for (const check of checks) {
          await check();
        }
        return mockHealthResult;
      });
      mockHealthService.checkApplicationStartup.mockResolvedValue({
        application_startup: { status: "up" },
      });

      const result = await controller.check();

      expect(result).toEqual(mockHealthResult);
      expect(healthCheckService.check).toHaveBeenCalled();
      expect(healthService.checkApplicationStartup).toHaveBeenCalled();
    });
  });

  describe("checkReadiness", () => {
    it("should perform readiness check", async () => {
      mockHealthCheckService.check.mockImplementation(async (checks) => {
        for (const check of checks) {
          await check();
        }
        return mockHealthResult;
      });
      mockHealthService.checkApplicationStartup.mockResolvedValue({
        application_startup: { status: "up" },
      });

      const result = await controller.checkReadiness();

      expect(result).toEqual(mockHealthResult);
      expect(healthCheckService.check).toHaveBeenCalled();
      expect(healthService.checkApplicationStartup).toHaveBeenCalled();
    });
  });
});
