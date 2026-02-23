import { Test, TestingModule } from "@nestjs/testing";

jest.mock("@thallesp/nestjs-better-auth", () => ({
  Session: () => () => {},
  UserSession: class UserSession {},
}));

import { getRepositoryToken } from "@nestjs/typeorm";
import { RolesController, ProjectRolesController } from "./roles.controller";
import { RolesService } from "../services/roles.service";
import { RbacPermissionService } from "../services/rbac-permission.service";
import { RbacMembershipService } from "../services/rbac-membership.service";
import { CreateRoleRequestDto } from "../dto/request/create-role-request.dto";
import { UpdateRoleRequestDto } from "../dto/request/update-role-request.dto";
import { RoleResponseDto } from "../dto/response/role-response.dto";
import { Reflector } from "@nestjs/core";
import {
  PERMISSION_KEY,
  ALLOW_PROJECT_CREATOR_KEY,
} from "../decorators/permission.decorator";
import { PROJECT_PERMISSIONS } from "../permissions/permissions";
import { Project } from "../../projects/entities/project.entity";
import { OrgPermissionGuard } from "../guards/org-permission.guard";
import { OrgProjectPermissionGuard } from "../guards/org-project-permission.guard";
import { EnterpriseLicenseGuard } from "../../license/guards/enterprise-license.guard";

