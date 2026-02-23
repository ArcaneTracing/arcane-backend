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
import { getRepositoryToken } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { AdminController } from "../../../src/organisations/controller/admin.controller";
import { OrganisationsService } from "../../../src/organisations/services/organisations.service";
import { AuditService } from "../../../src/audit/audit.service";
import { CreateOrganisationRequestDto } from "../../../src/organisations/dto/request/create-organisation.dto";
import { OrganisationResponseDto } from "../../../src/organisations/dto/response/organisation.dto";
import { OrganisationMessageResponseDto } from "../../../src/organisations/dto/response/organisation-message-response.dto";
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

describe("AdminController", () => {
  let controller: AdminController;
  let organisationsService: OrganisationsService;
  let auditService: AuditService;
  let auditLogRepository: Repository<AuditLog>;

  const mockOrganisationsService = {
    findAllForAdmin: jest.fn(),
    create: jest.fn(),
    remove: jest.fn(),
  };

  const mockAuditService = {
    findLogsPaginated: jest.fn(),
  };

  const mockAuditLogRepository = {
    createQueryBuilder: jest.fn(),
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
      email: "admin@example.com",
      name: "Admin User",
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

  const mockOrganisationsResponse: OrganisationResponseDto[] = [
    mockOrganisationResponseDto,
    {
      id: "org-2",
      name: "Another Organisation",
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminController],
      providers: [
        {
          provide: OrganisationsService,
          useValue: mockOrganisationsService,
        },
        {
          provide: AuditService,
          useValue: mockAuditService,
        },
        {
          provide: getRepositoryToken(AuditLog),
          useValue: mockAuditLogRepository,
        },
      ],
    }).compile();

    controller = module.get<AdminController>(AdminController);
    organisationsService =
      module.get<OrganisationsService>(OrganisationsService);
    auditService = module.get<AuditService>(AuditService);
    auditLogRepository = module.get<Repository<AuditLog>>(
      getRepositoryToken(AuditLog),
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("findAll", () => {
    it("should return all organizations for instance admin", async () => {
      mockOrganisationsService.findAllForAdmin.mockResolvedValue(
        mockOrganisationsResponse,
      );

      const result = await controller.findAll();

      expect(result).toEqual(mockOrganisationsResponse);
      expect(organisationsService.findAllForAdmin).toHaveBeenCalledTimes(1);
    });

    it("should return empty array when no organizations exist", async () => {
      mockOrganisationsService.findAllForAdmin.mockResolvedValue([]);

      const result = await controller.findAll();

      expect(result).toEqual([]);
      expect(organisationsService.findAllForAdmin).toHaveBeenCalledTimes(1);
    });
  });

  describe("create", () => {
    it("should create a new organization", async () => {
      const createDto: CreateOrganisationRequestDto = {
        name: "New Organisation",
      };

      mockOrganisationsService.create.mockResolvedValue(
        mockOrganisationResponseDto,
      );

      const result = await controller.create(createDto, mockUserSession as any);

      expect(result).toEqual(mockOrganisationResponseDto);
      expect(organisationsService.create).toHaveBeenCalledWith(
        createDto,
        mockUserSession.user.id,
      );
    });
  });

  describe("remove", () => {
    it("should delete an organization", async () => {
      const organisationId = "org-1";
      const mockMessageResponse: OrganisationMessageResponseDto = {
        message: "Organisation removed successfully",
      };

      mockOrganisationsService.remove.mockResolvedValue(mockMessageResponse);

      const result = await controller.remove(
        organisationId,
        mockUserSession as any,
      );

      expect(result).toEqual(mockMessageResponse);
      expect(organisationsService.remove).toHaveBeenCalledWith(
        organisationId,
        mockUserSession.user.id,
      );
    });
  });

  describe("getAuditLogs", () => {
    const mockAuditLogs: AuditLog[] = [
      {
        id: "audit-1",
        action: "organisation.created",
        actorId: "user-1",
        actorType: "user",
        resourceType: "organisation",
        resourceId: "org-1",
        organisationId: "org-1",
        projectId: null,
        metadata: { creatorId: "user-1" },
        beforeState: null,
        afterState: { id: "org-1", name: "Test Org" },
        createdAt: new Date("2024-01-01"),
      },
    ];

    const mockPaginatedResponse: PaginatedAuditLogsResponseDto = {
      data: mockAuditLogs,
      nextCursor: "2024-01-01T00:00:00.000Z",
      hasMore: false,
      limit: 50,
    };

    it("should return paginated audit logs for organization actions", async () => {
      const mockQueryBuilder = {
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue(mockAuditLogs),
      };
      mockAuditLogRepository.createQueryBuilder.mockReturnValue(
        mockQueryBuilder,
      );

      const result = await controller.getAuditLogs();

      expect(result.data).toEqual(mockAuditLogs);
      expect(result.hasMore).toBe(false);
      expect(result.nextCursor).toBe("2024-01-01T00:00:00.000Z");
      expect(result.limit).toBe(50);
      expect(mockQueryBuilder.andWhere).toHaveBeenCalled();
      expect(mockQueryBuilder.orderBy).toHaveBeenCalledWith(
        "audit.created_at",
        "DESC",
      );
      expect(mockQueryBuilder.limit).toHaveBeenCalledWith(51);
    });

    it("should return paginated audit logs filtered by organisationId", async () => {
      const organisationId = "org-1";

      const mockQueryBuilder = {
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue(mockAuditLogs),
      };
      mockAuditLogRepository.createQueryBuilder.mockReturnValue(
        mockQueryBuilder,
      );

      const result = await controller.getAuditLogs(organisationId);

      expect(result.data).toEqual(mockAuditLogs);
      expect(result.hasMore).toBe(false);
      expect(mockQueryBuilder.andWhere).toHaveBeenCalled();
      expect(mockQueryBuilder.orderBy).toHaveBeenCalledWith(
        "audit.created_at",
        "DESC",
      );
      expect(mockQueryBuilder.limit).toHaveBeenCalledWith(51);
    });

    it("should return paginated audit logs with custom action filter", async () => {
      const action = "organisation.deleted";
      mockAuditService.findLogsPaginated.mockResolvedValue(
        mockPaginatedResponse,
      );

      const result = await controller.getAuditLogs(undefined, action);

      expect(result).toEqual(mockPaginatedResponse);
      expect(auditService.findLogsPaginated).toHaveBeenCalledWith({
        organisationId: undefined,
        action,
        cursor: undefined,
        limit: 50,
      });
    });

    it("should return paginated audit logs with pagination", async () => {
      const cursor = "2024-01-02T00:00:00.000Z";
      const limit = "20";

      const moreAuditLogs = Array(21)
        .fill(null)
        .map((_, i) => ({
          ...mockAuditLogs[0],
          id: `audit-${i + 1}`,
          createdAt: new Date(`2024-01-${String(i + 1).padStart(2, "0")}`),
        }));
      const mockQueryBuilder = {
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue(moreAuditLogs),
      };
      mockAuditLogRepository.createQueryBuilder.mockReturnValue(
        mockQueryBuilder,
      );

      const result = await controller.getAuditLogs(
        undefined,
        undefined,
        cursor,
        limit,
      );

      expect(result.data).toHaveLength(20);
      expect(result.hasMore).toBe(true);
      expect(result.limit).toBe(20);
      expect(mockQueryBuilder.andWhere).toHaveBeenCalled();
      expect(mockQueryBuilder.orderBy).toHaveBeenCalledWith(
        "audit.created_at",
        "DESC",
      );
      expect(mockQueryBuilder.limit).toHaveBeenCalledWith(21);
    });
  });
});
