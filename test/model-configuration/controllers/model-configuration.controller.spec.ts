jest.mock("@thallesp/nestjs-better-auth", () => ({
  Session:
    () => (target: any, propertyKey: string, parameterIndex: number) => {},
  UserSession: class UserSession {},
}));

jest.mock("../../../src/rbac/guards/org-permission.guard", () => ({
  OrgPermissionGuard: jest.fn(() => ({
    canActivate: jest.fn(() => true),
  })),
}));

import { Test, TestingModule } from "@nestjs/testing";
import { ModelConfigurationController } from "../../../src/model-configuration/controllers/model-configuration.controller";
import { ModelConfigurationService } from "../../../src/model-configuration/services/model-configuration.service";
import {
  CreateModelConfigurationRequestDto,
  UpdateModelConfigurationRequestDto,
} from "../../../src/model-configuration/dto/request/create-model-configuration.dto";
import { ModelConfigurationResponseDto } from "../../../src/model-configuration/dto/response/model-configuration-response.dto";

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

describe("ModelConfigurationController", () => {
  let controller: ModelConfigurationController;
  let modelConfigurationService: ModelConfigurationService;

  const mockModelConfigurationService = {
    findAll: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
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

  const mockModelConfigurationResponseDto: ModelConfigurationResponseDto = {
    id: "config-1",
    name: "Test Config",
    configuration: {
      adapter: "openai",
      modelName: "gpt-4",
      apiKey: "sk-test-key",
    } as any,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ModelConfigurationController],
      providers: [
        {
          provide: ModelConfigurationService,
          useValue: mockModelConfigurationService,
        },
      ],
    }).compile();

    controller = module.get<ModelConfigurationController>(
      ModelConfigurationController,
    );
    modelConfigurationService = module.get<ModelConfigurationService>(
      ModelConfigurationService,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("findAll", () => {
    it("should return all model configurations for an organisation", async () => {
      mockModelConfigurationService.findAll.mockResolvedValue([
        mockModelConfigurationResponseDto,
      ]);

      const result = await controller.findAll("org-1");

      expect(result).toEqual([mockModelConfigurationResponseDto]);
      expect(modelConfigurationService.findAll).toHaveBeenCalledWith("org-1");
    });
  });

  describe("findOne", () => {
    it("should return a model configuration by id", async () => {
      mockModelConfigurationService.findOne.mockResolvedValue(
        mockModelConfigurationResponseDto,
      );

      const result = await controller.findOne("org-1", "config-1");

      expect(result).toEqual(mockModelConfigurationResponseDto);
      expect(modelConfigurationService.findOne).toHaveBeenCalledWith(
        "org-1",
        "config-1",
      );
    });
  });

  describe("create", () => {
    it("should create a model configuration", async () => {
      const createDto: CreateModelConfigurationRequestDto = {
        name: "Test Config",
        configuration: {
          adapter: "openai",
          modelName: "gpt-4",
          apiKey: "sk-test-key",
        } as any,
      };
      mockModelConfigurationService.create.mockResolvedValue(
        mockModelConfigurationResponseDto,
      );

      const result = await controller.create(
        "org-1",
        createDto,
        mockUserSession,
      );

      expect(result).toEqual(mockModelConfigurationResponseDto);
      expect(modelConfigurationService.create).toHaveBeenCalledWith(
        "org-1",
        createDto,
        mockUserSession.user.id,
      );
    });
  });

  describe("update", () => {
    it("should update a model configuration", async () => {
      const updateDto: UpdateModelConfigurationRequestDto = {
        name: "Updated Config",
      };
      const updatedConfig = {
        ...mockModelConfigurationResponseDto,
        name: "Updated Config",
      };
      mockModelConfigurationService.update.mockResolvedValue(updatedConfig);

      const result = await controller.update(
        "org-1",
        "config-1",
        updateDto,
        mockUserSession,
      );

      expect(result).toEqual(updatedConfig);
      expect(modelConfigurationService.update).toHaveBeenCalledWith(
        "org-1",
        "config-1",
        updateDto,
        mockUserSession?.user?.id,
      );
    });
  });

  describe("remove", () => {
    it("should remove a model configuration", async () => {
      mockModelConfigurationService.remove.mockResolvedValue(undefined);

      await controller.remove("org-1", "config-1", mockUserSession);

      expect(modelConfigurationService.remove).toHaveBeenCalledWith(
        "org-1",
        "config-1",
        mockUserSession?.user?.id,
      );
    });
  });
});
