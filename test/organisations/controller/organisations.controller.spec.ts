jest.mock("@thallesp/nestjs-better-auth", () => ({
  Session:
    () => (target: any, propertyKey: string, parameterIndex: number) => {},
  UserSession: class UserSession {},
}));

import { Test, TestingModule } from "@nestjs/testing";
import { OrganisationsController } from "../../../src/organisations/controller/organisations.controller";
import { OrgPermissionGuard } from "../../../src/rbac/guards/org-permission.guard";
import { EnterpriseLicenseGuard } from "../../../src/license/guards/enterprise-license.guard";
import { OrganisationsService } from "../../../src/organisations/services/organisations.service";
import { OrganisationRbacService } from "../../../src/organisations/services/organisation-rbac.service";
import { CreateOrganisationRequestDto } from "../../../src/organisations/dto/request/create-organisation.dto";
import { UpdateOrganisationRequestDto } from "../../../src/organisations/dto/request/update-organisation.dto";
import { AddUserToOrganisationRequestDto } from "../../../src/organisations/dto/request/add-user-to-organisation.dto";
import { RemoveUserFromOrganisationRequestDto } from "../../../src/organisations/dto/request/remove-user-from-organisation.dto";
import { OrganisationResponseDto } from "../../../src/organisations/dto/response/organisation.dto";
import { OrganisationMessageResponseDto } from "../../../src/organisations/dto/response/organisation-message-response.dto";
import { OrganisationUserWithRoleResponseDto } from "../../../src/organisations/dto/response/organisation-user-with-role.dto";
import { AssignRoleRequestDto } from "../../../src/rbac/dto/request/assign-role-request.dto";
import { RoleResponseDto } from "../../../src/rbac/dto/response/role-response.dto";
import { AuditService } from "../../../src/audit/audit.service";
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

