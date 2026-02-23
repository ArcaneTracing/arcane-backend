import { Test, TestingModule } from "@nestjs/testing";
import { ExecutionContext, ForbiddenException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { OrgPermissionGuard } from "../../../src/rbac/guards/org-permission.guard";
import { RbacPermissionService } from "../../../src/rbac/services/rbac-permission.service";
import { RbacMembershipService } from "../../../src/rbac/services/rbac-membership.service";
import { PERMISSION_KEY } from "../../../src/rbac/decorators/permission.decorator";
import {
  ERROR_MESSAGES,
  formatError,
} from "../../../src/common/constants/error-messages.constants";

describe("OrgPermissionGuard", () => {
  let guard: OrgPermissionGuard;
  let reflector: Reflector;
  let permissionService: RbacPermissionService;
  let membershipService: RbacMembershipService;

  const mockReflector = {
    get: jest.fn(),
  };

  const mockPermissionService = {
    checkPermission: jest.fn(),
  };

  const mockMembershipService = {
    isMember: jest.fn(),
  };

  const createMockContext = (
    session: any,
    params: any = {},
    handler?: any,
    controller?: any,
  ): ExecutionContext => {
    const request = {
      session,
      params,
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
        OrgPermissionGuard,
        {
          provide: Reflector,
          useValue: mockReflector,
        },
        {
          provide: RbacPermissionService,
          useValue: mockPermissionService,
        },
        {
          provide: RbacMembershipService,
          useValue: mockMembershipService,
        },
      ],
    }).compile();

    guard = module.get<OrgPermissionGuard>(OrgPermissionGuard);
    reflector = module.get<Reflector>(Reflector);
    permissionService = module.get<RbacPermissionService>(
      RbacPermissionService,
    );
    membershipService = module.get<RbacMembershipService>(
      RbacMembershipService,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("canActivate", () => {
    it("should allow access when user is member and no permission required", async () => {
      const session = { user: { id: "user-1" } };
      const params = { organisationId: "org-1" };
      const context = createMockContext(session, params);
      mockReflector.get.mockReturnValue(undefined);
      mockMembershipService.isMember.mockResolvedValue(true);

      const result = await guard.canActivate(context);

      expect(mockMembershipService.isMember).toHaveBeenCalledWith(
        "org-1",
        "user-1",
      );
      expect(mockPermissionService.checkPermission).not.toHaveBeenCalled();
      expect(result).toBe(true);
    });

    it("should check permission when user is member and permission required", async () => {
      const session = { user: { id: "user-1" } };
      const params = { organisationId: "org-1" };
      const handler = () => {};
      const context = createMockContext(session, params, handler);
      mockReflector.get
        .mockReturnValueOnce("organisations:read")
        .mockReturnValueOnce(undefined);
      mockMembershipService.isMember.mockResolvedValue(true);
      mockPermissionService.checkPermission.mockResolvedValue(undefined);

      const result = await guard.canActivate(context);

      expect(mockMembershipService.isMember).toHaveBeenCalledWith(
        "org-1",
        "user-1",
      );
      expect(mockPermissionService.checkPermission).toHaveBeenCalledWith(
        "user-1",
        "organisations:read",
        "org-1",
      );
      expect(result).toBe(true);
    });

    it("should throw ForbiddenException when session is missing", async () => {
      const params = { organisationId: "org-1" };
      const context = createMockContext(null, params);

      const promise = guard.canActivate(context);
      await expect(promise).rejects.toThrow(ForbiddenException);
      await expect(promise).rejects.toThrow(
        formatError(ERROR_MESSAGES.USER_NOT_AUTHENTICATED),
      );
      expect(mockMembershipService.isMember).not.toHaveBeenCalled();
    });

    it("should throw ForbiddenException when organisationId is missing", async () => {
      const session = { user: { id: "user-1" } };
      const params = {};
      const handler = () => {};
      const context = createMockContext(session, params, handler);
      mockReflector.get
        .mockReturnValueOnce("organisations:read")
        .mockReturnValueOnce(undefined);

      const promise = guard.canActivate(context);
      await expect(promise).rejects.toThrow(ForbiddenException);
      await expect(promise).rejects.toThrow(
        formatError(ERROR_MESSAGES.ORGANISATION_CONTEXT_REQUIRED),
      );
      expect(mockMembershipService.isMember).not.toHaveBeenCalled();
    });

    it("should throw ForbiddenException when user is not organisation member", async () => {
      const session = { user: { id: "user-1" } };
      const params = { organisationId: "org-1" };
      const context = createMockContext(session, params);
      mockReflector.get.mockReturnValue(undefined);
      mockMembershipService.isMember.mockResolvedValue(false);

      await expect(guard.canActivate(context)).rejects.toThrow(
        ForbiddenException,
      );
      await expect(guard.canActivate(context)).rejects.toThrow(
        formatError(ERROR_MESSAGES.USER_NOT_IN_ORGANISATION),
      );
      expect(mockMembershipService.isMember).toHaveBeenCalledWith(
        "org-1",
        "user-1",
      );
      expect(mockPermissionService.checkPermission).not.toHaveBeenCalled();
    });

    it("should propagate permission check errors", async () => {
      const session = { user: { id: "user-1" } };
      const params = { organisationId: "org-1" };
      const handler = () => {};
      const context = createMockContext(session, params, handler);
      mockReflector.get
        .mockReturnValueOnce("organisations:read")
        .mockReturnValueOnce(undefined);
      mockMembershipService.isMember.mockResolvedValue(true);
      const permissionError = new ForbiddenException("No permission");
      mockPermissionService.checkPermission.mockRejectedValue(permissionError);

      await expect(guard.canActivate(context)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });
});
