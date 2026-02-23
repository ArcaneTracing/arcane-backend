import { Test, TestingModule } from "@nestjs/testing";
import { ExecutionContext, ForbiddenException } from "@nestjs/common";
import { EnterpriseLicenseGuard } from "./enterprise-license.guard";
import { LicenseService } from "../license.service";
import { ERROR_MESSAGES } from "../../common/constants/error-messages.constants";

describe("EnterpriseLicenseGuard", () => {
  let guard: EnterpriseLicenseGuard;
  let licenseService: LicenseService;

  const mockExecutionContext = {
    getHandler: jest.fn(),
    getClass: jest.fn(),
    switchToHttp: jest.fn().mockReturnValue({
      getRequest: jest.fn(),
      getResponse: jest.fn(),
      getNext: jest.fn(),
    }),
  } as unknown as ExecutionContext;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EnterpriseLicenseGuard,
        {
          provide: LicenseService,
          useValue: {
            isEnterpriseLicensed: jest.fn(),
          },
        },
      ],
    }).compile();

    guard = module.get<EnterpriseLicenseGuard>(EnterpriseLicenseGuard);
    licenseService = module.get<LicenseService>(LicenseService);
    jest.clearAllMocks();
  });

  it("returns true when license is valid", () => {
    jest.spyOn(licenseService, "isEnterpriseLicensed").mockReturnValue(true);

    const result = guard.canActivate(mockExecutionContext);

    expect(result).toBe(true);
    expect(licenseService.isEnterpriseLicensed).toHaveBeenCalled();
  });

  it("throws ForbiddenException when license is invalid", () => {
    jest.spyOn(licenseService, "isEnterpriseLicensed").mockReturnValue(false);

    expect(() => guard.canActivate(mockExecutionContext)).toThrow(
      ForbiddenException,
    );
    expect(() => guard.canActivate(mockExecutionContext)).toThrow(
      ERROR_MESSAGES.ENTERPRISE_LICENSE_REQUIRED,
    );
    expect(licenseService.isEnterpriseLicensed).toHaveBeenCalled();
  });
});
