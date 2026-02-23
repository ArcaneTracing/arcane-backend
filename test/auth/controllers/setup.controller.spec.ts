jest.mock("@thallesp/nestjs-better-auth", () => ({
  AllowAnonymous:
    () => (target: any, propertyKey?: string, descriptor?: any) => {},
}));

import { Test, TestingModule } from "@nestjs/testing";
import { SetupController } from "../../../src/auth/controllers/setup.controller";
import { BetterAuthUserService } from "src/auth/services/better-auth-user.service";

describe("SetupController", () => {
  let controller: SetupController;
  let userService: BetterAuthUserService;

  const mockUserService = {
    hasAnyUsers: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SetupController],
      providers: [
        {
          provide: BetterAuthUserService,
          useValue: mockUserService,
        },
      ],
    }).compile();

    controller = module.get<SetupController>(SetupController);
    userService = module.get<BetterAuthUserService>(BetterAuthUserService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("getSetupStatus", () => {
    it("should return shouldSetup true when there are no users", async () => {
      mockUserService.hasAnyUsers.mockResolvedValue(false);

      const result = await controller.getSetupStatus();

      expect(result).toEqual({ shouldSetup: true });
      expect(userService.hasAnyUsers).toHaveBeenCalled();
    });

    it("should return shouldSetup false when there are users", async () => {
      mockUserService.hasAnyUsers.mockResolvedValue(true);

      const result = await controller.getSetupStatus();

      expect(result).toEqual({ shouldSetup: false });
      expect(userService.hasAnyUsers).toHaveBeenCalled();
    });
  });
});
