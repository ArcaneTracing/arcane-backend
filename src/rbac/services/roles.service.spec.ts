import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { DataSource, EntityManager } from "typeorm";
import { RolesService } from "./roles.service";
import { Role } from "../entities/role.entity";
import { RoleValidator } from "../validators/role.validator";
import { AuditService } from "../../audit/audit.service";
import { RbacAssignmentService } from "./rbac-assignment.service";
import { NotFoundException, ForbiddenException } from "@nestjs/common";

describe("RolesService", () => {
  let service: RolesService;

  const mockRoleRepository = {
    findOne: jest.fn(),
    find: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    remove: jest.fn(),
  };

  const mockAssignmentService = {
    getUserIdsForRole: jest.fn(),
    removeRole: jest.fn(),
    assignRole: jest.fn(),
  };

  const mockAuditService = {
    record: jest.fn(),
  };

  const mockDataSource = {
    transaction: jest.fn(),
  };

  const mockRoleValidator = {
    validateRole: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RolesService,
        {
          provide: getRepositoryToken(Role),
          useValue: mockRoleRepository,
        },
        {
          provide: RoleValidator,
          useValue: mockRoleValidator,
        },
        {
          provide: AuditService,
          useValue: mockAuditService,
        },
        {
          provide: RbacAssignmentService,
          useValue: mockAssignmentService,
        },
        {
          provide: DataSource,
          useValue: mockDataSource,
        },
      ],
    }).compile();

    service = module.get<RolesService>(RolesService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("delete", () => {
    const orgId = "org-1";
    const projectId = "project-1";
    const roleId = "role-1";
    const userId = "user-1";

    const createMockRole = (overrides: Partial<Role> = {}): Role =>
      ({
        id: roleId,
        name: "Test Role",
        description: "Test Description",
        permissions: ["projects:read"],
        organisationId: orgId,
        projectId: projectId,
        isSystemRole: false,
        isInstanceLevel: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        ...overrides,
      }) as Role;

    const createMockTransaction = (roleToRemove: Role) => {
      const mockRoleRepo = {
        remove: jest.fn().mockResolvedValue(roleToRemove),
      };
      const mockManager = {
        getRepository: jest.fn(() => mockRoleRepo),
      } as unknown as EntityManager;
      return jest.fn(
        async (callback: (manager: EntityManager) => Promise<void>) => {
          await callback(mockManager);
        },
      );
    };

    beforeEach(() => {
      mockRoleRepository.findOne.mockImplementation((options: any) => {
        if (options.where?.id === roleId) {
          return Promise.resolve(createMockRole());
        }
        return Promise.resolve(null);
      });
    });

    it("should throw error when trying to delete system role", async () => {
      const systemRole = createMockRole({ isSystemRole: true });
      mockRoleRepository.findOne.mockResolvedValue(systemRole);

      await expect(
        service.delete(orgId, roleId, userId, projectId),
      ).rejects.toThrow(ForbiddenException);

      expect(mockRoleRepository.findOne).toHaveBeenCalledWith({
        where: { id: roleId },
      });
    });

    it("should throw error when trying to delete global role", async () => {
      const globalRole = createMockRole({ organisationId: null });
      mockRoleRepository.findOne.mockResolvedValue(globalRole);

      await expect(
        service.delete(orgId, roleId, userId, projectId),
      ).rejects.toThrow(ForbiddenException);
    });

    it("should throw error when role does not belong to organisation", async () => {
      const wrongOrgRole = createMockRole({ organisationId: "other-org" });
      mockRoleRepository.findOne.mockResolvedValue(wrongOrgRole);

      await expect(
        service.delete(orgId, roleId, userId, projectId),
      ).rejects.toThrow(ForbiddenException);
    });

    it("should throw error when role does not belong to project", async () => {
      const wrongProjectRole = createMockRole({ projectId: "other-project" });
      mockRoleRepository.findOne.mockResolvedValue(wrongProjectRole);

      await expect(
        service.delete(orgId, roleId, userId, projectId),
      ).rejects.toThrow(ForbiddenException);
    });

    it("should delete role directly when no users are assigned", async () => {
      const role = createMockRole();
      mockRoleRepository.findOne.mockResolvedValue(role);
      mockAssignmentService.getUserIdsForRole.mockResolvedValue([]);
      mockRoleRepository.remove.mockResolvedValue(role);

      await service.delete(orgId, roleId, userId, projectId);

      expect(mockAssignmentService.getUserIdsForRole).toHaveBeenCalledWith(
        roleId,
      );
      expect(mockRoleRepository.remove).toHaveBeenCalledWith(role);
      expect(mockAuditService.record).toHaveBeenCalled();
    });

    it("should reassign users to default Member role for project-scoped role", async () => {
      const role = createMockRole({ projectId: projectId });
      const defaultRole = createMockRole({
        id: "member-role-id",
        name: "Member",
        isSystemRole: true,
      });
      const userIds = ["user-1", "user-2"];

      mockRoleRepository.findOne
        .mockResolvedValueOnce(role)
        .mockResolvedValueOnce(defaultRole);
      mockAssignmentService.getUserIdsForRole.mockResolvedValue(userIds);
      mockDataSource.transaction.mockImplementation(
        createMockTransaction(role),
      );

      await service.delete(orgId, roleId, userId, projectId);

      expect(mockAssignmentService.getUserIdsForRole).toHaveBeenCalledWith(
        roleId,
      );
      expect(mockRoleRepository.findOne).toHaveBeenCalledWith({
        where: {
          name: "Member",
          isSystemRole: true,
          organisationId: orgId,
          projectId: projectId,
        },
      });
      expect(mockDataSource.transaction).toHaveBeenCalled();
      expect(mockAssignmentService.removeRole).toHaveBeenCalledTimes(
        userIds.length,
      );
      expect(mockAssignmentService.assignRole).toHaveBeenCalledTimes(
        userIds.length,
      );
      expect(mockAuditService.record).toHaveBeenCalled();
    });

    it("should reassign users to default Organisation Member role for org-scoped role", async () => {
      const role = createMockRole({ projectId: null });
      const defaultRole = createMockRole({
        id: "org-member-role-id",
        name: "Organisation Member",
        isSystemRole: true,
        projectId: null,
      });
      const userIds = ["user-1"];

      mockRoleRepository.findOne
        .mockResolvedValueOnce(role)
        .mockResolvedValueOnce(defaultRole);
      mockAssignmentService.getUserIdsForRole.mockResolvedValue(userIds);
      mockDataSource.transaction.mockImplementation(
        createMockTransaction(role),
      );

      await service.delete(orgId, roleId, userId);

      expect(mockRoleRepository.findOne).toHaveBeenCalledWith({
        where: {
          name: "Organisation Member",
          isSystemRole: true,
          organisationId: orgId,
          projectId: null,
        },
      });
      expect(mockDataSource.transaction).toHaveBeenCalled();
      expect(mockAssignmentService.removeRole).toHaveBeenCalledWith(
        userIds[0],
        roleId,
        expect.anything(),
      );
      expect(mockAssignmentService.assignRole).toHaveBeenCalledWith(
        userIds[0],
        defaultRole.id,
        expect.anything(),
      );
    });

    it("should throw error when default Member role not found for project", async () => {
      const role = createMockRole({ projectId: projectId });
      const userIds = ["user-1"];

      mockRoleRepository.findOne
        .mockResolvedValueOnce(role)
        .mockResolvedValueOnce(null);
      mockAssignmentService.getUserIdsForRole.mockResolvedValue(userIds);

      await expect(
        service.delete(orgId, roleId, userId, projectId),
      ).rejects.toThrow(NotFoundException);

      expect(mockRoleRepository.findOne).toHaveBeenCalledWith({
        where: {
          name: "Member",
          isSystemRole: true,
          organisationId: orgId,
          projectId: projectId,
        },
      });
    });

    it("should throw error when default Organisation Member role not found", async () => {
      const role = createMockRole({ projectId: null });
      const userIds = ["user-1"];

      mockRoleRepository.findOne
        .mockResolvedValueOnce(role)
        .mockResolvedValueOnce(null);
      mockAssignmentService.getUserIdsForRole.mockResolvedValue(userIds);

      await expect(service.delete(orgId, roleId, userId)).rejects.toThrow(
        NotFoundException,
      );

      expect(mockRoleRepository.findOne).toHaveBeenCalledWith({
        where: {
          name: "Organisation Member",
          isSystemRole: true,
          organisationId: orgId,
          projectId: null,
        },
      });
    });

    it("should record audit event after deletion", async () => {
      const role = createMockRole();
      mockRoleRepository.findOne.mockResolvedValue(role);
      mockAssignmentService.getUserIdsForRole.mockResolvedValue([]);
      mockRoleRepository.remove.mockResolvedValue(role);

      await service.delete(orgId, roleId, userId, projectId);

      expect(mockAuditService.record).toHaveBeenCalledWith({
        action: "role.deleted",
        actorId: userId,
        actorType: "user",
        resourceType: "role",
        resourceId: roleId,
        organisationId: orgId,
        projectId: projectId,
        beforeState: expect.objectContaining({
          id: roleId,
          name: role.name,
        }),
        afterState: null,
        metadata: { organisationId: orgId, projectId: projectId },
      });
    });
  });
});
