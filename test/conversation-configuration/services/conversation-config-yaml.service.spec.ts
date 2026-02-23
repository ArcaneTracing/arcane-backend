import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { BadRequestException } from "@nestjs/common";
import { ConversationConfigYamlService } from "../../../src/conversation-configuration/services/conversation-config-yaml.service";
import { ConversationConfiguration } from "../../../src/conversation-configuration/entities/conversation-configuration.entity";
import { ConversationConfigImportParser } from "../../../src/conversation-configuration/validators/conversation-config-import.parser";
import { ConversationConfigImportValidator } from "../../../src/conversation-configuration/validators/conversation-config-import.validator";
import { AuditService } from "../../../src/audit/audit.service";

describe("ConversationConfigYamlService", () => {
  let service: ConversationConfigYamlService;
  let conversationConfigRepository: Repository<ConversationConfiguration>;
  let importParser: ConversationConfigImportParser;
  let importValidator: ConversationConfigImportValidator;

  const mockAuditService = { record: jest.fn().mockResolvedValue(undefined) };

  const mockConversationConfigRepository = {
    find: jest.fn(),
    save: jest.fn(),
  };

  const mockImportParser = {
    parse: jest.fn(),
    extractConfigArray: jest.fn(),
  };

  const mockImportValidator = {
    validateItems: jest.fn(),
  };

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

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ConversationConfigYamlService,
        {
          provide: getRepositoryToken(ConversationConfiguration),
          useValue: mockConversationConfigRepository,
        },
        {
          provide: ConversationConfigImportParser,
          useValue: mockImportParser,
        },
        {
          provide: ConversationConfigImportValidator,
          useValue: mockImportValidator,
        },
        { provide: AuditService, useValue: mockAuditService },
      ],
    }).compile();

    service = module.get<ConversationConfigYamlService>(
      ConversationConfigYamlService,
    );
    conversationConfigRepository = module.get<
      Repository<ConversationConfiguration>
    >(getRepositoryToken(ConversationConfiguration));
    importParser = module.get<ConversationConfigImportParser>(
      ConversationConfigImportParser,
    );
    importValidator = module.get<ConversationConfigImportValidator>(
      ConversationConfigImportValidator,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("exportToYaml", () => {
    it("should export conversation configurations to YAML format", async () => {
      mockConversationConfigRepository.find.mockResolvedValue([
        mockConversationConfig,
      ]);

      const result = await service.exportToYaml("org-1");

      expect(mockConversationConfigRepository.find).toHaveBeenCalledWith({
        where: { organisationId: "org-1" },
        order: { createdAt: "DESC" },
      });
      expect(result).toContain("version:");
      expect(result).toContain("conversationConfigurations:");
      expect(result).toContain("Test Config");
    });

    it("should export empty configurations array when no configurations exist", async () => {
      mockConversationConfigRepository.find.mockResolvedValue([]);

      const result = await service.exportToYaml("org-1");

      expect(result).toContain("conversationConfigurations: []");
    });

    it("should exclude null/undefined fields from export", async () => {
      const configWithNulls = {
        ...mockConversationConfig,
        description: null,
      };
      mockConversationConfigRepository.find.mockResolvedValue([
        configWithNulls,
      ]);

      const result = await service.exportToYaml("org-1");

      expect(result).not.toContain("description: null");
    });
  });

  describe("importFromYaml", () => {
    it("should import conversation configurations from YAML successfully", async () => {
      const yamlContent = `
version: '1.0'
conversationConfigurations:
  - name: Test Config
    stitchingAttributesName: ['attr1', 'attr2']
      `;

      const parsedYaml = {
        version: "1.0",
        conversationConfigurations: [{ name: "Test Config" }],
      };
      const configsArray = [{ name: "Test Config" }];
      const validatedConfigs = [
        {
          name: "Test Config",
          stitchingAttributesName: ["attr1", "attr2"],
        },
      ];

      mockImportParser.parse.mockReturnValue(parsedYaml);
      mockImportParser.extractConfigArray.mockReturnValue(configsArray);
      mockImportValidator.validateItems.mockReturnValue(validatedConfigs);
      mockConversationConfigRepository.save.mockResolvedValue([
        mockConversationConfig,
      ]);

      const result = await service.importFromYaml(
        "org-1",
        yamlContent,
        "user-1",
      );

      expect(mockImportParser.parse).toHaveBeenCalledWith(yamlContent);
      expect(mockImportParser.extractConfigArray).toHaveBeenCalledWith(
        parsedYaml,
      );
      expect(mockImportValidator.validateItems).toHaveBeenCalledWith(
        configsArray,
      );
      expect(mockConversationConfigRepository.save).toHaveBeenCalledWith([
        {
          ...validatedConfigs[0],
          organisationId: "org-1",
        },
      ]);
      expect(mockAuditService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "conversation_configurations.imported",
          actorId: "user-1",
          organisationId: "org-1",
          afterState: { count: 1, configIds: ["config-1"] },
          metadata: expect.objectContaining({
            organisationId: "org-1",
            importedById: "user-1",
            count: 1,
          }),
        }),
      );
      expect(result).toHaveLength(1);
    });

    it("should handle parser errors", async () => {
      const invalidYaml = "invalid: yaml: content: [";
      mockImportParser.parse.mockImplementation(() => {
        throw new BadRequestException("Failed to parse YAML");
      });

      await expect(
        service.importFromYaml("org-1", invalidYaml),
      ).rejects.toThrow(BadRequestException);
    });

    it("should handle validator errors", async () => {
      const yamlContent = "version: 1.0\nconversationConfigurations: []";
      const parsedYaml = { version: "1.0", conversationConfigurations: [] };
      mockImportParser.parse.mockReturnValue(parsedYaml);
      mockImportParser.extractConfigArray.mockReturnValue([]);
      mockImportValidator.validateItems.mockImplementation(() => {
        throw new BadRequestException(
          "YAML file contains no conversation configurations to import",
        );
      });

      await expect(
        service.importFromYaml("org-1", yamlContent),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
