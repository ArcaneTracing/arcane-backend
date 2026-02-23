jest.mock("@thallesp/nestjs-better-auth", () => ({
  Session:
    () => (target: any, propertyKey: string, parameterIndex: number) => {},
  UserSession: class UserSession {},
}));

jest.mock("../../../src/rbac/guards/instance-permission.guard", () => ({
  InstancePermissionGuard: jest.fn(() => ({
    canActivate: jest.fn(() => true),
  })),
}));

import { Test, TestingModule } from "@nestjs/testing";
import { InstanceOwnerController } from "../../../src/rbac/controllers/instance-owner.controller";
import { InstanceOwnerService } from "../../../src/rbac/services/instance-owner.service";
import { AuditService } from "../../../src/audit/audit.service";
import { BetterAuthUserService } from "../../../src/auth/services/better-auth-user.service";
import { InstanceOwnerMessageResponseDto } from "../../../src/rbac/dto/response/instance-owner-message-response.dto";
import { InstanceOwnersResponseDto } from "../../../src/rbac/dto/response/instance-owners-response.dto";
import { AuditLog } from "../../../src/audit/entities/audit-log.entity";
import { PaginatedAuditLogsResponseDto } from "../../../src/audit/dto/response/paginated-audit-logs-response.dto";

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

describe("InstanceOwnerController", () => {
  let controller: InstanceOwnerController;
  let instanceOwnerService: InstanceOwnerService;
  let auditService: AuditService;

  const mockInstanceOwnerService = {
    assignOwnerRole: jest.fn(),
    removeOwnerRole: jest.fn(),
    listOwnersWithDetails: jest.fn(),
  };

  const mockAuditService = {
    findLogsPaginated: jest.fn(),
  };

  const mockBetterAuthUserService = {
    searchUsersByEmail: jest.fn(),
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

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [InstanceOwnerController],
      providers: [
        {
          provide: InstanceOwnerService,
          useValue: mockInstanceOwnerService,
        },
        {
          provide: AuditService,
          useValue: mockAuditService,
        },
        {
          provide: BetterAuthUserService,
          useValue: mockBetterAuthUserService,
        },
      ],
    }).compile();

    controller = module.get<InstanceOwnerController>(InstanceOwnerController);
    instanceOwnerService =
      module.get<InstanceOwnerService>(InstanceOwnerService);
    auditService = module.get<AuditService>(AuditService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("assignOwnerRole", () => {
    it("should assign owner role to a user", async () => {
      mockInstanceOwnerService.assignOwnerRole.mockResolvedValue(undefined);

      const result = await controller.assignOwnerRole(
        "user-2",
        mockUserSession,
      );

      expect(result).toEqual({ message: "Owner role assigned successfully" });
      expect(instanceOwnerService.assignOwnerRole).toHaveBeenCalledWith(
        "user-2",
        mockUserSession.user.id,
      );
    });
  });

  describe("removeOwnerRole", () => {
    it("should remove owner role from a user", async () => {
      mockInstanceOwnerService.removeOwnerRole.mockResolvedValue(undefined);

      const result = await controller.removeOwnerRole(
        "user-2",
        mockUserSession,
      );

      expect(result).toEqual({ message: "Owner role removed successfully" });
      expect(instanceOwnerService.removeOwnerRole).toHaveBeenCalledWith(
        "user-2",
        mockUserSession.user.id,
      );
    });
  });

  describe("listOwners", () => {
    it("should return list of owners with full user details", async () => {
      const users = [
        { id: "user-1", email: "user1@example.com", name: "User One" },
        { id: "user-2", email: "user2@example.com", name: "User Two" },
      ];

      mockInstanceOwnerService.listOwnersWithDetails.mockResolvedValue(users);

      const result = await controller.listOwners();

      expect(result).toEqual({ users });
      expect(instanceOwnerService.listOwnersWithDetails).toHaveBeenCalled();
    });
  });

  describe("getAuditLogs", () => {
    const mockAuditLogs: AuditLog[] = [
      {
        id: "audit-1",
        action: "instance_owner.assigned",
        actorId: "user-1",
        actorType: "user",
        resourceType: "instance_owner",
        resourceId: "user-2",
        organisationId: null,
        projectId: null,
        metadata: { assignedById: "user-1" },
        beforeState: null,
        afterState: {
          assignedToUserId: "user-2",
          roleName: "Owner",
          roleId: "role-1",
        },
        createdAt: new Date("2024-01-01"),
      },
    ];

    const mockPaginatedResponse: PaginatedAuditLogsResponseDto = {
      data: mockAuditLogs,
      nextCursor: "2024-01-01T00:00:00.000Z",
      hasMore: false,
      limit: 50,
    };

    it("should return paginated audit logs for instance owner actions", async () => {
      mockAuditService.findLogsPaginated.mockResolvedValue(
        mockPaginatedResponse,
      );

      const result = await controller.getAuditLogs();

      expect(result).toEqual(mockPaginatedResponse);
      expect(result.data).toEqual(mockAuditLogs);
      expect(result.hasMore).toBe(false);
      expect(auditService.findLogsPaginated).toHaveBeenCalledWith({
        action: "instance_owner.*",
        cursor: undefined,
        limit: undefined,
      });
    });

    it("should return paginated audit logs with custom action filter", async () => {
      const action = "instance_owner.assigned";
      mockAuditService.findLogsPaginated.mockResolvedValue(
        mockPaginatedResponse,
      );

      const result = await controller.getAuditLogs(action);

      expect(result).toEqual(mockPaginatedResponse);
      expect(auditService.findLogsPaginated).toHaveBeenCalledWith({
        action,
        cursor: undefined,
        limit: undefined,
      });
    });

    it("should return paginated audit logs with pagination", async () => {
      const cursor = "2024-01-02T00:00:00.000Z";
      const limit = "20";
      const paginatedResponse: PaginatedAuditLogsResponseDto = {
        data: mockAuditLogs,
        nextCursor: "2024-01-01T00:00:00.000Z",
        hasMore: true,
        limit: 20,
      };
      mockAuditService.findLogsPaginated.mockResolvedValue(paginatedResponse);

      const result = await controller.getAuditLogs(undefined, cursor, limit);

      expect(result).toEqual(paginatedResponse);
      expect(result.hasMore).toBe(true);
      expect(auditService.findLogsPaginated).toHaveBeenCalledWith({
        action: "instance_owner.*",
        cursor,
        limit: 20,
      });
    });
  });

  describe("searchUsers", () => {
    const mockUsers = [
      { id: "user-1", email: "john@example.com", name: "John Doe" },
      { id: "user-2", email: "jane@example.com", name: "Jane Smith" },
    ];

    it("should search users by email", async () => {
      mockBetterAuthUserService.searchUsersByEmail.mockResolvedValue(mockUsers);

      const result = await controller.searchUsers("john");

      expect(result).toEqual(mockUsers);
      expect(mockBetterAuthUserService.searchUsersByEmail).toHaveBeenCalledWith(
        "john",
        50,
      );
    });

    it("should search users with custom limit", async () => {
      mockBetterAuthUserService.searchUsersByEmail.mockResolvedValue([
        mockUsers[0],
      ]);

      const result = await controller.searchUsers("john", "10");

      expect(result).toEqual([mockUsers[0]]);
      expect(mockBetterAuthUserService.searchUsersByEmail).toHaveBeenCalledWith(
        "john",
        10,
      );
    });

    it("should return empty array when no users found", async () => {
      mockBetterAuthUserService.searchUsersByEmail.mockResolvedValue([]);

      const result = await controller.searchUsers("nonexistent");

      expect(result).toEqual([]);
      expect(mockBetterAuthUserService.searchUsersByEmail).toHaveBeenCalledWith(
        "nonexistent",
        50,
      );
    });
  });
});
