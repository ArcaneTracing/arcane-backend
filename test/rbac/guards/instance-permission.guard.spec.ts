import { Test, TestingModule } from "@nestjs/testing";
import { ExecutionContext, ForbiddenException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { InstancePermissionGuard } from "../../../src/rbac/guards/instance-permission.guard";
import { RbacPermissionService } from "../../../src/rbac/services/rbac-permission.service";
import { PERMISSION_KEY } from "../../../src/rbac/decorators/permission.decorator";
import {
  ERROR_MESSAGES,
  formatError,
} from "../../../src/common/constants/error-messages.constants";

describe("InstancePermissionGuard", () => {
  let guard: InstancePermissionGuard;
  let reflector: Reflector;
  let permissionService: RbacPermissionService;

  const mockReflector = {
    get: jest.fn(),
  };

  const mockPermissionService = {
    checkPermission: jest.fn(),
  };

  const createMockContext = (
    session: any,
    handler?: any,
    controller?: any,
  ): ExecutionContext => {
    const request = {
      session,
    };
    return {
      switchToHttp: () => ({
        getRequest: () => request,
      }),
      getHandler: () => handler || (() => {}),
      getClass: () => controller || class TestController {},
    } as ExecutionContext;
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InstancePermissionGuard,
        {
          provide: Reflector,
          useValue: mockReflector,
        },
        {
          provide: RbacPermissionService,
          useValue: mockPermissionService,
        },
      ],
    }).compile();

    guard = module.get<InstancePermissionGuard>(InstancePermissionGuard);
    reflector = module.get<Reflector>(Reflector);
    permissionService = module.get<RbacPermissionService>(
      RbacPermissionService,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("canActivate", () => {
    it("should allow access when no permission required", async () => {
      const session = { user: { id: "user-1" } };
      const context = createMockContext(session);
      mockReflector.get.mockReturnValue(undefined);

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(mockPermissionService.checkPermission).not.toHaveBeenCalled();
    });

    it("should check permission when handler has permission decorator", async () => {
      const session = { user: { id: "user-1" } };
      const handler = () => {};
      const context = createMockContext(session, handler);
      mockReflector.get.mockReturnValueOnce("*").mockReturnValueOnce(undefined);
      mockPermissionService.checkPermission.mockResolvedValue(undefined);

      const result = await guard.canActivate(context);

      expect(mockReflector.get).toHaveBeenCalledWith(PERMISSION_KEY, handler);
      expect(mockPermissionService.checkPermission).toHaveBeenCalledWith(
        "user-1",
        "*",
      );
      expect(result).toBe(true);
    });

    it("should check permission when controller has permission decorator", async () => {
      const session = { user: { id: "user-1" } };
      const controller = class TestController {};
      const context = createMockContext(session, undefined, controller);
      mockReflector.get.mockReturnValueOnce(undefined).mockReturnValueOnce("*");
      mockPermissionService.checkPermission.mockResolvedValue(undefined);

      const result = await guard.canActivate(context);

      expect(mockReflector.get).toHaveBeenCalledWith(
        PERMISSION_KEY,
        controller,
      );
      expect(mockPermissionService.checkPermission).toHaveBeenCalledWith(
        "user-1",
        "*",
      );
      expect(result).toBe(true);
    });

    it("should prioritize handler permission over controller permission", async () => {
      const session = { user: { id: "user-1" } };
      const handler = () => {};
      const controller = class TestController {};
      const context = createMockContext(session, handler, controller);
      mockReflector.get
        .mockReturnValueOnce("projects:read")
        .mockReturnValueOnce("*");
      mockPermissionService.checkPermission.mockResolvedValue(undefined);

      const result = await guard.canActivate(context);

      expect(mockPermissionService.checkPermission).toHaveBeenCalledWith(
        "user-1",
        "projects:read",
      );
      expect(result).toBe(true);
    });

    it("should throw ForbiddenException when session is missing", async () => {
      const context = createMockContext(null);
      mockReflector.get.mockReturnValue(undefined);

      await expect(guard.canActivate(context)).rejects.toThrow(
        ForbiddenException,
      );
      await expect(guard.canActivate(context)).rejects.toThrow(
        formatError(ERROR_MESSAGES.USER_NOT_AUTHENTICATED),
      );
      expect(mockPermissionService.checkPermission).not.toHaveBeenCalled();
    });

    it("should throw ForbiddenException when user is missing", async () => {
      const session = {};
      const context = createMockContext(session);
      mockReflector.get.mockReturnValue(undefined);

      await expect(guard.canActivate(context)).rejects.toThrow(
        ForbiddenException,
      );
      await expect(guard.canActivate(context)).rejects.toThrow(
        formatError(ERROR_MESSAGES.USER_NOT_AUTHENTICATED),
      );
    });

    it("should propagate permission check errors", async () => {
      const session = { user: { id: "user-1" } };
      const handler = () => {};
      const context = createMockContext(session, handler);
      mockReflector.get
        .mockReturnValueOnce("projects:read")
        .mockReturnValueOnce(undefined);
      const permissionError = new ForbiddenException("No permission");
      mockPermissionService.checkPermission.mockRejectedValue(permissionError);

      await expect(guard.canActivate(context)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });
});
