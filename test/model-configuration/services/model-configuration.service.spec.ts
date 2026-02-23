import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { NotFoundException } from "@nestjs/common";
import * as crypto from "crypto";
import { ConfigService } from "@nestjs/config";
import { ModelConfigurationService } from "../../../src/model-configuration/services/model-configuration.service";
import { ModelConfigurationProviderConfigValidator } from "../../../src/model-configuration/validators/model-configuration-provider-config.validator";
import { EncryptionService } from "../../../src/common/encryption/services/encryption.service";
import { ModelConfiguration } from "../../../src/model-configuration/entities/model-configuration.entity";
import {
  CreateModelConfigurationRequestDto,
  UpdateModelConfigurationRequestDto,
} from "../../../src/model-configuration/dto/request/create-model-configuration.dto";
import { ModelConfigurationResponseDto } from "../../../src/model-configuration/dto/response/model-configuration-response.dto";
import {
  ERROR_MESSAGES,
  formatError,
} from "../../../src/common/constants/error-messages.constants";
import { AuditService } from "../../../src/audit/audit.service";

const validEncryptionKey = crypto.randomBytes(32).toString("hex");

describe("ModelConfigurationService", () => {
  let service: ModelConfigurationService;
  let modelConfigurationRepository: Repository<ModelConfiguration>;
  let providerConfigValidator: ModelConfigurationProviderConfigValidator;
  let mockAuditService: { record: jest.Mock };

  const mockModelConfigurationRepository = {
    find: jest.fn(),
    findOne: jest.fn(),
    save: jest.fn(),
    remove: jest.fn(),
    clear: jest.fn(),
  };

  const mockProviderConfigValidator = {
    validate: jest.fn(),
  };

  mockAuditService = { record: jest.fn().mockResolvedValue(undefined) };

  const mockModelConfiguration: ModelConfiguration = {
    id: "config-1",
    name: "Test Config",
    configuration: {
      adapter: "openai",
      modelName: "gpt-4",
      apiKey: "sk-test-key",
    },
    organisationId: "org-1",
    organisation: null as any,
    createdById: "user-1",
    createdAt: new Date(),
    updatedAt: new Date(),
  } as ModelConfiguration;

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
      providers: [
        ModelConfigurationService,
        {
          provide: getRepositoryToken(ModelConfiguration),
          useValue: mockModelConfigurationRepository,
        },
        {
          provide: ModelConfigurationProviderConfigValidator,
          useValue: mockProviderConfigValidator,
        },
        {
          provide: EncryptionService,
          useFactory: () => {
            const enc = new EncryptionService({
              get: () => validEncryptionKey,
            } as ConfigService);
            return enc;
          },
        },
        { provide: AuditService, useValue: mockAuditService },
      ],
    }).compile();

    service = module.get<ModelConfigurationService>(ModelConfigurationService);
    modelConfigurationRepository = module.get<Repository<ModelConfiguration>>(
      getRepositoryToken(ModelConfiguration),
    );
    providerConfigValidator =
      module.get<ModelConfigurationProviderConfigValidator>(
        ModelConfigurationProviderConfigValidator,
      );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("findAll", () => {
    it("should return all model configurations for an organisation with masked secrets", async () => {
      mockModelConfigurationRepository.find.mockResolvedValue([
        mockModelConfiguration,
      ]);

      const result = await service.findAll("org-1");

      expect(mockModelConfigurationRepository.find).toHaveBeenCalledWith({
        where: { organisationId: "org-1" },
        order: { createdAt: "DESC" },
      });
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(mockModelConfigurationResponseDto.id);
      expect(result[0].configuration.apiKey).not.toBe("sk-test-key");
    });

    it("should return empty array when no configurations exist", async () => {
      mockModelConfigurationRepository.find.mockResolvedValue([]);

      const result = await service.findAll("org-1");

      expect(result).toEqual([]);
    });
  });

  describe("findOne", () => {
    it("should return a model configuration by id and organisation", async () => {
      mockModelConfigurationRepository.findOne.mockResolvedValue(
        mockModelConfiguration,
      );

      const result = await service.findOne("org-1", "config-1");

      expect(mockModelConfigurationRepository.findOne).toHaveBeenCalledWith({
        where: { id: "config-1", organisationId: "org-1" },
      });
      expect(result.id).toBe(mockModelConfigurationResponseDto.id);
    });

    it("should throw NotFoundException when configuration not found", async () => {
      mockModelConfigurationRepository.findOne.mockResolvedValue(null);

      await expect(service.findOne("org-1", "non-existent")).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.findOne("org-1", "non-existent")).rejects.toThrow(
        formatError(
          ERROR_MESSAGES.MODEL_CONFIGURATION_NOT_FOUND,
          "non-existent",
        ),
      );
    });
  });

  describe("findOneById", () => {
    it("should return a model configuration by id only with decrypted secrets for internal use", async () => {
      mockModelConfigurationRepository.findOne.mockResolvedValue(
        mockModelConfiguration,
      );

      const result = await service.findOneById("config-1");

      expect(mockModelConfigurationRepository.findOne).toHaveBeenCalledWith({
        where: { id: "config-1" },
      });
      expect(result.id).toBe(mockModelConfigurationResponseDto.id);
      expect(result.configuration.apiKey).toBe("sk-test-key");
    });

    it("should return decrypted apiKey when stored config is encrypted", async () => {
      const enc = new EncryptionService({
        get: () => validEncryptionKey,
      } as ConfigService);
      const encryptedApiKey = enc.encrypt("sk-plain-secret");
      const storedWithEncrypted = {
        ...mockModelConfiguration,
        configuration: {
          ...mockModelConfiguration.configuration,
          apiKey: encryptedApiKey,
        },
      };
      mockModelConfigurationRepository.findOne.mockResolvedValue(
        storedWithEncrypted,
      );

      const result = await service.findOneById("config-1");

      expect(result.configuration.apiKey).toBe("sk-plain-secret");
      expect(enc.isEncrypted(result.configuration.apiKey)).toBe(false);
    });

    it("should throw NotFoundException when configuration not found", async () => {
      mockModelConfigurationRepository.findOne.mockResolvedValue(null);

      await expect(service.findOneById("non-existent")).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.findOneById("non-existent")).rejects.toThrow(
        formatError(
          ERROR_MESSAGES.MODEL_CONFIGURATION_NOT_FOUND,
          "non-existent",
        ),
      );
    });
  });

  describe("create", () => {
    it("should create a model configuration successfully with encrypted secrets", async () => {
      const createDto: CreateModelConfigurationRequestDto = {
        name: "Test Config",
        configuration: {
          adapter: "openai",
          modelName: "gpt-4",
          apiKey: "sk-test-key",
        } as any,
      };
      const savedWithEncrypted = {
        ...mockModelConfiguration,
        configuration: {
          ...createDto.configuration,
          apiKey: "encrypted-placeholder",
        },
      };
      mockModelConfigurationRepository.save.mockImplementation((entity) =>
        Promise.resolve({ ...savedWithEncrypted, ...entity }),
      );

      const result = await service.create("org-1", createDto, "user-1");

      expect(mockProviderConfigValidator.validate).toHaveBeenCalledWith(
        "openai",
        createDto.configuration.config,
      );
      const saveCall = mockModelConfigurationRepository.save.mock.calls[0][0];
      expect(saveCall.configuration.apiKey).not.toBe("sk-test-key");
      expect(saveCall.organisationId).toBe("org-1");
      expect(saveCall.createdById).toBe("user-1");
      expect(result.id).toBe(mockModelConfigurationResponseDto.id);
      expect(result.configuration.apiKey).not.toBe("sk-test-key");

      expect(mockAuditService.record).toHaveBeenCalledTimes(1);
      expect(mockAuditService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "model_configuration.created",
          actorId: "user-1",
          actorType: "user",
          resourceType: "model_configuration",
          resourceId: mockModelConfiguration.id,
          organisationId: "org-1",
          afterState: expect.objectContaining({
            id: mockModelConfiguration.id,
            name: mockModelConfiguration.name,
            organisationId: "org-1",
            createdById: "user-1",
            adapter: "openai",
          }),
          metadata: expect.objectContaining({
            creatorId: "user-1",
            organisationId: "org-1",
          }),
        }),
      );
    });
  });

  describe("update", () => {
    it("should update a model configuration successfully", async () => {
      const updateDto: UpdateModelConfigurationRequestDto = {
        name: "Updated Config",
      };
      const updatedConfig = {
        ...mockModelConfiguration,
        name: "Updated Config",
      };
      mockModelConfigurationRepository.findOne.mockResolvedValue(
        mockModelConfiguration,
      );
      mockModelConfigurationRepository.save.mockResolvedValue(updatedConfig);

      const result = await service.update("org-1", "config-1", updateDto);

      expect(mockModelConfigurationRepository.findOne).toHaveBeenCalledWith({
        where: { id: "config-1", organisationId: "org-1" },
      });
      expect(mockModelConfigurationRepository.save).toHaveBeenCalled();
      expect(result.name).toBe("Updated Config");

      expect(mockAuditService.record).toHaveBeenCalledTimes(1);
      expect(mockAuditService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "model_configuration.updated",
          resourceType: "model_configuration",
          resourceId: "config-1",
          organisationId: "org-1",
          beforeState: expect.objectContaining({
            id: "config-1",
            name: "Test Config",
            organisationId: "org-1",
            createdById: "user-1",
            adapter: "openai",
          }),
          afterState: expect.objectContaining({
            id: "config-1",
            name: "Updated Config",
            organisationId: "org-1",
            createdById: "user-1",
            adapter: "openai",
          }),
          metadata: expect.objectContaining({
            changedFields: ["name"],
            organisationId: "org-1",
          }),
        }),
      );
    });

    it("should validate configuration when updating", async () => {
      const updateDto: UpdateModelConfigurationRequestDto = {
        configuration: {
          adapter: "azure",
          modelName: "gpt-4",
          apiKey: "sk-test-key",
          config: { endpoint: "https://test.azure.com" },
        } as any,
      };
      const updatedConfig = { ...mockModelConfiguration, ...updateDto };
      mockModelConfigurationRepository.findOne.mockResolvedValue(
        mockModelConfiguration,
      );
      mockModelConfigurationRepository.save.mockResolvedValue(updatedConfig);

      await service.update("org-1", "config-1", updateDto);

      expect(mockProviderConfigValidator.validate).toHaveBeenCalledWith(
        "azure",
        updateDto.configuration.config,
      );

      expect(mockAuditService.record).toHaveBeenCalledTimes(1);
      expect(mockAuditService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "model_configuration.updated",
          resourceType: "model_configuration",
          resourceId: "config-1",
          organisationId: "org-1",
          metadata: expect.objectContaining({
            changedFields: ["configuration"],
            organisationId: "org-1",
          }),
        }),
      );
    });

    it("should throw NotFoundException when configuration not found", async () => {
      const updateDto: UpdateModelConfigurationRequestDto = {
        name: "Updated Config",
      };
      mockModelConfigurationRepository.findOne.mockResolvedValue(null);

      await expect(
        service.update("org-1", "non-existent", updateDto),
      ).rejects.toThrow(NotFoundException);
      expect(mockModelConfigurationRepository.save).not.toHaveBeenCalled();
    });

    it("should preserve existing apiKey when update sends apiKey: null (keep existing)", async () => {
      const enc = new EncryptionService({
        get: () => validEncryptionKey,
      } as ConfigService);
      const existingEncryptedApiKey = enc.encrypt("sk-plain-secret");
      const existingConfig = {
        ...mockModelConfiguration,
        configuration: {
          adapter: "openai",
          modelName: "gpt-4",
          apiKey: existingEncryptedApiKey,
        },
      };
      const updateDto: UpdateModelConfigurationRequestDto = {
        configuration: {
          adapter: "openai",
          modelName: "gpt-4-updated",
          apiKey: null as any,
        } as any,
      };
      mockModelConfigurationRepository.findOne.mockResolvedValue(
        existingConfig,
      );
      mockModelConfigurationRepository.save.mockImplementation((entity) =>
        Promise.resolve({ ...existingConfig, ...entity }),
      );

      await service.update("org-1", "config-1", updateDto);

      const saveCall = mockModelConfigurationRepository.save.mock.calls[0][0];
      expect(saveCall.configuration.apiKey).toBe(existingEncryptedApiKey);
      expect(saveCall.configuration.modelName).toBe("gpt-4-updated");
    });

    it("should preserve existing Bedrock AWS keys when update sends null (keep existing)", async () => {
      const enc = new EncryptionService({
        get: () => validEncryptionKey,
      } as ConfigService);
      const existingEncryptedAwsKey = enc.encrypt("AKIAIOSFODNN7EXAMPLE");
      const existingEncryptedAwsSecret = enc.encrypt(
        "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
      );
      const existingConfig = {
        ...mockModelConfiguration,
        configuration: {
          adapter: "bedrock",
          modelName: "claude",
          apiKey: "",
          config: {
            region: "us-east-1",
            awsAccessKeyId: existingEncryptedAwsKey,
            awsSecretAccessKey: existingEncryptedAwsSecret,
          },
        },
      };
      const updateDto: UpdateModelConfigurationRequestDto = {
        configuration: {
          adapter: "bedrock",
          modelName: "claude-v2",
          apiKey: "",
          config: {
            region: "us-east-1",
            awsAccessKeyId: null as any,
            awsSecretAccessKey: null as any,
          },
        } as any,
      };
      mockModelConfigurationRepository.findOne.mockResolvedValue(
        existingConfig,
      );
      mockModelConfigurationRepository.save.mockImplementation((entity) =>
        Promise.resolve({ ...existingConfig, ...entity }),
      );

      await service.update("org-1", "config-1", updateDto);

      const saveCall = mockModelConfigurationRepository.save.mock.calls[0][0];
      const savedConfig = saveCall.configuration.config as Record<
        string,
        unknown
      >;
      expect(savedConfig.awsAccessKeyId).toBe(existingEncryptedAwsKey);
      expect(savedConfig.awsSecretAccessKey).toBe(existingEncryptedAwsSecret);
    });
  });

  describe("remove", () => {
    it("should remove a model configuration successfully", async () => {
      const configToRemove = {
        ...mockModelConfiguration,
        name: "Test Config",
        configuration: {
          adapter: "openai",
          modelName: "gpt-4",
          apiKey: "sk-test-key",
        },
      } as ModelConfiguration;
      mockModelConfigurationRepository.findOne.mockResolvedValue(
        configToRemove,
      );
      mockModelConfigurationRepository.remove.mockResolvedValue(configToRemove);

      await service.remove("org-1", "config-1");

      expect(mockModelConfigurationRepository.findOne).toHaveBeenCalledWith({
        where: { id: "config-1", organisationId: "org-1" },
      });
      expect(mockModelConfigurationRepository.remove).toHaveBeenCalledWith(
        configToRemove,
      );

      expect(mockAuditService.record).toHaveBeenCalledTimes(1);
      expect(mockAuditService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "model_configuration.deleted",
          resourceType: "model_configuration",
          resourceId: "config-1",
          organisationId: "org-1",
          beforeState: expect.objectContaining({
            id: "config-1",
            name: "Test Config",
            organisationId: "org-1",
            createdById: "user-1",
            adapter: "openai",
          }),
          afterState: null,
          metadata: expect.objectContaining({ organisationId: "org-1" }),
        }),
      );
    });

    it("should throw NotFoundException when configuration not found", async () => {
      mockModelConfigurationRepository.findOne.mockResolvedValue(null);

      await expect(service.remove("org-1", "non-existent")).rejects.toThrow(
        NotFoundException,
      );
      expect(mockModelConfigurationRepository.remove).not.toHaveBeenCalled();
    });
  });

  describe("removeAll", () => {
    it("should remove all model configurations", async () => {
      mockModelConfigurationRepository.clear.mockResolvedValue(undefined);

      await service.removeAll();

      expect(mockModelConfigurationRepository.clear).toHaveBeenCalled();
    });
  });
});
