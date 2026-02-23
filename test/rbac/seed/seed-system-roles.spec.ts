import {
  seedOrganisationRoles,
  seedProjectRoles,
  seedSystemRoles,
} from "../../../src/rbac/seed/seed-system-roles";
import { Role } from "../../../src/rbac/entities/role.entity";
import {
  ANNOTATION_PERMISSIONS,
  ANNOTATION_QUEUE_PERMISSIONS,
  CONVERSATION_CONFIG_PERMISSIONS,
  CONVERSATION_PERMISSIONS,
  DATASET_PERMISSIONS,
  DATASOURCE_PERMISSIONS,
  ENTITY_PERMISSIONS,
  EVALUATION_PERMISSIONS,
  EXPERIMENT_PERMISSIONS,
  INSTANCE_PERMISSIONS,
  MODEL_CONFIGURATION_PERMISSIONS,
  ORGANISATION_PERMISSIONS,
  PROJECT_PERMISSIONS,
  PROMPT_PERMISSIONS,
  SCORE_PERMISSIONS,
  TRACE_PERMISSIONS,
} from "../../../src/rbac/permissions/permissions";

describe("seed-system-roles", () => {
  let dataSource: {
    getRepository: jest.Mock;
  };
  let roleRepository: {
    findOne: jest.Mock;
    find: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
  };

  beforeEach(() => {
    roleRepository = {
      findOne: jest.fn(),
      find: jest.fn(),
      create: jest.fn((payload) => payload),
      save: jest.fn(),
    };
    dataSource = {
      getRepository: jest.fn(() => roleRepository),
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("seedSystemRoles", () => {
    it("should return when owner role already exists", async () => {
      roleRepository.findOne.mockResolvedValue({ id: "role-1" });

      await seedSystemRoles(dataSource as any);

      expect(roleRepository.findOne).toHaveBeenCalledWith({
        where: {
          isSystemRole: true,
          isInstanceLevel: true,
          organisationId: null,
          projectId: null,
        },
      });
      expect(roleRepository.create).not.toHaveBeenCalled();
      expect(roleRepository.save).not.toHaveBeenCalled();
    });

    it("should create owner role when missing", async () => {
      roleRepository.findOne.mockResolvedValue(null);

      await seedSystemRoles(dataSource as any);

      expect(roleRepository.create).toHaveBeenCalledWith({
        name: "Owner",
        description: "Full control over the entire application instance",
        permissions: [INSTANCE_PERMISSIONS.ALL],
        isSystemRole: true,
        isInstanceLevel: true,
        organisationId: null,
        projectId: null,
      });
      expect(roleRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ name: "Owner" }),
      );
    });
  });

  describe("seedOrganisationRoles", () => {
    it("should return when roles already exist for organisation", async () => {
      roleRepository.find.mockResolvedValue([{ id: "role-1" }]);

      await seedOrganisationRoles(dataSource as any, "org-1");

      expect(roleRepository.find).toHaveBeenCalledWith({
        where: {
          organisationId: "org-1",
          projectId: null,
          isSystemRole: true,
        },
      });
      expect(roleRepository.create).not.toHaveBeenCalled();
      expect(roleRepository.save).not.toHaveBeenCalled();
    });

    it("should create organisation admin and member roles", async () => {
      roleRepository.find.mockResolvedValue([]);

      await seedOrganisationRoles(dataSource as any, "org-1");

      const createCalls = roleRepository.create.mock.calls.map(
        (call) => call[0],
      );
      expect(createCalls).toHaveLength(2);
      expect(createCalls[0]).toEqual(
        expect.objectContaining({
          name: "Organisation Admin",
          isSystemRole: true,
          isInstanceLevel: false,
          organisationId: "org-1",
          projectId: null,
        }),
      );
      expect(createCalls[0].permissions).toEqual(
        expect.arrayContaining([
          ...Object.values(ORGANISATION_PERMISSIONS),
          PROJECT_PERMISSIONS.CREATE,
          PROJECT_PERMISSIONS.READ,
          PROJECT_PERMISSIONS.UPDATE,
          PROJECT_PERMISSIONS.DELETE,
          PROJECT_PERMISSIONS.MEMBERS_READ,
          PROJECT_PERMISSIONS.MEMBERS_CREATE,
          PROJECT_PERMISSIONS.MEMBERS_DELETE,
          PROJECT_PERMISSIONS.ROLES_ASSIGN,
          PROJECT_PERMISSIONS.ROLES_REMOVE,
          ...Object.values(DATASOURCE_PERMISSIONS),
          ...Object.values(DATASET_PERMISSIONS),
          TRACE_PERMISSIONS.READ,
          CONVERSATION_PERMISSIONS.READ,
          ...Object.values(PROMPT_PERMISSIONS),
          ...Object.values(EXPERIMENT_PERMISSIONS),
          ...Object.values(EVALUATION_PERMISSIONS),
          ...Object.values(SCORE_PERMISSIONS),
          ...Object.values(ANNOTATION_QUEUE_PERMISSIONS),
          ...Object.values(ANNOTATION_PERMISSIONS),
          ...Object.values(MODEL_CONFIGURATION_PERMISSIONS),
          ...Object.values(CONVERSATION_CONFIG_PERMISSIONS),
          ...Object.values(ENTITY_PERMISSIONS),
        ]),
      );
      expect(createCalls[1]).toEqual(
        expect.objectContaining({
          name: "Organisation Member",
          isSystemRole: true,
          isInstanceLevel: false,
          organisationId: "org-1",
          projectId: null,
        }),
      );
      expect(createCalls[1].permissions).toEqual(
        expect.arrayContaining([
          ORGANISATION_PERMISSIONS.READ,
          ENTITY_PERMISSIONS.READ,
          CONVERSATION_CONFIG_PERMISSIONS.READ,
          MODEL_CONFIGURATION_PERMISSIONS.READ,
        ]),
      );
      expect(roleRepository.save).toHaveBeenCalledWith([
        expect.objectContaining({ name: "Organisation Admin" }),
        expect.objectContaining({ name: "Organisation Member" }),
      ]);
    });
  });

  describe("seedProjectRoles", () => {
    it("should return when roles already exist for project", async () => {
      roleRepository.find.mockResolvedValue([{ id: "role-1" }]);

      await seedProjectRoles(dataSource as any, "org-1", "project-1");

      expect(roleRepository.find).toHaveBeenCalledWith({
        where: {
          organisationId: "org-1",
          projectId: "project-1",
          isSystemRole: true,
        },
      });
      expect(roleRepository.create).not.toHaveBeenCalled();
      expect(roleRepository.save).not.toHaveBeenCalled();
    });

    it("should create member and viewer roles", async () => {
      roleRepository.find.mockResolvedValue([]);

      await seedProjectRoles(dataSource as any, "org-1", "project-1");

      const createCalls = roleRepository.create.mock.calls.map(
        (call) => call[0],
      );
      expect(createCalls).toHaveLength(2);
      expect(createCalls[0]).toEqual(
        expect.objectContaining({
          name: "Member",
          isSystemRole: true,
          isInstanceLevel: false,
          organisationId: "org-1",
          projectId: "project-1",
        }),
      );
      expect(createCalls[0].permissions).toEqual(
        expect.arrayContaining([
          PROJECT_PERMISSIONS.READ,
          ...Object.values(DATASOURCE_PERMISSIONS),
          ...Object.values(DATASET_PERMISSIONS),
          TRACE_PERMISSIONS.READ,
          CONVERSATION_PERMISSIONS.READ,
          ...Object.values(PROMPT_PERMISSIONS),
          ...Object.values(EXPERIMENT_PERMISSIONS),
          ...Object.values(EVALUATION_PERMISSIONS),
          ...Object.values(SCORE_PERMISSIONS),
          ...Object.values(ANNOTATION_QUEUE_PERMISSIONS),
          ...Object.values(ANNOTATION_PERMISSIONS),
          ENTITY_PERMISSIONS.READ,
          CONVERSATION_CONFIG_PERMISSIONS.READ,
          MODEL_CONFIGURATION_PERMISSIONS.READ,
        ]),
      );
      expect(createCalls[1]).toEqual(
        expect.objectContaining({
          name: "Viewer",
          isSystemRole: true,
          isInstanceLevel: false,
          organisationId: "org-1",
          projectId: "project-1",
        }),
      );
      expect(createCalls[1].permissions).toEqual(
        expect.arrayContaining([
          PROJECT_PERMISSIONS.READ,
          DATASOURCE_PERMISSIONS.READ,
          DATASET_PERMISSIONS.READ,
          TRACE_PERMISSIONS.READ,
          CONVERSATION_PERMISSIONS.READ,
          PROMPT_PERMISSIONS.READ,
          EXPERIMENT_PERMISSIONS.READ,
          EVALUATION_PERMISSIONS.READ,
          EVALUATION_PERMISSIONS.RESULTS_READ,
          SCORE_PERMISSIONS.READ,
          ANNOTATION_QUEUE_PERMISSIONS.READ,
          ANNOTATION_PERMISSIONS.READ,
          ENTITY_PERMISSIONS.READ,
          CONVERSATION_CONFIG_PERMISSIONS.READ,
          MODEL_CONFIGURATION_PERMISSIONS.READ,
        ]),
      );
      expect(roleRepository.save).toHaveBeenCalledWith([
        expect.objectContaining({ name: "Member" }),
        expect.objectContaining({ name: "Viewer" }),
      ]);
    });
  });
});
