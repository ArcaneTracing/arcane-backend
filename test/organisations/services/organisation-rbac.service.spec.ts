import { Test, TestingModule } from "@nestjs/testing";
import { OrganisationRbacService } from "../../../src/organisations/services/organisation-rbac.service";
import { RbacService } from "../../../src/rbac/services/rbac.service";
import { RbacAssignmentService } from "../../../src/rbac/services/rbac-assignment.service";
import { RbacSeedService } from "../../../src/rbac/services/rbac-seed.service";
import { RoleResponseDto } from "../../../src/rbac/dto/response/role-response.dto";
import { Role } from "../../../src/rbac/entities/role.entity";
import { AuditService } from "../../../src/audit/audit.service";

describe("OrganisationRbacService", () => {
  let service: OrganisationRbacService;
  let rbacService: RbacService;
  let assignmentService: RbacAssignmentService;
  let seedService: RbacSeedService;

  const mockRbacService = {
    getDefaultOrganisationRole: jest.fn(),
    getUserOrganisationRole: jest.fn(),
  };

  const mockAssignmentService = {
    assignRole: jest.fn(),
    removeRole: jest.fn(),
  };

  const mockSeedService = {
    seedOrganisationRoles: jest.fn(),
  };

  const mockAuditService = {
    record: jest.fn().mockResolvedValue(undefined),
  };

  const mockRole: Role = {
    id: "role-1",
    name: "Organisation Admin",
    description: "Admin role",
    permissions: ["*"],
    isSystemRole: true,
    isInstanceLevel: false,
    organisationId: "org-1",
    projectId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    get scope() {
      return "organisation" as any;
    },
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
      providers: [
        OrganisationRbacService,
        {
          provide: RbacService,
          useValue: mockRbacService,
        },
        {
          provide: RbacAssignmentService,
          useValue: mockAssignmentService,
        },
        {
          provide: RbacSeedService,
          useValue: mockSeedService,
        },
        {
          provide: AuditService,
          useValue: mockAuditService,
        },
      ],
    }).compile();

    service = module.get<OrganisationRbacService>(OrganisationRbacService);
    rbacService = module.get<RbacService>(RbacService);
    assignmentService = module.get<RbacAssignmentService>(
      RbacAssignmentService,
    );
    seedService = module.get<RbacSeedService>(RbacSeedService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("seedOrganisationRoles", () => {
    it("should delegate to seedService", async () => {
      mockSeedService.seedOrganisationRoles.mockResolvedValue(mockRole);

      const result = await service.seedOrganisationRoles("org-1");

      expect(mockSeedService.seedOrganisationRoles).toHaveBeenCalledWith(
        "org-1",
        undefined,
      );
      expect(result).toEqual(mockRole);
    });
  });

  describe("getDefaultOrganisationRole", () => {
    it("should delegate to rbacService", async () => {
      mockRbacService.getDefaultOrganisationRole.mockResolvedValue(mockRole);

      const result = await service.getDefaultOrganisationRole("org-1");

      expect(mockRbacService.getDefaultOrganisationRole).toHaveBeenCalledWith(
        "org-1",
      );
      expect(result).toEqual(mockRole);
    });
  });

  describe("getUserOrganisationRole", () => {
    it("should delegate to rbacService", async () => {
      mockRbacService.getUserOrganisationRole.mockResolvedValue(mockRole);

      const result = await service.getUserOrganisationRole("org-1", "user-1");

      expect(mockRbacService.getUserOrganisationRole).toHaveBeenCalledWith(
        "org-1",
        "user-1",
      );
      expect(result).toEqual(mockRole);
    });
  });

  describe("removeRole", () => {
    it("should delegate to assignmentService", async () => {
      mockAssignmentService.removeRole.mockResolvedValue(undefined);

      await service.removeRole("user-1", "role-1");

      expect(mockAssignmentService.removeRole).toHaveBeenCalledWith(
        "user-1",
        "role-1",
      );
    });
  });

  describe("assignRole", () => {
    it("should assign role when user has no existing role", async () => {
      const newRole = { ...mockRole, id: "role-1" };
      mockRbacService.getUserOrganisationRole
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(newRole);
      mockAssignmentService.assignRole.mockResolvedValue(undefined);

      await service.assignRole("org-1", "user-1", "role-1");

      expect(mockRbacService.getUserOrganisationRole).toHaveBeenCalledWith(
        "org-1",
        "user-1",
      );
      expect(mockAssignmentService.removeRole).not.toHaveBeenCalled();
      expect(mockAssignmentService.assignRole).toHaveBeenCalledWith(
        "user-1",
        "role-1",
        undefined,
      );
      expect(mockAuditService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "organisation.user.role.assigned",
          actorType: "user",
          resourceType: "organisation_role_assignment",
          resourceId: "user-1",
          organisationId: "org-1",
          beforeState: {
            roleId: null,
            roleName: null,
          },
          afterState: {
            roleId: "role-1",
            roleName: newRole.name,
          },
          metadata: expect.objectContaining({
            organisationId: "org-1",
            userId: "user-1",
            previousRoleId: null,
            newRoleId: "role-1",
          }),
        }),
      );
    });

    it("should assign role when user has same role", async () => {
      mockRbacService.getUserOrganisationRole
        .mockResolvedValueOnce(mockRole)
        .mockResolvedValueOnce(mockRole);
      mockAssignmentService.assignRole.mockResolvedValue(undefined);

      await service.assignRole("org-1", "user-1", "role-1");

      expect(mockRbacService.getUserOrganisationRole).toHaveBeenCalledWith(
        "org-1",
        "user-1",
      );
      expect(mockAssignmentService.removeRole).not.toHaveBeenCalled();
      expect(mockAssignmentService.assignRole).toHaveBeenCalledWith(
        "user-1",
        "role-1",
        undefined,
      );
      expect(mockAuditService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "organisation.user.role.assigned",
          actorType: "user",
          resourceType: "organisation_role_assignment",
          resourceId: "user-1",
          organisationId: "org-1",
          beforeState: {
            roleId: "role-1",
            roleName: mockRole.name,
          },
          afterState: {
            roleId: "role-1",
            roleName: mockRole.name,
          },
          metadata: expect.objectContaining({
            organisationId: "org-1",
            userId: "user-1",
            previousRoleId: "role-1",
            newRoleId: "role-1",
          }),
        }),
      );
    });

    it("should remove existing role and assign new role when user has different role", async () => {
      const existingRole = { ...mockRole, id: "role-2", name: "Old Role" };
      const newRole = { ...mockRole, id: "role-1", name: "New Role" };
      mockRbacService.getUserOrganisationRole
        .mockResolvedValueOnce(existingRole)
        .mockResolvedValueOnce(newRole);
      mockAssignmentService.removeRole.mockResolvedValue(undefined);
      mockAssignmentService.assignRole.mockResolvedValue(undefined);

      await service.assignRole("org-1", "user-1", "role-1");

      expect(mockRbacService.getUserOrganisationRole).toHaveBeenCalledWith(
        "org-1",
        "user-1",
      );
      expect(mockAssignmentService.removeRole).toHaveBeenCalledWith(
        "user-1",
        "role-2",
        undefined,
      );
      expect(mockAssignmentService.assignRole).toHaveBeenCalledWith(
        "user-1",
        "role-1",
        undefined,
      );
      expect(mockAuditService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "organisation.user.role.assigned",
          actorType: "user",
          resourceType: "organisation_role_assignment",
          resourceId: "user-1",
          organisationId: "org-1",
          beforeState: {
            roleId: "role-2",
            roleName: "Old Role",
          },
          afterState: {
            roleId: "role-1",
            roleName: "New Role",
          },
          metadata: expect.objectContaining({
            organisationId: "org-1",
            userId: "user-1",
            previousRoleId: "role-2",
            newRoleId: "role-1",
          }),
        }),
      );
    });
  });

  describe("getUserRole", () => {
    it("should return role DTO when user has role", async () => {
      mockRbacService.getUserOrganisationRole.mockResolvedValue(mockRole);

      const result = await service.getUserRole("org-1", "user-1");

      expect(mockRbacService.getUserOrganisationRole).toHaveBeenCalledWith(
        "org-1",
        "user-1",
      );
      expect(result).toEqual(mockRoleResponseDto);
    });

    it("should return null when user has no role", async () => {
      mockRbacService.getUserOrganisationRole.mockResolvedValue(null);

      const result = await service.getUserRole("org-1", "user-1");

      expect(mockRbacService.getUserOrganisationRole).toHaveBeenCalledWith(
        "org-1",
        "user-1",
      );
      expect(result).toBeNull();
    });
  });
});
