import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { ExecutionContext, ForbiddenException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { OrgProjectPermissionGuard } from "../../../src/rbac/guards/org-project-permission.guard";
import { RbacPermissionService } from "../../../src/rbac/services/rbac-permission.service";
import { RbacMembershipService } from "../../../src/rbac/services/rbac-membership.service";
import { Project } from "../../../src/projects/entities/project.entity";
import {
  PERMISSION_KEY,
  ALLOW_PROJECT_CREATOR_KEY,
} from "../../../src/rbac/decorators/permission.decorator";
import {
  ERROR_MESSAGES,
  formatError,
} from "../../../src/common/constants/error-messages.constants";
import { Repository } from "typeorm";

describe("OrgProjectPermissionGuard", () => {
  let guard: OrgProjectPermissionGuard;
  let reflector: Reflector;
  let permissionService: RbacPermissionService;
  let membershipService: RbacMembershipService;
  let projectRepository: Repository<Project>;

  const mockReflector = {
    get: jest.fn(),
  };

  const mockPermissionService = {
    checkPermission: jest.fn(),
  };

  const mockMembershipService = {
    isMember: jest.fn(),
    isProjectMember: jest.fn(),
  };

  const mockProjectRepository = {
    findOne: jest.fn(),
  };

  const createMockContext = (
    session: any,
    params: any = {},
    handler?: any,
    controller?: any,
  ): ExecutionContext => {
    const request = {
      session,
      params,
    };
    return {
      switchToHttp: () => ({
        getRequest: () => request,
      }),
      getHandler: () => handler || (() => {}),
      getClass: () => controller || class TestController {},
    } as ExecutionContext;
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrgProjectPermissionGuard,
        {
          provide: Reflector,
          useValue: mockReflector,
        },
        {
          provide: RbacPermissionService,
          useValue: mockPermissionService,
        },
        {
          provide: RbacMembershipService,
          useValue: mockMembershipService,
        },
        {
          provide: getRepositoryToken(Project),
          useValue: mockProjectRepository,
        },
      ],
    }).compile();

    guard = module.get<OrgProjectPermissionGuard>(OrgProjectPermissionGuard);
    reflector = module.get<Reflector>(Reflector);
    permissionService = module.get<RbacPermissionService>(
      RbacPermissionService,
    );
    membershipService = module.get<RbacMembershipService>(
      RbacMembershipService,
    );
    projectRepository = module.get<Repository<Project>>(
      getRepositoryToken(Project),
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("canActivate", () => {
    it("should allow access when user is project member and no permission required", async () => {
      const session = { user: { id: "user-1" } };
      const params = { organisationId: "org-1", projectId: "project-1" };
      const context = createMockContext(session, params);
      mockReflector.get.mockReturnValue(undefined);
      mockMembershipService.isMember.mockResolvedValue(true);
      mockMembershipService.isProjectMember.mockResolvedValue(true);

      const result = await guard.canActivate(context);

      expect(mockMembershipService.isMember).toHaveBeenCalledWith(
        "org-1",
        "user-1",
      );
      expect(mockMembershipService.isProjectMember).toHaveBeenCalledWith(
        "project-1",
        "user-1",
      );
      expect(mockPermissionService.checkPermission).not.toHaveBeenCalled();
      expect(result).toBe(true);
    });

    it("should check permission when user is project member and permission required", async () => {
      const session = { user: { id: "user-1" } };
      const params = { organisationId: "org-1", projectId: "project-1" };
      const handler = () => {};
      const context = createMockContext(session, params, handler);
      mockReflector.get
        .mockReturnValueOnce("projects:read")
        .mockReturnValueOnce(undefined)
        .mockReturnValueOnce(undefined)
        .mockReturnValueOnce(undefined);
      mockMembershipService.isMember.mockResolvedValue(true);
      mockMembershipService.isProjectMember.mockResolvedValue(true);
      mockPermissionService.checkPermission.mockResolvedValue(undefined);

      const result = await guard.canActivate(context);

      expect(mockPermissionService.checkPermission).toHaveBeenCalledWith(
        "user-1",
        "projects:read",
        "org-1",
        "project-1",
      );
      expect(result).toBe(true);
    });

    it("should allow project creator when allowProjectCreator is true and user is creator", async () => {
      const session = { user: { id: "user-1" } };
      const params = { organisationId: "org-1", projectId: "project-1" };
      const handler = () => {};
      const context = createMockContext(session, params, handler);
      mockReflector.get
        .mockReturnValueOnce("projects:write")
        .mockReturnValueOnce(undefined)
        .mockReturnValueOnce(true)
        .mockReturnValueOnce(undefined);
      mockMembershipService.isMember.mockResolvedValue(true);
      mockMembershipService.isProjectMember.mockResolvedValue(false);
      const project = { id: "project-1", createdById: "user-1" } as Project;
      mockProjectRepository.findOne.mockResolvedValue(project);
      mockPermissionService.checkPermission.mockRejectedValue(
        new ForbiddenException("No permission"),
      );

      const result = await guard.canActivate(context);

      expect(mockProjectRepository.findOne).toHaveBeenCalledWith({
        where: { id: "project-1" },
      });
      expect(result).toBe(true);
    });

    it("should allow project creator when not member but is creator and allowProjectCreator is true", async () => {
      const session = { user: { id: "user-1" } };
      const params = { organisationId: "org-1", projectId: "project-1" };
      const handler = () => {};
      const context = createMockContext(session, params, handler);
      mockReflector.get
        .mockReturnValueOnce(undefined)
        .mockReturnValueOnce(undefined)
        .mockReturnValueOnce(true)
        .mockReturnValueOnce(undefined);
      mockMembershipService.isMember.mockResolvedValue(true);
      mockMembershipService.isProjectMember.mockResolvedValue(false);
      const project = { id: "project-1", createdById: "user-1" } as Project;
      mockProjectRepository.findOne.mockResolvedValue(project);

      const result = await guard.canActivate(context);

      expect(mockProjectRepository.findOne).toHaveBeenCalledWith({
        where: { id: "project-1" },
      });
      expect(result).toBe(true);
    });

    it("should throw ForbiddenException when session is missing", async () => {
      const params = { organisationId: "org-1", projectId: "project-1" };
      const context = createMockContext(null, params);

      await expect(guard.canActivate(context)).rejects.toThrow(
        ForbiddenException,
      );
      await expect(guard.canActivate(context)).rejects.toThrow(
        formatError(ERROR_MESSAGES.USER_NOT_AUTHENTICATED),
      );
    });

    it("should throw ForbiddenException when organisationId is missing", async () => {
      const session = { user: { id: "user-1" } };
      const params = { projectId: "project-1" };
      const context = createMockContext(session, params);

      await expect(guard.canActivate(context)).rejects.toThrow(
        ForbiddenException,
      );
      await expect(guard.canActivate(context)).rejects.toThrow(
        formatError(ERROR_MESSAGES.ORGANISATION_AND_PROJECT_CONTEXT_REQUIRED),
      );
    });

    it("should throw ForbiddenException when projectId is missing", async () => {
      const session = { user: { id: "user-1" } };
      const params = { organisationId: "org-1" };
      const context = createMockContext(session, params);

      await expect(guard.canActivate(context)).rejects.toThrow(
        ForbiddenException,
      );
      await expect(guard.canActivate(context)).rejects.toThrow(
        formatError(ERROR_MESSAGES.ORGANISATION_AND_PROJECT_CONTEXT_REQUIRED),
      );
    });

    it("should use projectUUID as projectId when projectId is missing", async () => {
      const session = { user: { id: "user-1" } };
      const params = { organisationId: "org-1", projectUUID: "project-1" };
      const handler = () => {};
      const context = createMockContext(session, params, handler);
      mockReflector.get.mockReturnValue(undefined);
      mockMembershipService.isMember.mockResolvedValue(true);
      mockMembershipService.isProjectMember.mockResolvedValue(true);

      const result = await guard.canActivate(context);

      expect(mockMembershipService.isProjectMember).toHaveBeenCalledWith(
        "project-1",
        "user-1",
      );
      expect(result).toBe(true);
    });

    it("should throw ForbiddenException when user is not organisation member", async () => {
      const session = { user: { id: "user-1" } };
      const params = { organisationId: "org-1", projectId: "project-1" };
      const context = createMockContext(session, params);
      mockReflector.get.mockReturnValue(undefined);
      mockMembershipService.isMember.mockResolvedValue(false);

      await expect(guard.canActivate(context)).rejects.toThrow(
        ForbiddenException,
      );
      await expect(guard.canActivate(context)).rejects.toThrow(
        formatError(ERROR_MESSAGES.USER_NOT_IN_ORGANISATION),
      );
      expect(mockMembershipService.isProjectMember).not.toHaveBeenCalled();
    });

    it("should throw ForbiddenException when user is not project member and not creator", async () => {
      const session = { user: { id: "user-1" } };
      const params = { organisationId: "org-1", projectId: "project-1" };
      const handler = () => {};
      const context = createMockContext(session, params, handler);
      mockReflector.get
        .mockReturnValueOnce(undefined)
        .mockReturnValueOnce(undefined)
        .mockReturnValueOnce(false)
        .mockReturnValueOnce(undefined);
      mockMembershipService.isMember.mockResolvedValue(true);
      mockMembershipService.isProjectMember.mockResolvedValue(false);

      await expect(guard.canActivate(context)).rejects.toThrow(
        ForbiddenException,
      );
      await expect(guard.canActivate(context)).rejects.toThrow(
        formatError(ERROR_MESSAGES.USER_DOES_NOT_BELONG_TO_PROJECT),
      );
    });

    it("should throw ForbiddenException when user is not project member, allowProjectCreator is true, but user is not creator", async () => {
      const session = { user: { id: "user-1" } };
      const params = { organisationId: "org-1", projectId: "project-1" };
      const handler = () => {};
      const context = createMockContext(session, params, handler);
      mockReflector.get
        .mockReturnValueOnce(undefined)
        .mockReturnValueOnce(undefined)
        .mockReturnValueOnce(true)
        .mockReturnValueOnce(undefined);
      mockMembershipService.isMember.mockResolvedValue(true);
      mockMembershipService.isProjectMember.mockResolvedValue(false);
      const project = { id: "project-1", createdById: "user-2" } as Project;
      mockProjectRepository.findOne.mockResolvedValue(project);

      await expect(guard.canActivate(context)).rejects.toThrow(
        ForbiddenException,
      );
      await expect(guard.canActivate(context)).rejects.toThrow(
        formatError(ERROR_MESSAGES.USER_DOES_NOT_BELONG_TO_PROJECT),
      );
    });

    it("should prioritize handler allowProjectCreator over controller", async () => {
      const session = { user: { id: "user-1" } };
      const params = { organisationId: "org-1", projectId: "project-1" };
      const handler = () => {};
      const controller = class TestController {};
      const context = createMockContext(session, params, handler, controller);
      mockReflector.get
        .mockReturnValueOnce(undefined)
        .mockReturnValueOnce(undefined)
        .mockReturnValueOnce(true)
        .mockReturnValueOnce(false);
      mockMembershipService.isMember.mockResolvedValue(true);
      mockMembershipService.isProjectMember.mockResolvedValue(false);
      const project = { id: "project-1", createdById: "user-1" } as Project;
      mockProjectRepository.findOne.mockResolvedValue(project);

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
    });

    it("should propagate permission check errors when allowProjectCreator is false", async () => {
      const session = { user: { id: "user-1" } };
      const params = { organisationId: "org-1", projectId: "project-1" };
      const handler = () => {};
      const context = createMockContext(session, params, handler);
      mockReflector.get
        .mockReturnValueOnce("projects:write")
        .mockReturnValueOnce(undefined)
        .mockReturnValueOnce(false)
        .mockReturnValueOnce(undefined);
      mockMembershipService.isMember.mockResolvedValue(true);
      mockMembershipService.isProjectMember.mockResolvedValue(true);
      const permissionError = new ForbiddenException("No permission");
      mockPermissionService.checkPermission.mockRejectedValue(permissionError);

      await expect(guard.canActivate(context)).rejects.toThrow(
        ForbiddenException,
      );

      expect(mockProjectRepository.findOne).not.toHaveBeenCalled();
    });
  });
});
