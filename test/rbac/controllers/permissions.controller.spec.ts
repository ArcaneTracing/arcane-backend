jest.mock("@thallesp/nestjs-better-auth", () => ({
  Session:
    () => (target: any, propertyKey: string, parameterIndex: number) => {},
  UserSession: class UserSession {},
}));

import { Test, TestingModule } from "@nestjs/testing";
import { PermissionsController } from "../../../src/rbac/controllers/permissions.controller";
import { RbacPermissionService } from "../../../src/rbac/services/rbac-permission.service";
import { PermissionsResponseDto } from "../../../src/rbac/dto/response/permissions-response.dto";

type UserSession = {
  session: {
    id: string;
    createdAt: Date;
    updatedAt: Date;
    userId: string;
    expiresAt: Date;
    token: string;
  };
  user: {
    id: string;
    email?: string;
    name: string;
    emailVerified: boolean;
    createdAt: Date;
    updatedAt: Date;
  };
};

describe("PermissionsController", () => {
  let controller: PermissionsController;
  let permissionService: RbacPermissionService;

  const mockPermissionService = {
    getUserPermissionsWithContext: jest.fn(),
  };

  const mockUserSession: UserSession = {
    session: {
      id: "session-1",
      createdAt: new Date(),
      updatedAt: new Date(),
      userId: "user-1",
      expiresAt: new Date(),
      token: "token-1",
    },
    user: {
      id: "user-1",
      email: "test@example.com",
      name: "Test User",
      emailVerified: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  };

  const mockPermissionsResponseDto: PermissionsResponseDto = {
    instance: ["*"],
    organisation: ["projects:read", "projects:write"],
    project: [],
    all: ["*", "projects:read", "projects:write"],
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PermissionsController],
      providers: [
        {
          provide: RbacPermissionService,
          useValue: mockPermissionService,
        },
      ],
    }).compile();

    controller = module.get<PermissionsController>(PermissionsController);
    permissionService = module.get<RbacPermissionService>(
      RbacPermissionService,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("getPermissions", () => {
    it("should return user permissions without context", async () => {
      const permissionsDto: PermissionsResponseDto = {
        instance: ["projects:read"],
        organisation: [],
        project: [],
        all: ["projects:read"],
      };
      mockPermissionService.getUserPermissionsWithContext.mockResolvedValue(
        permissionsDto,
      );

      const result = await controller.getPermissions(mockUserSession);

      expect(result).toEqual(permissionsDto);
      expect(
        permissionService.getUserPermissionsWithContext,
      ).toHaveBeenCalledWith(mockUserSession.user.id, undefined, undefined);
    });

    it("should return user permissions with organisation context", async () => {
      const permissionsDto: PermissionsResponseDto = {
        instance: [],
        organisation: ["projects:read", "organisations:read"],
        project: [],
        all: ["projects:read", "organisations:read"],
      };
      mockPermissionService.getUserPermissionsWithContext.mockResolvedValue(
        permissionsDto,
      );

      const result = await controller.getPermissions(mockUserSession, "org-1");

      expect(result).toEqual(permissionsDto);
      expect(
        permissionService.getUserPermissionsWithContext,
      ).toHaveBeenCalledWith(mockUserSession.user.id, "org-1", undefined);
    });

    it("should return user permissions with organisation and project context", async () => {
      mockPermissionService.getUserPermissionsWithContext.mockResolvedValue(
        mockPermissionsResponseDto,
      );

      const result = await controller.getPermissions(
        mockUserSession,
        "org-1",
        "project-1",
      );

      expect(result).toEqual(mockPermissionsResponseDto);
      expect(
        permissionService.getUserPermissionsWithContext,
      ).toHaveBeenCalledWith(mockUserSession.user.id, "org-1", "project-1");
    });
  });
});
