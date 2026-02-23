import { Test, TestingModule } from "@nestjs/testing";
import { ConfigService } from "@nestjs/config";
import { LicenseService } from "./license.service";
import { validateLicense } from "./validate-license.util";

jest.mock("./validate-license.util", () => ({
  validateLicense: jest.fn(),
}));

describe("LicenseService", () => {
  let service: LicenseService;
  let configService: ConfigService;
  const mockValidateLicense = validateLicense as jest.MockedFunction<
    typeof validateLicense
  >;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LicenseService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) =>
              key === "ARCANE_ENTERPRISE_LICENSE" ? "arcane_test" : undefined,
            ),
          },
        },
      ],
    }).compile();

    service = module.get<LicenseService>(LicenseService);
    configService = module.get<ConfigService>(ConfigService);
    jest.clearAllMocks();
  });

  it("returns true when license is valid", () => {
    mockValidateLicense.mockReturnValue({ valid: true });

    const result = service.isEnterpriseLicensed();

    expect(result).toBe(true);
    expect(mockValidateLicense).toHaveBeenCalledWith("arcane_test");
  });

  it("returns false when license is invalid", () => {
    mockValidateLicense.mockReturnValue({
      valid: false,
      error: "License is expired",
    });

    const result = service.isEnterpriseLicensed();

    expect(result).toBe(false);
    expect(mockValidateLicense).toHaveBeenCalledWith("arcane_test");
  });

  it("returns false when license is undefined", () => {
    jest.spyOn(configService, "get").mockReturnValue(undefined);
    mockValidateLicense.mockReturnValue({
      valid: false,
      error: "License is missing or invalid",
    });

    const result = service.isEnterpriseLicensed();

    expect(result).toBe(false);
    expect(mockValidateLicense).toHaveBeenCalledWith(undefined);
  });

  it("caches result and does not call validateLicense again within TTL", () => {
    mockValidateLicense.mockReturnValue({ valid: true });

    const result1 = service.isEnterpriseLicensed();
    const result2 = service.isEnterpriseLicensed();

    expect(result1).toBe(true);
    expect(result2).toBe(true);
    expect(mockValidateLicense).toHaveBeenCalledTimes(1);
  });
});
