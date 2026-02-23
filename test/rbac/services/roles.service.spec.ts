import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import {
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from "@nestjs/common";
import { RolesService } from "../../../src/rbac/services/roles.service";
import { RoleValidator } from "../../../src/rbac/validators/role.validator";
import { Role } from "../../../src/rbac/entities/role.entity";
import { CreateRoleRequestDto } from "../../../src/rbac/dto/request/create-role-request.dto";
import { UpdateRoleRequestDto } from "../../../src/rbac/dto/request/update-role-request.dto";
import { Repository } from "typeorm";
import { DataSource } from "typeorm";
import {
  ERROR_MESSAGES,
  formatError,
} from "../../../src/common/constants/error-messages.constants";
import { AuditService } from "../../../src/audit/audit.service";
import { RbacAssignmentService } from "../../../src/rbac/services/rbac-assignment.service";

describe("RolesService", () => {
  let service: RolesService;
  let roleRepository: Repository<Role>;
  let roleValidator: RoleValidator;

  const mockAuditService = { record: jest.fn().mockResolvedValue(undefined) };

  const mockAssignmentService = {
    assignRole: jest.fn(),
    unassignRole: jest.fn(),
    getUserIdsForRole: jest.fn().mockResolvedValue([]),
  };

  const mockDataSource = {
    createQueryRunner: jest.fn(),
  };

  const mockRoleRepository = {
    find: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    remove: jest.fn(),
  };

  const mockRoleValidator = {
    validateRoleName: jest.fn(),
    validatePermissions: jest.fn(),
    validateRoleScope: jest.fn(),
    canDeleteRole: jest.fn(),
  };

  const createMockRole = (overrides: Partial<Role> = {}): Role =>
    ({
      id: "role-1",
      name: "Member",
      description: "Test role",
      permissions: ["projects:read"],
      isSystemRole: true,
      isInstanceLevel: false,
      organisationId: "org-1",
      projectId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      get scope() {
        return "organisation" as any;
      },
      ...overrides,
    }) as Role;

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
        { provide: AuditService, useValue: mockAuditService },
        { provide: RbacAssignmentService, useValue: mockAssignmentService },
        { provide: DataSource, useValue: mockDataSource },
      ],
    }).compile();

    service = module.get<RolesService>(RolesService);
    roleRepository = module.get<Repository<Role>>(getRepositoryToken(Role));
    roleValidator = module.get<RoleValidator>(RoleValidator);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("findAll", () => {
    it("should return project-scoped roles when projectId is provided", async () => {
      const systemRole = createMockRole({
        id: "role-1",
        projectId: "project-1",
        isSystemRole: true,
      });
      const customRole = createMockRole({
        id: "role-2",
        projectId: "project-1",
        isSystemRole: false,
      });
      mockRoleRepository.find
        .mockResolvedValueOnce([systemRole])
        .mockResolvedValueOnce([customRole]);

      const result = await service.findAll("org-1", "project-1");

      expect(mockRoleRepository.find).toHaveBeenCalledTimes(2);
      expect(mockRoleRepository.find).toHaveBeenNthCalledWith(1, {
        where: {
          isSystemRole: true,
          organisationId: "org-1",
          projectId: "project-1",
        },
      });
      expect(mockRoleRepository.find).toHaveBeenNthCalledWith(2, {
        where: {
          organisationId: "org-1",
          projectId: "project-1",
          isSystemRole: false,
        },
      });
      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({ id: "role-1" });
      expect(result[1]).toMatchObject({ id: "role-2" });
    });

    it("should return organisation-scoped roles when projectId is not provided", async () => {
      const systemRole = createMockRole({
        id: "role-1",
        projectId: null,
        isSystemRole: true,
      });
      const customRole = createMockRole({
        id: "role-2",
        projectId: null,
        isSystemRole: false,
      });
      mockRoleRepository.find
        .mockResolvedValueOnce([systemRole])
        .mockResolvedValueOnce([customRole]);

      const result = await service.findAll("org-1");

      expect(mockRoleRepository.find).toHaveBeenCalledTimes(2);
      expect(mockRoleRepository.find).toHaveBeenNthCalledWith(1, {
        where: {
          isSystemRole: true,
          organisationId: "org-1",
          projectId: null,
        },
      });
      expect(mockRoleRepository.find).toHaveBeenNthCalledWith(2, {
        where: {
          organisationId: "org-1",
          projectId: null,
          isSystemRole: false,
        },
      });
      expect(result).toHaveLength(2);
    });

    it("should return empty array when no roles exist", async () => {
      mockRoleRepository.find.mockResolvedValue([]);

      const result = await service.findAll("org-1");

      expect(result).toEqual([]);
    });
  });

  describe("findOne", () => {
    it("should return role when found", async () => {
      const role = createMockRole();
      mockRoleRepository.findOne.mockResolvedValue(role);

      const result = await service.findOne("role-1");

      expect(mockRoleRepository.findOne).toHaveBeenCalledWith({
        where: { id: "role-1" },
      });
      expect(result).toEqual(role);
    });

    it("should throw NotFoundException when role not found", async () => {
      mockRoleRepository.findOne.mockResolvedValue(null);

      await expect(service.findOne("role-1")).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.findOne("role-1")).rejects.toThrow(
        formatError(ERROR_MESSAGES.ROLE_NOT_FOUND, "role-1"),
      );
    });
  });

  describe("create", () => {
    it("should create organisation-scoped role", async () => {
      const createDto: CreateRoleRequestDto = {
        name: "Custom Role",
        description: "Test role",
        permissions: ["projects:read"],
      };
      const savedRole = createMockRole({
        id: "role-new",
        name: "Custom Role",
        isSystemRole: false,
      });
      mockRoleValidator.validatePermissions.mockReturnValue(undefined);
      mockRoleValidator.validateRoleScope.mockReturnValue(undefined);
      mockRoleRepository.findOne.mockResolvedValue(null);
      mockRoleRepository.create.mockReturnValue(savedRole);
      mockRoleRepository.save.mockResolvedValue(savedRole);

      const result = await service.create("org-1", createDto, "user-1");

      expect(mockRoleValidator.validatePermissions).toHaveBeenCalledWith([
        "projects:read",
      ]);
      expect(mockRoleValidator.validateRoleScope).toHaveBeenCalledWith(
        "org-1",
        undefined,
      );
      expect(mockRoleRepository.findOne).toHaveBeenCalledWith({
        where: {
          name: "Custom Role",
          organisationId: "org-1",
          projectId: null,
        },
      });
      expect(mockAuditService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "role.created",
          actorId: "user-1",
          resourceType: "role",
          resourceId: "role-new",
          organisationId: "org-1",
          afterState: expect.objectContaining({
            id: "role-new",
            name: "Custom Role",
            isSystemRole: false,
            organisationId: "org-1",
            projectId: null,
          }),
          metadata: expect.objectContaining({
            creatorId: "user-1",
            organisationId: "org-1",
            projectId: null,
          }),
        }),
      );
      expect(result).toMatchObject({ id: "role-new", name: "Custom Role" });
    });

    it("should create project-scoped role", async () => {
      const createDto: CreateRoleRequestDto = {
        name: "Project Role",
        permissions: ["projects:read"],
      };
      const savedRole = createMockRole({
        id: "role-new",
        name: "Project Role",
        projectId: "project-1",
        isSystemRole: false,
      });
      mockRoleValidator.validatePermissions.mockReturnValue(undefined);
      mockRoleValidator.validateRoleScope.mockReturnValue(undefined);
      mockRoleRepository.findOne.mockResolvedValue(null);
      mockRoleRepository.create.mockReturnValue(savedRole);
      mockRoleRepository.save.mockResolvedValue(savedRole);

      const result = await service.create(
        "org-1",
        createDto,
        "user-1",
        "project-1",
      );

      expect(mockRoleRepository.findOne).toHaveBeenCalledWith({
        where: {
          name: "Project Role",
          organisationId: "org-1",
          projectId: "project-1",
        },
      });
      expect(mockAuditService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "role.created",
          actorId: "user-1",
          resourceType: "role",
          resourceId: "role-new",
          organisationId: "org-1",
          projectId: "project-1",
          metadata: expect.objectContaining({
            organisationId: "org-1",
            projectId: "project-1",
          }),
        }),
      );
      expect(result).toMatchObject({ projectId: "project-1" });
    });

    it("should throw BadRequestException when role name already exists", async () => {
      const createDto: CreateRoleRequestDto = {
        name: "Existing Role",
        permissions: ["projects:read"],
      };
      const existingRole = createMockRole({ name: "Existing Role" });
      mockRoleValidator.validatePermissions.mockReturnValue(undefined);
      mockRoleValidator.validateRoleScope.mockReturnValue(undefined);
      mockRoleRepository.findOne.mockResolvedValue(existingRole);

      await expect(
        service.create("org-1", createDto, "user-1"),
      ).rejects.toThrow(BadRequestException);
      expect(mockRoleRepository.save).not.toHaveBeenCalled();
    });
  });

  describe("update", () => {
    it("should update custom role", async () => {
      const existingRole = createMockRole({ isSystemRole: false });
      const updateDto: UpdateRoleRequestDto = {
        name: "Updated Role",
        permissions: ["projects:write"],
      };
      const updatedRole = { ...existingRole, ...updateDto };
      mockRoleRepository.findOne.mockResolvedValue({ ...existingRole });
      mockRoleValidator.validatePermissions.mockReturnValue(undefined);
      mockRoleRepository.save.mockResolvedValue(updatedRole);

      const result = await service.update(
        "org-1",
        "role-1",
        updateDto,
        "user-1",
      );

      expect(mockRoleRepository.findOne).toHaveBeenCalledWith({
        where: { id: "role-1" },
      });
      expect(mockRoleValidator.validatePermissions).toHaveBeenCalledWith([
        "projects:write",
      ]);
      expect(mockRoleRepository.save).toHaveBeenCalled();
      expect(mockAuditService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "role.updated",
          actorId: "user-1",
          resourceType: "role",
          resourceId: "role-1",
          organisationId: "org-1",
          metadata: {
            changedFields: ["name", "permissions"],
            organisationId: "org-1",
            projectId: null,
          },
        }),
      );
      expect(result).toMatchObject({ name: "Updated Role" });
    });

    it("should throw ForbiddenException when updating system role", async () => {
      const systemRole = createMockRole({ isSystemRole: true });
      mockRoleRepository.findOne.mockResolvedValue(systemRole);

      await expect(
        service.update("org-1", "role-1", { name: "Updated" }, "user-1"),
      ).rejects.toThrow(ForbiddenException);
      expect(mockRoleRepository.save).not.toHaveBeenCalled();
    });

    it("should throw ForbiddenException when role does not belong to organisation", async () => {
      const role = createMockRole({
        organisationId: "org-2",
        isSystemRole: false,
      });
      mockRoleRepository.findOne.mockResolvedValue(role);

      await expect(
        service.update("org-1", "role-1", { name: "Updated" }, "user-1"),
      ).rejects.toThrow(ForbiddenException);
    });

    it("should throw NotFoundException when role not found", async () => {
      mockRoleRepository.findOne.mockResolvedValue(null);

      await expect(
        service.update("org-1", "role-1", { name: "Updated" }, "user-1"),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe("delete", () => {
    it("should delete custom role", async () => {
      const role = createMockRole({
        isSystemRole: false,
        organisationId: "org-1",
      });
      mockRoleRepository.findOne.mockResolvedValue(role);
      mockRoleRepository.remove.mockResolvedValue(role);

      await service.delete("org-1", "role-1", "user-1");

      expect(mockRoleRepository.findOne).toHaveBeenCalledWith({
        where: { id: "role-1" },
      });
      expect(mockRoleRepository.remove).toHaveBeenCalledWith(role);
      expect(mockAuditService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "role.deleted",
          actorId: "user-1",
          resourceType: "role",
          resourceId: "role-1",
          organisationId: "org-1",
          beforeState: expect.any(Object),
          afterState: null,
          metadata: { organisationId: "org-1", projectId: null },
        }),
      );
    });

    it("should throw ForbiddenException when deleting system role", async () => {
      const role = createMockRole({ isSystemRole: true });
      mockRoleRepository.findOne.mockResolvedValue(role);

      await expect(service.delete("org-1", "role-1", "user-1")).rejects.toThrow(
        ForbiddenException,
      );
      expect(mockRoleRepository.remove).not.toHaveBeenCalled();
    });

    it("should throw ForbiddenException when deleting global role", async () => {
      const role = createMockRole({ organisationId: null });
      mockRoleRepository.findOne.mockResolvedValue(role);

      await expect(service.delete("org-1", "role-1", "user-1")).rejects.toThrow(
        ForbiddenException,
      );
    });

    it("should throw ForbiddenException when role does not belong to organisation", async () => {
      const role = createMockRole({
        organisationId: "org-2",
        isSystemRole: false,
      });
      mockRoleRepository.findOne.mockResolvedValue(role);

      await expect(service.delete("org-1", "role-1", "user-1")).rejects.toThrow(
        ForbiddenException,
      );
    });

    it("should throw NotFoundException when role not found", async () => {
      mockRoleRepository.findOne.mockResolvedValue(null);

      await expect(service.delete("org-1", "role-1", "user-1")).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe("findOneDto", () => {
    it("should return role as DTO", async () => {
      const role = createMockRole();
      mockRoleRepository.findOne.mockResolvedValue(role);

      const result = await service.findOneDto("role-1");

      expect(result).toMatchObject({ id: "role-1", name: "Member" });

      expect(result).toHaveProperty("createdAt");
      expect(result).toHaveProperty("updatedAt");
    });
  });

  describe("isSystemRole", () => {
    it("should return true for system role", async () => {
      const role = createMockRole({ isSystemRole: true });
      mockRoleRepository.findOne.mockResolvedValue(role);

      const result = await service.isSystemRole("role-1");

      expect(result).toBe(true);
    });

    it("should return false for custom role", async () => {
      const role = createMockRole({ isSystemRole: false });
      mockRoleRepository.findOne.mockResolvedValue(role);

      const result = await service.isSystemRole("role-1");

      expect(result).toBe(false);
    });
  });

  describe("getSystemRoles", () => {
    it("should return all system roles", async () => {
      const systemRoles = [
        createMockRole({
          id: "role-1",
          isSystemRole: true,
          organisationId: null,
        }),
        createMockRole({
          id: "role-2",
          isSystemRole: true,
          organisationId: null,
        }),
      ];

      mockRoleRepository.find.mockResolvedValue(systemRoles);

      const result = await service.getSystemRoles();

      expect(mockRoleRepository.find).toHaveBeenCalledWith({
        where: {
          isSystemRole: true,
          organisationId: null,
          projectId: null,
        },
      });
      expect(result).toEqual(systemRoles);
    });
  });
});
