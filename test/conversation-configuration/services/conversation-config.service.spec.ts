import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { NotFoundException } from "@nestjs/common";
import { ConversationConfigService } from "../../../src/conversation-configuration/services/conversation-config.service";
import { ConversationConfigYamlService } from "../../../src/conversation-configuration/services/conversation-config-yaml.service";
import { ConversationConfiguration } from "../../../src/conversation-configuration/entities/conversation-configuration.entity";
import {
  CreateConversationConfigurationDto,
  UpdateConversationConfigurationDto,
} from "../../../src/conversation-configuration/dto/request/create-conversation-configuration.dto";
import { ConversationConfigurationResponseDto } from "../../../src/conversation-configuration/dto/response/conversation-configuration-response.dto";
import { AuditService } from "../../../src/audit/audit.service";

describe("ConversationConfigService", () => {
  let service: ConversationConfigService;
  let conversationConfigRepository: Repository<ConversationConfiguration>;
  let conversationConfigYamlService: ConversationConfigYamlService;
  let mockAuditService: { record: jest.Mock };

  const mockConversationConfigRepository = {
    find: jest.fn(),
    findOne: jest.fn(),
    save: jest.fn(),
    remove: jest.fn(),
  };

  const mockConversationConfigYamlService = {
    exportToYaml: jest.fn(),
    importFromYaml: jest.fn(),
  };

  mockAuditService = { record: jest.fn().mockResolvedValue(undefined) };

  const mockConversationConfig: ConversationConfiguration = {
    id: "config-1",
    name: "Test Config",
    description: "Test Description",
    stitchingAttributesName: ["attr1", "attr2"],
    organisationId: "org-1",
    organisation: null as any,
    createdAt: new Date(),
    updatedAt: new Date(),
  } as ConversationConfiguration;

  const mockConversationConfigResponseDto: ConversationConfigurationResponseDto =
    {
      id: "config-1",
      name: "Test Config",
      description: "Test Description",
      stitchingAttributesName: ["attr1", "attr2"],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ConversationConfigService,
        {
          provide: getRepositoryToken(ConversationConfiguration),
          useValue: mockConversationConfigRepository,
        },
        {
          provide: ConversationConfigYamlService,
          useValue: mockConversationConfigYamlService,
        },
        { provide: AuditService, useValue: mockAuditService },
      ],
    }).compile();

    service = module.get<ConversationConfigService>(ConversationConfigService);
    conversationConfigRepository = module.get<
      Repository<ConversationConfiguration>
    >(getRepositoryToken(ConversationConfiguration));
    conversationConfigYamlService = module.get<ConversationConfigYamlService>(
      ConversationConfigYamlService,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("findAll", () => {
    it("should return all conversation configurations for an organisation", async () => {
      mockConversationConfigRepository.find.mockResolvedValue([
        mockConversationConfig,
      ]);

      const result = await service.findAll("org-1");

      expect(mockConversationConfigRepository.find).toHaveBeenCalledWith({
        where: { organisationId: "org-1" },
        order: { createdAt: "DESC" },
      });
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(mockConversationConfigResponseDto.id);
    });

    it("should return empty array when no configurations exist", async () => {
      mockConversationConfigRepository.find.mockResolvedValue([]);

      const result = await service.findAll("org-1");

      expect(result).toEqual([]);
    });
  });

  describe("findById", () => {
    it("should return a conversation configuration by id", async () => {
      mockConversationConfigRepository.findOne.mockResolvedValue(
        mockConversationConfig,
      );

      const result = await service.findById("org-1", "config-1");

      expect(mockConversationConfigRepository.findOne).toHaveBeenCalledWith({
        where: { id: "config-1", organisationId: "org-1" },
      });
      expect(result).toEqual(mockConversationConfig);
    });

    it("should return null when configuration not found", async () => {
      mockConversationConfigRepository.findOne.mockResolvedValue(null);

      const result = await service.findById("org-1", "non-existent");

      expect(result).toBeNull();
    });
  });

  describe("create", () => {
    it("should create a conversation configuration successfully", async () => {
      const createDto: CreateConversationConfigurationDto = {
        name: "Test Config",
        description: "Test Description",
        stitchingAttributesName: ["attr1", "attr2"],
      };
      mockConversationConfigRepository.save.mockResolvedValue(
        mockConversationConfig,
      );

      const result = await service.create("org-1", createDto, "user-1");

      expect(mockConversationConfigRepository.save).toHaveBeenCalledWith({
        ...createDto,
        organisationId: "org-1",
      });
      expect(result.id).toBe(mockConversationConfigResponseDto.id);
      expect(result.name).toBe(mockConversationConfigResponseDto.name);

      expect(mockAuditService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "conversation_configuration.created",
          actorId: "user-1",
          actorType: "user",
          resourceType: "conversation_configuration",
          resourceId: mockConversationConfig.id,
          organisationId: "org-1",
          afterState: expect.objectContaining({
            id: mockConversationConfig.id,
            name: mockConversationConfig.name,
            organisationId: "org-1",
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
    it("should update a conversation configuration successfully", async () => {
      const updateDto: UpdateConversationConfigurationDto = {
        name: "Updated Config",
      };
      const updatedConfig = {
        ...mockConversationConfig,
        name: "Updated Config",
      };
      mockConversationConfigRepository.findOne.mockResolvedValue(
        mockConversationConfig,
      );
      mockConversationConfigRepository.save.mockResolvedValue(updatedConfig);

      const result = await service.update(
        "org-1",
        "config-1",
        updateDto,
        "user-1",
      );

      expect(mockConversationConfigRepository.findOne).toHaveBeenCalledWith({
        where: { id: "config-1", organisationId: "org-1" },
      });
      expect(mockConversationConfigRepository.save).toHaveBeenCalled();
      expect(result.name).toBe("Updated Config");

      expect(mockAuditService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "conversation_configuration.updated",
          actorId: "user-1",
          resourceType: "conversation_configuration",
          resourceId: "config-1",
          organisationId: "org-1",
          beforeState: expect.objectContaining({
            id: "config-1",
            name: "Test Config",
          }),
          afterState: expect.objectContaining({
            id: "config-1",
            name: "Updated Config",
          }),
          metadata: expect.objectContaining({
            changedFields: ["name"],
            organisationId: "org-1",
          }),
        }),
      );
    });

    it("should throw NotFoundException when configuration not found", async () => {
      const updateDto: UpdateConversationConfigurationDto = {
        name: "Updated Config",
      };
      mockConversationConfigRepository.findOne.mockResolvedValue(null);

      await expect(
        service.update("org-1", "non-existent", updateDto, "user-1"),
      ).rejects.toThrow(NotFoundException);
      expect(mockConversationConfigRepository.save).not.toHaveBeenCalled();
    });
  });

  describe("remove", () => {
    it("should remove a conversation configuration successfully", async () => {
      const configToRemove = {
        ...mockConversationConfig,
        name: "Test Config",
        description: "Test Description",
        stitchingAttributesName: ["attr1", "attr2"],
      } as ConversationConfiguration;
      mockConversationConfigRepository.findOne.mockResolvedValue(
        configToRemove,
      );
      mockConversationConfigRepository.remove.mockResolvedValue(configToRemove);

      await service.remove("org-1", "config-1", "user-1");

      expect(mockConversationConfigRepository.findOne).toHaveBeenCalledWith({
        where: { id: "config-1", organisationId: "org-1" },
      });
      expect(mockConversationConfigRepository.remove).toHaveBeenCalledWith(
        configToRemove,
      );

      expect(mockAuditService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "conversation_configuration.deleted",
          actorId: "user-1",
          resourceType: "conversation_configuration",
          resourceId: "config-1",
          organisationId: "org-1",
          beforeState: expect.objectContaining({
            id: "config-1",
            name: "Test Config",
          }),
          afterState: null,
          metadata: expect.objectContaining({ organisationId: "org-1" }),
        }),
      );
    });

    it("should throw NotFoundException when configuration not found", async () => {
      mockConversationConfigRepository.findOne.mockResolvedValue(null);

      await expect(service.remove("org-1", "non-existent")).rejects.toThrow(
        NotFoundException,
      );
      expect(mockConversationConfigRepository.remove).not.toHaveBeenCalled();
    });
  });

  describe("exportToYaml", () => {
    it("should delegate to yaml service", async () => {
      const yamlContent = "version: 1.0\nconversationConfigurations: []";
      mockConversationConfigYamlService.exportToYaml.mockResolvedValue(
        yamlContent,
      );

      const result = await service.exportToYaml("org-1");

      expect(
        mockConversationConfigYamlService.exportToYaml,
      ).toHaveBeenCalledWith("org-1");
      expect(result).toBe(yamlContent);
    });
  });

  describe("importFromYaml", () => {
    it("should delegate to yaml service", async () => {
      const yamlContent = "version: 1.0\nconversationConfigurations: []";
      const importedConfigs = [mockConversationConfigResponseDto];
      mockConversationConfigYamlService.importFromYaml.mockResolvedValue(
        importedConfigs,
      );

      const result = await service.importFromYaml(
        "org-1",
        yamlContent,
        "user-1",
      );

      expect(
        mockConversationConfigYamlService.importFromYaml,
      ).toHaveBeenCalledWith("org-1", yamlContent, "user-1");
      expect(result).toEqual(importedConfigs);
    });
  });
});
