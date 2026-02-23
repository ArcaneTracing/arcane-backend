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
import { EntitiesController } from "../../../src/entities/controllers/entities.controller";
import { EntitiesService } from "../../../src/entities/services/entities.service";
import { EntitiesYamlService } from "../../../src/entities/services/entities-yaml.service";
import {
  CreateEntityRequestDto,
  UpdateEntityRequestDto,
} from "../../../src/entities/dto/request/create-entity.dto";
import { EntityResponseDto } from "../../../src/entities/dto/response/entity-response.dto";
import { EntityMessageResponseDto } from "../../../src/entities/dto/response/entity-message-response.dto";
import {
  ERROR_MESSAGES,
  formatError,
} from "../../../src/common/constants/error-messages.constants";
import { Response } from "express";

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

describe("EntitiesController", () => {
  let controller: EntitiesController;
  let entitiesService: EntitiesService;
  let entitiesYamlService: EntitiesYamlService;

  const mockEntitiesService = {
    create: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
  };

  const mockEntitiesYamlService = {
    exportToYaml: jest.fn(),
    importFromYaml: jest.fn(),
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

  const mockEntityResponseDto: EntityResponseDto = {
    id: "entity-1",
    name: "Test Entity",
    description: "Test Description",
    type: "test-type",
    matchingAttributeName: "attribute",
    matchingPatternType: "value" as any,
    matchingPattern: null,
    matchingValue: "value",
    entityType: "model" as any,
    entityHighlights: [],
    messageMatching: null,
    iconId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [EntitiesController],
      providers: [
        {
          provide: EntitiesService,
          useValue: mockEntitiesService,
        },
        {
          provide: EntitiesYamlService,
          useValue: mockEntitiesYamlService,
        },
      ],
    }).compile();

    controller = module.get<EntitiesController>(EntitiesController);
    entitiesService = module.get<EntitiesService>(EntitiesService);
    entitiesYamlService = module.get<EntitiesYamlService>(EntitiesYamlService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("create", () => {
    it("should create an entity", async () => {
      const createDto: CreateEntityRequestDto = {
        name: "Test Entity",
        type: "test-type",
        matchingAttributeName: "attribute",
        matchingPatternType: "value" as any,
        entityType: "model" as any,
      };
      mockEntitiesService.create.mockResolvedValue(mockEntityResponseDto);

      const result = await controller.create(
        "org-1",
        createDto,
        mockUserSession,
      );

      expect(result).toEqual(mockEntityResponseDto);
      expect(entitiesService.create).toHaveBeenCalledWith(
        "org-1",
        mockUserSession.user.id,
        createDto,
      );
    });
  });

  describe("findAll", () => {
    it("should return all entities for an organisation", async () => {
      mockEntitiesService.findAll.mockResolvedValue([mockEntityResponseDto]);

      const result = await controller.findAll("org-1");

      expect(result).toEqual([mockEntityResponseDto]);
      expect(entitiesService.findAll).toHaveBeenCalledWith("org-1");
    });
  });

  describe("findOne", () => {
    it("should return an entity by id", async () => {
      mockEntitiesService.findOne.mockResolvedValue(mockEntityResponseDto);

      const result = await controller.findOne("org-1", "entity-1");

      expect(result).toEqual(mockEntityResponseDto);
      expect(entitiesService.findOne).toHaveBeenCalledWith("org-1", "entity-1");
    });
  });

  describe("update", () => {
    it("should update an entity", async () => {
      const updateDto: UpdateEntityRequestDto = {
        name: "Updated Entity",
      };
      const updatedEntity = {
        ...mockEntityResponseDto,
        name: "Updated Entity",
      };
      mockEntitiesService.update.mockResolvedValue(updatedEntity);

      const result = await controller.update(
        "org-1",
        "entity-1",
        updateDto,
        mockUserSession,
      );

      expect(result).toEqual(updatedEntity);
      expect(entitiesService.update).toHaveBeenCalledWith(
        "org-1",
        "entity-1",
        updateDto,
        mockUserSession?.user?.id,
      );
    });
  });

  describe("remove", () => {
    it("should remove an entity", async () => {
      const messageResponse: EntityMessageResponseDto = {
        message: "Entity deleted successfully",
      };
      mockEntitiesService.remove.mockResolvedValue(messageResponse);

      const result = await controller.remove(
        "org-1",
        "entity-1",
        mockUserSession,
      );

      expect(result).toEqual(messageResponse);
      expect(entitiesService.remove).toHaveBeenCalledWith(
        "org-1",
        "entity-1",
        mockUserSession?.user?.id,
      );
    });
  });

  describe("export", () => {
    it("should export entities to YAML file", async () => {
      const yamlContent = "version: 1.0\nentities: []";
      mockEntitiesYamlService.exportToYaml.mockResolvedValue(yamlContent);

      const mockResponse = {
        setHeader: jest.fn(),
        send: jest.fn(),
      } as unknown as Response;

      await controller.export("org-1", mockResponse);

      expect(entitiesYamlService.exportToYaml).toHaveBeenCalledWith("org-1");
      expect(mockResponse.setHeader).toHaveBeenCalledWith(
        "Content-Type",
        "application/x-yaml",
      );
      expect(mockResponse.setHeader).toHaveBeenCalledWith(
        "Content-Disposition",
        'attachment; filename="entities-export.yaml"',
      );
      expect(mockResponse.send).toHaveBeenCalledWith(yamlContent);
    });
  });

  describe("import", () => {
    it("should import entities from YAML file", async () => {
      const mockFile: Express.Multer.File = {
        fieldname: "file",
        originalname: "entities.yaml",
        encoding: "7bit",
        mimetype: "application/x-yaml",
        size: 100,
        buffer: Buffer.from("version: 1.0\nentities: []"),
        destination: "",
        filename: "entities.yaml",
        path: "",
        stream: null as any,
      };
      mockEntitiesYamlService.importFromYaml.mockResolvedValue([
        mockEntityResponseDto,
      ]);

      const result = await controller.import(
        "org-1",
        mockUserSession,
        mockFile,
      );

      expect(result).toEqual([mockEntityResponseDto]);
      expect(entitiesYamlService.importFromYaml).toHaveBeenCalledWith(
        "org-1",
        mockUserSession.user.id,
        "version: 1.0\nentities: []",
      );
    });

    it("should throw BadRequestException when file is missing", async () => {
      await expect(
        controller.import("org-1", mockUserSession, undefined),
      ).rejects.toThrow(BadRequestException);
      await expect(
        controller.import("org-1", mockUserSession, undefined),
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
          originalname: "entities.yaml",
          encoding: "7bit",
          mimetype: mimeType,
          size: 100,
          buffer: Buffer.from("version: 1.0\nentities: []"),
          destination: "",
          filename: "entities.yaml",
          path: "",
          stream: null as any,
        };
        mockEntitiesYamlService.importFromYaml.mockResolvedValue([
          mockEntityResponseDto,
        ]);

        const result = await controller.import(
          "org-1",
          mockUserSession,
          mockFile,
        );

        expect(result).toEqual([mockEntityResponseDto]);
      }
    });

    it("should accept valid YAML file extensions", async () => {
      const validExtensions = [".yaml", ".yml"];

      for (const ext of validExtensions) {
        const mockFile: Express.Multer.File = {
          fieldname: "file",
          originalname: `entities${ext}`,
          encoding: "7bit",
          mimetype: "application/octet-stream",
          size: 100,
          buffer: Buffer.from("version: 1.0\nentities: []"),
          destination: "",
          filename: `entities${ext}`,
          path: "",
          stream: null as any,
        };
        mockEntitiesYamlService.importFromYaml.mockResolvedValue([
          mockEntityResponseDto,
        ]);

        const result = await controller.import(
          "org-1",
          mockUserSession,
          mockFile,
        );

        expect(result).toEqual([mockEntityResponseDto]);
      }
    });

    it("should throw BadRequestException for invalid file type", async () => {
      const mockFile: Express.Multer.File = {
        fieldname: "file",
        originalname: "entities.json",
        encoding: "7bit",
        mimetype: "application/json",
        size: 100,
        buffer: Buffer.from("content"),
        destination: "",
        filename: "entities.json",
        path: "",
        stream: null as any,
      };

      await expect(
        controller.import("org-1", mockUserSession, mockFile),
      ).rejects.toThrow(BadRequestException);
      await expect(
        controller.import("org-1", mockUserSession, mockFile),
      ).rejects.toThrow(formatError(ERROR_MESSAGES.FILE_MUST_BE_YAML));
    });
  });
});
