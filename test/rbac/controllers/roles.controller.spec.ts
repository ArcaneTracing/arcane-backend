jest.mock("@thallesp/nestjs-better-auth", () => ({
  Session:
    () => (target: any, propertyKey: string, parameterIndex: number) => {},
  UserSession: class UserSession {},
}));

import { Test, TestingModule } from "@nestjs/testing";
import { RolesController } from "../../../src/rbac/controllers/roles.controller";
import { OrgPermissionGuard } from "../../../src/rbac/guards/org-permission.guard";
import { EnterpriseLicenseGuard } from "../../../src/license/guards/enterprise-license.guard";
import { RolesService } from "../../../src/rbac/services/roles.service";
import { CreateRoleRequestDto } from "../../../src/rbac/dto/request/create-role-request.dto";
import { UpdateRoleRequestDto } from "../../../src/rbac/dto/request/update-role-request.dto";
import { RoleResponseDto } from "../../../src/rbac/dto/response/role-response.dto";
import { RoleMessageResponseDto } from "../../../src/rbac/dto/response/role-message-response.dto";

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

describe("RolesController", () => {
  let controller: RolesController;
  let rolesService: RolesService;

  const mockRolesService = {
    findAll: jest.fn(),
    findOneDto: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
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

  const mockRoleResponseDto: RoleResponseDto = {
    id: "role-1",
    name: "Test Role",
    description: "Test Description",
    permissions: ["projects:read"],
    isSystemRole: false,
    isInstanceLevel: false,
    organisationId: "org-1",
    projectId: null,
    canDelete: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [RolesController],
      providers: [
        {
          provide: RolesService,
          useValue: mockRolesService,
        },
      ],
    })
      .overrideGuard(OrgPermissionGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(EnterpriseLicenseGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<RolesController>(RolesController);
    rolesService = module.get<RolesService>(RolesService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("findAll", () => {
    it("should return all roles for an organisation", async () => {
      mockRolesService.findAll.mockResolvedValue([mockRoleResponseDto]);

      const result = await controller.findAll("org-1");

      expect(result).toEqual([mockRoleResponseDto]);
      expect(rolesService.findAll).toHaveBeenCalledWith("org-1");
    });
  });

  describe("findOne", () => {
    it("should return a role by id", async () => {
      mockRolesService.findOneDto.mockResolvedValue(mockRoleResponseDto);

      const result = await controller.findOne("role-1");

      expect(result).toEqual(mockRoleResponseDto);
      expect(rolesService.findOneDto).toHaveBeenCalledWith("role-1");
    });
  });

  describe("create", () => {
    it("should create a new role", async () => {
      const createRoleDto: CreateRoleRequestDto = {
        name: "New Role",
        description: "New Description",
        permissions: ["projects:read"],
      };
      mockRolesService.create.mockResolvedValue(mockRoleResponseDto);

      const result = await controller.create(
        "org-1",
        createRoleDto,
        mockUserSession,
      );

      expect(result).toEqual(mockRoleResponseDto);
      expect(rolesService.create).toHaveBeenCalledWith(
        "org-1",
        createRoleDto,
        mockUserSession.user.id,
      );
    });
  });

  describe("update", () => {
    it("should update a role", async () => {
      const updateRoleDto: UpdateRoleRequestDto = {
        name: "Updated Role",
        permissions: ["projects:read", "projects:write"],
      };
      const updatedRole = { ...mockRoleResponseDto, name: "Updated Role" };
      mockRolesService.update.mockResolvedValue(updatedRole);

      const result = await controller.update(
        "org-1",
        "role-1",
        updateRoleDto,
        mockUserSession,
      );

      expect(result).toEqual(updatedRole);
      expect(rolesService.update).toHaveBeenCalledWith(
        "org-1",
        "role-1",
        updateRoleDto,
        mockUserSession.user.id,
      );
    });
  });

  describe("delete", () => {
    it("should delete a role", async () => {
      mockRolesService.delete.mockResolvedValue(undefined);

      const result = await controller.delete(
        "org-1",
        "role-1",
        mockUserSession,
      );

      expect(result).toEqual({ message: "Role deleted successfully" });
      expect(rolesService.delete).toHaveBeenCalledWith(
        "org-1",
        "role-1",
        mockUserSession.user.id,
      );
    });
  });
});
