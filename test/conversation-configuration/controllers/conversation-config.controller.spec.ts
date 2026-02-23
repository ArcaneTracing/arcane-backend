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
import { BadRequestException } from "@nestjs/common";
import { ConversationConfigController } from "../../../src/conversation-configuration/controllers/conversation-config.controller";
import { ConversationConfigService } from "../../../src/conversation-configuration/services/conversation-config.service";
import {
  CreateConversationConfigurationDto,
  UpdateConversationConfigurationDto,
} from "../../../src/conversation-configuration/dto/request/create-conversation-configuration.dto";
import { ConversationConfigurationResponseDto } from "../../../src/conversation-configuration/dto/response/conversation-configuration-response.dto";
import {
  ERROR_MESSAGES,
  formatError,
} from "../../../src/common/constants/error-messages.constants";
import { Response } from "express";

type UserSession = { user?: { id: string } };

describe("ConversationConfigController", () => {
  let controller: ConversationConfigController;
  let conversationConfigService: ConversationConfigService;

  const mockUserSession: UserSession = { user: { id: "user-1" } };

  const mockConversationConfigService = {
    findAll: jest.fn(),
    findById: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
    exportToYaml: jest.fn(),
    importFromYaml: jest.fn(),
  };

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
      controllers: [ConversationConfigController],
      providers: [
        {
          provide: ConversationConfigService,
          useValue: mockConversationConfigService,
        },
      ],
    }).compile();

    controller = module.get<ConversationConfigController>(
      ConversationConfigController,
    );
    conversationConfigService = module.get<ConversationConfigService>(
      ConversationConfigService,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("findAll", () => {
    it("should return all conversation configurations for an organisation", async () => {
      mockConversationConfigService.findAll.mockResolvedValue([
        mockConversationConfigResponseDto,
      ]);

      const result = await controller.findAll("org-1");

      expect(result).toEqual([mockConversationConfigResponseDto]);
      expect(conversationConfigService.findAll).toHaveBeenCalledWith("org-1");
    });
  });

  describe("create", () => {
    it("should create a conversation configuration", async () => {
      const createDto: CreateConversationConfigurationDto = {
        name: "Test Config",
        description: "Test Description",
        stitchingAttributesName: ["attr1", "attr2"],
      };
      mockConversationConfigService.create.mockResolvedValue(
        mockConversationConfigResponseDto,
      );

      const result = await controller.create(
        "org-1",
        createDto,
        mockUserSession,
      );

      expect(result).toEqual(mockConversationConfigResponseDto);
      expect(conversationConfigService.create).toHaveBeenCalledWith(
        "org-1",
        createDto,
        mockUserSession?.user?.id,
      );
    });
  });

  describe("update", () => {
    it("should update a conversation configuration", async () => {
      const updateDto: UpdateConversationConfigurationDto = {
        name: "Updated Config",
      };
      const updatedConfig = {
        ...mockConversationConfigResponseDto,
        name: "Updated Config",
      };
      mockConversationConfigService.update.mockResolvedValue(updatedConfig);

      const result = await controller.update(
        "org-1",
        "config-1",
        updateDto,
        mockUserSession,
      );

      expect(result).toEqual(updatedConfig);
      expect(conversationConfigService.update).toHaveBeenCalledWith(
        "org-1",
        "config-1",
        updateDto,
        mockUserSession?.user?.id,
      );
    });
  });

  describe("remove", () => {
    it("should remove a conversation configuration", async () => {
      mockConversationConfigService.remove.mockResolvedValue(undefined);

      await controller.remove("org-1", "config-1", mockUserSession);

      expect(conversationConfigService.remove).toHaveBeenCalledWith(
        "org-1",
        "config-1",
        mockUserSession?.user?.id,
      );
    });
  });

  describe("export", () => {
    it("should export conversation configurations to YAML file", async () => {
      const yamlContent = "version: 1.0\nconversationConfigurations: []";
      mockConversationConfigService.exportToYaml.mockResolvedValue(yamlContent);

      const mockResponse = {
        setHeader: jest.fn(),
        send: jest.fn(),
      } as unknown as Response;

      await controller.export("org-1", mockResponse);

      expect(conversationConfigService.exportToYaml).toHaveBeenCalledWith(
        "org-1",
      );
      expect(mockResponse.setHeader).toHaveBeenCalledWith(
        "Content-Type",
        "application/x-yaml",
      );
      expect(mockResponse.setHeader).toHaveBeenCalledWith(
        "Content-Disposition",
        'attachment; filename="conversation-configurations-export.yaml"',
      );
      expect(mockResponse.send).toHaveBeenCalledWith(yamlContent);
    });
  });

  describe("import", () => {
    it("should import conversation configurations from YAML file", async () => {
      const mockFile: Express.Multer.File = {
        fieldname: "file",
        originalname: "configs.yaml",
        encoding: "7bit",
        mimetype: "application/x-yaml",
        size: 100,
        buffer: Buffer.from("version: 1.0\nconversationConfigurations: []"),
        destination: "",
        filename: "configs.yaml",
        path: "",
        stream: null as any,
      };
      mockConversationConfigService.importFromYaml.mockResolvedValue([
        mockConversationConfigResponseDto,
      ]);

      const result = await controller.import(
        "org-1",
        mockFile,
        mockUserSession,
      );

      expect(result).toEqual([mockConversationConfigResponseDto]);
      expect(conversationConfigService.importFromYaml).toHaveBeenCalledWith(
        "org-1",
        "version: 1.0\nconversationConfigurations: []",
        mockUserSession?.user?.id,
      );
    });

    it("should throw BadRequestException when file is missing", async () => {
      await expect(
        controller.import("org-1", undefined, mockUserSession),
      ).rejects.toThrow(BadRequestException);
      await expect(
        controller.import("org-1", undefined, mockUserSession),
      ).rejects.toThrow(formatError(ERROR_MESSAGES.YAML_FILE_REQUIRED));
    });

    it("should accept valid YAML mime types", async () => {
      const validMimeTypes = [
        "application/x-yaml",
        "text/yaml",
        "text/plain",
        "application/yaml",
      ];

      for (const mimeType of validMimeTypes) {
        const mockFile: Express.Multer.File = {
          fieldname: "file",
          originalname: "configs.yaml",
          encoding: "7bit",
          mimetype: mimeType,
          size: 100,
          buffer: Buffer.from("version: 1.0\nconversationConfigurations: []"),
          destination: "",
          filename: "configs.yaml",
          path: "",
          stream: null as any,
        };
        mockConversationConfigService.importFromYaml.mockResolvedValue([
          mockConversationConfigResponseDto,
        ]);

        const result = await controller.import(
          "org-1",
          mockFile,
          mockUserSession,
        );

        expect(result).toEqual([mockConversationConfigResponseDto]);
      }
    });

    it("should accept valid YAML file extensions", async () => {
      const validExtensions = [".yaml", ".yml"];

      for (const ext of validExtensions) {
        const mockFile: Express.Multer.File = {
          fieldname: "file",
          originalname: `configs${ext}`,
          encoding: "7bit",
          mimetype: "application/octet-stream",
          size: 100,
          buffer: Buffer.from("version: 1.0\nconversationConfigurations: []"),
          destination: "",
          filename: `configs${ext}`,
          path: "",
          stream: null as any,
        };
        mockConversationConfigService.importFromYaml.mockResolvedValue([
          mockConversationConfigResponseDto,
        ]);

        const result = await controller.import(
          "org-1",
          mockFile,
          mockUserSession,
        );

        expect(result).toEqual([mockConversationConfigResponseDto]);
      }
    });

    it("should throw BadRequestException for invalid file type", async () => {
      const mockFile: Express.Multer.File = {
        fieldname: "file",
        originalname: "configs.json",
        encoding: "7bit",
        mimetype: "application/json",
        size: 100,
        buffer: Buffer.from("content"),
        destination: "",
        filename: "configs.json",
        path: "",
        stream: null as any,
      };

      await expect(
        controller.import("org-1", mockFile, mockUserSession),
      ).rejects.toThrow(BadRequestException);
      await expect(
        controller.import("org-1", mockFile, mockUserSession),
      ).rejects.toThrow(formatError(ERROR_MESSAGES.FILE_MUST_BE_YAML));
    });
  });
});
