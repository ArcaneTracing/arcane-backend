import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { RbacSeedService } from "../../../src/rbac/services/rbac-seed.service";
import { Role } from "../../../src/rbac/entities/role.entity";
import { Repository } from "typeorm";

describe("RbacSeedService", () => {
  let service: RbacSeedService;
  let roleRepository: Repository<Role>;

  const mockRoleRepository = {
    find: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  };

  const createMockRole = (overrides: Partial<Role> = {}): Role =>
    ({
      id: "role-1",
      name: "Organisation Admin",
      description: "Test role",
      permissions: ["organisations:read"],
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
        RbacSeedService,
        {
          provide: getRepositoryToken(Role),
          useValue: mockRoleRepository,
        },
      ],
    }).compile();

    service = module.get<RbacSeedService>(RbacSeedService);
    roleRepository = module.get<Repository<Role>>(getRepositoryToken(Role));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("seedOrganisationRoles", () => {
    it("should seed organisation roles when none exist", async () => {
      mockRoleRepository.find.mockResolvedValue([]);
      const adminRole = createMockRole({ name: "Organisation Admin" });
      const memberRole = createMockRole({
        id: "role-2",
        name: "Organisation Member",
      });
      mockRoleRepository.create.mockReturnValue(adminRole);
      mockRoleRepository.save.mockResolvedValue([adminRole, memberRole]);

      const result = await service.seedOrganisationRoles("org-1");

      expect(mockRoleRepository.find).toHaveBeenCalledWith({
        where: {
          organisationId: "org-1",
          projectId: null,
          isSystemRole: true,
        },
      });
      expect(mockRoleRepository.create).toHaveBeenCalledTimes(2);
      expect(mockRoleRepository.save).toHaveBeenCalled();
      expect(result).toEqual(adminRole);
    });

    it("should return null when roles already exist", async () => {
      const existingRole = createMockRole();
      mockRoleRepository.find.mockResolvedValue([existingRole]);

      const result = await service.seedOrganisationRoles("org-1");

      expect(mockRoleRepository.find).toHaveBeenCalled();
      expect(mockRoleRepository.create).not.toHaveBeenCalled();
      expect(mockRoleRepository.save).not.toHaveBeenCalled();
      expect(result).toBeNull();
    });

    it("should return Organisation Admin role from saved roles", async () => {
      mockRoleRepository.find.mockResolvedValue([]);
      const adminRole = createMockRole({ name: "Organisation Admin" });
      const memberRole = createMockRole({
        id: "role-2",
        name: "Organisation Member",
      });

      mockRoleRepository.create
        .mockReturnValueOnce(adminRole)
        .mockReturnValueOnce(memberRole);
      mockRoleRepository.save.mockResolvedValue([memberRole, adminRole]);

      const result = await service.seedOrganisationRoles("org-1");

      expect(result).toEqual(adminRole);
      expect(result?.name).toBe("Organisation Admin");
    });
  });

  describe("seedProjectRoles", () => {
    it("should seed project roles when none exist", async () => {
      mockRoleRepository.find.mockResolvedValue([]);
      const adminRole = createMockRole({
        name: "Project Admin",
        projectId: "project-1",
      });
      const memberRole = createMockRole({
        id: "role-2",
        name: "Member",
        projectId: "project-1",
      });
      const viewerRole = createMockRole({
        id: "role-3",
        name: "Viewer",
        projectId: "project-1",
      });

      mockRoleRepository.create
        .mockReturnValueOnce(adminRole)
        .mockReturnValueOnce(memberRole)
        .mockReturnValueOnce(viewerRole);
      mockRoleRepository.save.mockResolvedValue([
        adminRole,
        memberRole,
        viewerRole,
      ]);

      const result = await service.seedProjectRoles("org-1", "project-1");

      expect(mockRoleRepository.find).toHaveBeenCalledWith({
        where: {
          organisationId: "org-1",
          projectId: "project-1",
          isSystemRole: true,
        },
      });
      expect(mockRoleRepository.create).toHaveBeenCalledTimes(3);
      expect(mockRoleRepository.save).toHaveBeenCalled();
      expect(result).toEqual(adminRole);
      expect(result?.name).toBe("Project Admin");
    });

    it("should return existing Project Admin role when roles already exist", async () => {
      const existingAdminRole = createMockRole({
        name: "Project Admin",
        projectId: "project-1",
      });
      const existingMemberRole = createMockRole({
        id: "role-2",
        name: "Member",
        projectId: "project-1",
      });
      mockRoleRepository.find.mockResolvedValue([
        existingAdminRole,
        existingMemberRole,
      ]);

      const result = await service.seedProjectRoles("org-1", "project-1");

      expect(mockRoleRepository.find).toHaveBeenCalled();
      expect(mockRoleRepository.create).not.toHaveBeenCalled();
      expect(mockRoleRepository.save).not.toHaveBeenCalled();
      expect(result).toEqual(existingAdminRole);
    });

    it("should return null when roles exist but Project Admin not found", async () => {
      const existingMemberRole = createMockRole({
        id: "role-2",
        name: "Member",
        projectId: "project-1",
      });
      mockRoleRepository.find.mockResolvedValue([existingMemberRole]);

      const result = await service.seedProjectRoles("org-1", "project-1");

      expect(result).toBeNull();
    });
  });
});