describe("RolesController", () => {
  let controller: RolesController;
  let service: RolesService;

  const mockService = {
    findAll: jest.fn(),
    create: jest.fn(),
    findOneDto: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [RolesController],
      providers: [
        {
          provide: RolesService,
          useValue: mockService,
        },
        {
          provide: RbacPermissionService,
          useValue: { checkPermission: jest.fn().mockResolvedValue(undefined) },
        },
        {
          provide: RbacMembershipService,
          useValue: { isMember: jest.fn().mockResolvedValue(true) },
        },
      ],
    })
      .overrideGuard(OrgPermissionGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(EnterpriseLicenseGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<RolesController>(RolesController);
    service = module.get<RolesService>(RolesService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("findAll", () => {
    it("should return all roles for organisation", async () => {
      const orgId = "org-1";
      const roles: RoleResponseDto[] = [
        {
          id: "role-1",
          name: "Admin",
          description: "Admin role",
          permissions: ["organisations:read"],
          organisationId: orgId,
          projectId: null,
          isSystemRole: false,
          isInstanceLevel: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      mockService.findAll.mockResolvedValue(roles);

      const result = await controller.findAll(orgId);

      expect(result).toEqual(roles);
      expect(service.findAll).toHaveBeenCalledWith(orgId);
    });
  });

  describe("create", () => {
    it("should create a new role", async () => {
      const orgId = "org-1";
      const userId = "user-1";
      const createDto: CreateRoleRequestDto = {
        name: "New Role",
        description: "New role description",
        permissions: ["organisations:read"],
      };

      const createdRole: RoleResponseDto = {
        id: "role-2",
        ...createDto,
        organisationId: orgId,
        projectId: null,
        isSystemRole: false,
        isInstanceLevel: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockService.create.mockResolvedValue(createdRole);

      const result = await controller.create(orgId, createDto, {
        user: { id: userId },
      } as any);

      expect(result).toEqual(createdRole);
      expect(service.create).toHaveBeenCalledWith(orgId, createDto, userId);
    });
  });
});

describe("ProjectRolesController", () => {
  let controller: ProjectRolesController;
  let service: RolesService;

  const mockService = {
    findAll: jest.fn(),
    create: jest.fn(),
    findOneDto: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProjectRolesController],
      providers: [
        {
          provide: RolesService,
          useValue: mockService,
        },
        Reflector,
        {
          provide: RbacPermissionService,
          useValue: { checkPermission: jest.fn().mockResolvedValue(undefined) },
        },
        {
          provide: RbacMembershipService,
          useValue: {
            isMember: jest.fn().mockResolvedValue(true),
            isProjectMember: jest.fn().mockResolvedValue(true),
          },
        },
        {
          provide: getRepositoryToken(Project),
          useValue: { findOne: jest.fn() },
        },
      ],
    })
      .overrideGuard(OrgProjectPermissionGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(EnterpriseLicenseGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<ProjectRolesController>(ProjectRolesController);
    service = module.get<RolesService>(RolesService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("Permission Decorators", () => {
    it("should have PROJECT_PERMISSIONS.ROLES_READ permission on findAll", () => {
      const metadata = Reflect.getMetadata(
        PERMISSION_KEY,
        ProjectRolesController.prototype.findAll,
      );
      expect(metadata).toBe(PROJECT_PERMISSIONS.ROLES_READ);
    });

    it("should have allowProjectCreator flag on findAll", () => {
      const metadata = Reflect.getMetadata(
        ALLOW_PROJECT_CREATOR_KEY,
        ProjectRolesController.prototype.findAll,
      );
      expect(metadata).toBe(true);
    });

    it("should have PROJECT_PERMISSIONS.ROLES_CREATE permission on create", () => {
      const metadata = Reflect.getMetadata(
        PERMISSION_KEY,
        ProjectRolesController.prototype.create,
      );
      expect(metadata).toBe(PROJECT_PERMISSIONS.ROLES_CREATE);
    });

    it("should have allowProjectCreator flag on create", () => {
      const metadata = Reflect.getMetadata(
        ALLOW_PROJECT_CREATOR_KEY,
        ProjectRolesController.prototype.create,
      );
      expect(metadata).toBe(true);
    });

    it("should have PROJECT_PERMISSIONS.ROLES_UPDATE permission on update", () => {
      const metadata = Reflect.getMetadata(
        PERMISSION_KEY,
        ProjectRolesController.prototype.update,
      );
      expect(metadata).toBe(PROJECT_PERMISSIONS.ROLES_UPDATE);
    });

    it("should have allowProjectCreator flag on update", () => {
      const metadata = Reflect.getMetadata(
        ALLOW_PROJECT_CREATOR_KEY,
        ProjectRolesController.prototype.update,
      );
      expect(metadata).toBe(true);
    });

    it("should have PROJECT_PERMISSIONS.ROLES_DELETE permission on delete", () => {
      const metadata = Reflect.getMetadata(
        PERMISSION_KEY,
        ProjectRolesController.prototype.delete,
      );
      expect(metadata).toBe(PROJECT_PERMISSIONS.ROLES_DELETE);
    });

    it("should have allowProjectCreator flag on delete", () => {
      const metadata = Reflect.getMetadata(
        ALLOW_PROJECT_CREATOR_KEY,
        ProjectRolesController.prototype.delete,
      );
      expect(metadata).toBe(true);
    });
  });

  describe("findAll", () => {
    it("should return all roles for project", async () => {
      const orgId = "org-1";
      const projectId = "project-1";
      const roles: RoleResponseDto[] = [
        {
          id: "role-1",
          name: "Member",
          description: "Member role",
          permissions: ["projects:read"],
          organisationId: orgId,
          projectId: projectId,
          isSystemRole: false,
          isInstanceLevel: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      mockService.findAll.mockResolvedValue(roles);

      const result = await controller.findAll(orgId, projectId);

      expect(result).toEqual(roles);
      expect(service.findAll).toHaveBeenCalledWith(orgId, projectId);
    });
  });

  describe("create", () => {
    it("should create a new project role", async () => {
      const orgId = "org-1";
      const projectId = "project-1";
      const userId = "user-1";
      const createDto: CreateRoleRequestDto = {
        name: "New Project Role",
        description: "New project role description",
        permissions: ["projects:read", "projects:update"],
      };

      const createdRole: RoleResponseDto = {
        id: "role-2",
        ...createDto,
        organisationId: orgId,
        projectId: projectId,
        isSystemRole: false,
        isInstanceLevel: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockService.create.mockResolvedValue(createdRole);

      const result = await controller.create(orgId, projectId, createDto, {
        user: { id: userId },
      } as any);

      expect(result).toEqual(createdRole);
      expect(service.create).toHaveBeenCalledWith(
        orgId,
        createDto,
        userId,
        projectId,
      );
    });
  });

  describe("update", () => {
    it("should update a project role", async () => {
      const orgId = "org-1";
      const projectId = "project-1";
      const roleId = "role-1";
      const userId = "user-1";
      const updateDto: UpdateRoleRequestDto = {
        name: "Updated Role",
        description: "Updated description",
        permissions: ["projects:read"],
      };

      const updatedRole: RoleResponseDto = {
        id: roleId,
        ...updateDto,
        organisationId: orgId,
        projectId: projectId,
        isSystemRole: false,
        isInstanceLevel: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockService.update.mockResolvedValue(updatedRole);

      const result = await controller.update(
        orgId,
        projectId,
        roleId,
        updateDto,
        {
          user: { id: userId },
        } as any,
      );

      expect(result).toEqual(updatedRole);
      expect(service.update).toHaveBeenCalledWith(
        orgId,
        roleId,
        updateDto,
        userId,
        projectId,
      );
    });
  });

  describe("delete", () => {
    it("should delete a project role", async () => {
      const orgId = "org-1";
      const projectId = "project-1";
      const roleId = "role-1";
      const userId = "user-1";

      mockService.delete.mockResolvedValue(undefined);

      await controller.delete(orgId, projectId, roleId, {
        user: { id: userId },
      } as any);

      expect(service.delete).toHaveBeenCalledWith(
        orgId,
        roleId,
        userId,
        projectId,
      );
    });
  });
});
