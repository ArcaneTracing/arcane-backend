import { Test, TestingModule } from "@nestjs/testing";
import { ConfigService } from "@nestjs/config";
import { HealthIndicatorService } from "@nestjs/terminus";
import { HealthService } from "../../../src/health/health.service";

describe("HealthService", () => {
  let service: HealthService;
  let configService: ConfigService;

  const mockConfigService = {
    get: jest.fn(),
  };

  const mockHealthIndicatorService = {};

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HealthService,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
        {
          provide: HealthIndicatorService,
          useValue: mockHealthIndicatorService,
        },
      ],
    }).compile();

    service = module.get<HealthService>(HealthService);
    configService = module.get<ConfigService>(ConfigService);
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.useRealTimers();
  });

  describe("onModuleInit", () => {
    it("should set application as started after delay", () => {
      jest.useFakeTimers();
      service.onModuleInit();

      expect((service as any).isApplicationStarted).toBe(false);

      jest.advanceTimersByTime(5000);

      expect((service as any).isApplicationStarted).toBe(true);
    });
  });

  describe("checkApplicationStartup", () => {
    it("should return down status if application has not started", async () => {
      (service as any).isApplicationStarted = false;

      const result = await service.checkApplicationStartup();

      expect(result.application_startup.status).toBe("down");
      expect(result.application_startup.message).toBe(
        "Application is still starting up",
      );
    });

    it("should return up status if application has started", async () => {
      (service as any).isApplicationStarted = true;

      const result = await service.checkApplicationStartup();

      expect(result.application_startup.status).toBe("up");
      expect(result.application_startup.message).toBe(
        "Application has completed startup",
      );
    });
  });
});