describe("OrganisationsController", () => {
  let controller: OrganisationsController;
  let organisationsService: OrganisationsService;
  let organisationRbacService: OrganisationRbacService;

  const mockOrganisationsService = {
    create: jest.fn(),
    findAll: jest.fn(),
    findById: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
    addUser: jest.fn(),
    removeUser: jest.fn(),
    getUsersWithRoles: jest.fn(),
  };

  const mockOrganisationRbacService = {
    assignRole: jest.fn(),
    getUserRole: jest.fn(),
  };

  const mockAuditService = {
    findLogsPaginated: jest.fn(),
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

  const mockOrganisationResponseDto: OrganisationResponseDto = {
    id: "org-1",
    name: "Test Organisation",
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockRoleResponseDto: RoleResponseDto = {
    id: "role-1",
    name: "Organisation Admin",
    description: "Admin role",
    permissions: ["*"],
    isSystemRole: true,
    isInstanceLevel: false,
    organisationId: "org-1",
    projectId: null,
    canDelete: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [OrganisationsController],
      providers: [
        {
          provide: OrganisationsService,
          useValue: mockOrganisationsService,
        },
        {
          provide: OrganisationRbacService,
          useValue: mockOrganisationRbacService,
        },
        {
          provide: AuditService,
          useValue: mockAuditService,
        },
      ],
    })
      .overrideGuard(OrgPermissionGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(EnterpriseLicenseGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<OrganisationsController>(OrganisationsController);
    organisationsService =
      module.get<OrganisationsService>(OrganisationsService);
    organisationRbacService = module.get<OrganisationRbacService>(
      OrganisationRbacService,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("create", () => {
    it("should create an organisation", async () => {
      const createDto: CreateOrganisationRequestDto = {
        name: "New Organisation",
      };
      mockOrganisationsService.create.mockResolvedValue(
        mockOrganisationResponseDto,
      );

      const result = await controller.create(createDto, mockUserSession);

      expect(result).toEqual(mockOrganisationResponseDto);
      expect(organisationsService.create).toHaveBeenCalledWith(
        createDto,
        mockUserSession.user.id,
      );
    });
  });

  describe("findAll", () => {
    it("should return all organisations for a user", async () => {
      mockOrganisationsService.findAll.mockResolvedValue([
        mockOrganisationResponseDto,
      ]);

      const result = await controller.findAll(mockUserSession);

      expect(result).toEqual([mockOrganisationResponseDto]);
      expect(organisationsService.findAll).toHaveBeenCalledWith(
        mockUserSession.user.id,
      );
    });
  });

  describe("findOne", () => {
    it("should return an organisation by id", async () => {
      mockOrganisationsService.findById.mockResolvedValue(
        mockOrganisationResponseDto,
      );

      const result = await controller.findOne("org-1");

      expect(result).toEqual(mockOrganisationResponseDto);
      expect(organisationsService.findById).toHaveBeenCalledWith("org-1");
    });
  });

  describe("update", () => {
    it("should update an organisation", async () => {
      const updateDto: UpdateOrganisationRequestDto = {
        name: "Updated Organisation",
      };
      const updatedOrganisation = {
        ...mockOrganisationResponseDto,
        name: "Updated Organisation",
      };
      mockOrganisationsService.update.mockResolvedValue(updatedOrganisation);

      const result = await controller.update("org-1", updateDto);

      expect(result).toEqual(updatedOrganisation);
      expect(organisationsService.update).toHaveBeenCalledWith(
        "org-1",
        updateDto,
      );
    });
  });

  describe("remove", () => {
    it("should remove an organisation", async () => {
      const messageResponse: OrganisationMessageResponseDto = {
        message: "Organisation removed successfully",
      };
      mockOrganisationsService.remove.mockResolvedValue(messageResponse);

      const result = await controller.remove("org-1");

      expect(result).toEqual(messageResponse);
      expect(organisationsService.remove).toHaveBeenCalledWith("org-1");
    });
  });

  describe("getUsers", () => {
    it("should return all users in the organization with their roles", async () => {
      const mockUsersWithRoles: OrganisationUserWithRoleResponseDto[] = [
        {
          id: "user-1",
          email: "user1@example.com",
          name: "User One",
          role: mockRoleResponseDto,
        },
        {
          id: "user-2",
          email: "user2@example.com",
          name: "User Two",
          role: null,
        },
      ];

      mockOrganisationsService.getUsersWithRoles.mockResolvedValue(
        mockUsersWithRoles,
      );

      const result = await controller.getUsers("org-1");

      expect(result).toEqual(mockUsersWithRoles);
      expect(organisationsService.getUsersWithRoles).toHaveBeenCalledWith(
        "org-1",
      );
    });

    it("should return empty array when no users in organization", async () => {
      mockOrganisationsService.getUsersWithRoles.mockResolvedValue([]);

      const result = await controller.getUsers("org-1");

      expect(result).toEqual([]);
      expect(organisationsService.getUsersWithRoles).toHaveBeenCalledWith(
        "org-1",
      );
    });
  });

  describe("addUser", () => {
    it("should add a user to an organisation", async () => {
      const addUserDto: AddUserToOrganisationRequestDto = {
        email: "newuser@example.com",
      };
      const messageResponse: OrganisationMessageResponseDto = {
        message: "User added to organisation successfully",
      };
      mockOrganisationsService.addUser.mockResolvedValue(messageResponse);

      const result = await controller.addUser(
        "org-1",
        addUserDto,
        mockUserSession,
      );

      expect(result).toEqual(messageResponse);
      expect(organisationsService.addUser).toHaveBeenCalledWith(
        "org-1",
        addUserDto.email,
        mockUserSession.user.id,
        addUserDto.roleId,
      );
    });
  });

  describe("removeUser", () => {
    it("should remove a user from an organisation", async () => {
      const removeUserDto: RemoveUserFromOrganisationRequestDto = {
        email: "user@example.com",
      };
      const messageResponse: OrganisationMessageResponseDto = {
        message: "User removed from organisation successfully",
      };
      mockOrganisationsService.removeUser.mockResolvedValue(messageResponse);

      const result = await controller.removeUser("org-1", removeUserDto);

      expect(result).toEqual(messageResponse);
      expect(organisationsService.removeUser).toHaveBeenCalledWith(
        "org-1",
        removeUserDto.email,
      );
    });
  });

  describe("assignRole", () => {
    it("should assign a role to a user", async () => {
      const assignRoleDto: AssignRoleRequestDto = {
        roleId: "role-1",
      };
      mockOrganisationRbacService.assignRole.mockResolvedValue(undefined);

      const result = await controller.assignRole(
        "org-1",
        "user-2",
        assignRoleDto,
      );

      expect(result).toEqual({ message: "Role assigned successfully" });
      expect(organisationRbacService.assignRole).toHaveBeenCalledWith(
        "org-1",
        "user-2",
        assignRoleDto.roleId,
      );
    });
  });

  describe("getUserRole", () => {
    it("should return user role", async () => {
      mockOrganisationRbacService.getUserRole.mockResolvedValue(
        mockRoleResponseDto,
      );

      const result = await controller.getUserRole("org-1", "user-2");

      expect(result).toEqual(mockRoleResponseDto);
      expect(organisationRbacService.getUserRole).toHaveBeenCalledWith(
        "org-1",
        "user-2",
      );
    });

    it("should return null when user has no role", async () => {
      mockOrganisationRbacService.getUserRole.mockResolvedValue(null);

      const result = await controller.getUserRole("org-1", "user-2");

      expect(result).toBeNull();
    });
  });

  describe("getAuditLogs", () => {
    const mockAuditLogs = [
      {
        id: "audit-1",
        action: "organisation.user.added",
        actorId: "user-1",
        actorType: "user",
        resourceType: "organisation_membership",
        resourceId: "user-2",
        organisationId: "org-1",
        projectId: null,
        metadata: { organisationId: "org-1", userId: "user-2" },
        beforeState: { isMember: false },
        afterState: { isMember: true },
        createdAt: new Date("2024-01-01"),
      },
    ];

    const mockPaginatedResponse: PaginatedAuditLogsResponseDto = {
      data: mockAuditLogs,
      nextCursor: "2024-01-01T00:00:00.000Z",
      hasMore: false,
      limit: 50,
    };

    it("should return paginated audit logs for the organization", async () => {
      mockAuditService.findLogsPaginated.mockResolvedValue(
        mockPaginatedResponse,
      );

      const result = await controller.getAuditLogs("org-1");

      expect(result).toEqual(mockPaginatedResponse);
      expect(result.data).toEqual(mockAuditLogs);
      expect(mockAuditService.findLogsPaginated).toHaveBeenCalledWith({
        organisationId: "org-1",
        action: undefined,
        cursor: undefined,
        limit: undefined,
      });
    });

    it("should return paginated audit logs with action filter", async () => {
      const action = "organisation.user.added";
      mockAuditService.findLogsPaginated.mockResolvedValue(
        mockPaginatedResponse,
      );

      const result = await controller.getAuditLogs("org-1", action);

      expect(result).toEqual(mockPaginatedResponse);
      expect(mockAuditService.findLogsPaginated).toHaveBeenCalledWith({
        organisationId: "org-1",
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

      const result = await controller.getAuditLogs(
        "org-1",
        undefined,
        cursor,
        limit,
      );

      expect(result).toEqual(paginatedResponse);
      expect(result.hasMore).toBe(true);
      expect(mockAuditService.findLogsPaginated).toHaveBeenCalledWith({
        organisationId: "org-1",
        action: undefined,
        cursor,
        limit: 20,
      });
    });
  });
});
