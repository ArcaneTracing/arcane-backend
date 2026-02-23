import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { BadRequestException } from "@nestjs/common";
import { EntitiesYamlService } from "../../../src/entities/services/entities-yaml.service";
import {
  Entity,
  MatchPatternType,
  EntityType,
} from "../../../src/entities/entities/entity.entity";
import { EntityImportParser } from "../../../src/entities/validators/entity-import.parser";
import { EntityImportValidator } from "../../../src/entities/validators/entity-import.validator";
import { AuditService } from "../../../src/audit/audit.service";

describe("EntitiesYamlService", () => {
  let service: EntitiesYamlService;
  let entityRepository: Repository<Entity>;
  let importParser: EntityImportParser;
  let importValidator: EntityImportValidator;
  let mockAuditService: { record: jest.Mock };

  const mockEntityRepository = {
    find: jest.fn(),
    manager: {
      transaction: jest.fn(),
      getRepository: jest.fn(),
    },
  };

  const mockImportParser = {
    parse: jest.fn(),
    extractEntityArray: jest.fn(),
  };

  const mockImportValidator = {
    validateItems: jest.fn(),
  };

  mockAuditService = { record: jest.fn().mockResolvedValue(undefined) };

  const mockEntity: Entity = {
    id: "entity-1",
    name: "Test Entity",
    description: "Test Description",
    type: "test-type",
    matchingAttributeName: "attribute",
    matchingPatternType: MatchPatternType.VALUE,
    matchingPattern: null,
    matchingValue: "value",
    entityType: EntityType.MODEL,
    entityHighlights: [],
    messageMatching: null,
    iconId: null,
    createdById: "user-1",
    organisationId: "org-1",
    organisation: null as any,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EntitiesYamlService,
        {
          provide: getRepositoryToken(Entity),
          useValue: mockEntityRepository,
        },
        {
          provide: EntityImportParser,
          useValue: mockImportParser,
        },
        {
          provide: EntityImportValidator,
          useValue: mockImportValidator,
        },
        { provide: AuditService, useValue: mockAuditService },
      ],
    }).compile();

    service = module.get<EntitiesYamlService>(EntitiesYamlService);
    entityRepository = module.get<Repository<Entity>>(
      getRepositoryToken(Entity),
    );
    importParser = module.get<EntityImportParser>(EntityImportParser);
    importValidator = module.get<EntityImportValidator>(EntityImportValidator);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("exportToYaml", () => {
    it("should export entities to YAML format", async () => {
      mockEntityRepository.find.mockResolvedValue([mockEntity]);

      const result = await service.exportToYaml("org-1");

      expect(mockEntityRepository.find).toHaveBeenCalledWith({
        where: { organisationId: "org-1" },
        order: { createdAt: "DESC" },
      });
      expect(result).toContain("version:");
      expect(result).toContain("entities:");
      expect(result).toContain("Test Entity");
    });

    it("should export empty entities array when no entities exist", async () => {
      mockEntityRepository.find.mockResolvedValue([]);

      const result = await service.exportToYaml("org-1");

      expect(result).toContain("entities: []");
    });

    it("should exclude null/undefined fields from export", async () => {
      const entityWithNulls = {
        ...mockEntity,
        description: null,
        matchingPattern: undefined,
      };
      mockEntityRepository.find.mockResolvedValue([entityWithNulls]);

      const result = await service.exportToYaml("org-1");

      expect(result).not.toContain("description: null");
      expect(result).not.toContain("matchingPattern:");
    });
  });

  describe("importFromYaml", () => {
    it("should import entities from YAML successfully", async () => {
      const yamlContent = `
version: '1.0'
entities:
  - name: Test Entity
    type: test-type
    matchingAttributeName: attribute
    matchingPatternType: value
    matchingValue: value
    entityType: model
      `;

      const parsedYaml = {
        version: "1.0",
        entities: [{ name: "Test Entity" }],
      };
      const entitiesArray = [{ name: "Test Entity" }];
      const validatedEntities = [
        {
          name: "Test Entity",
          type: "test-type",
          matchingAttributeName: "attribute",
          matchingPatternType: "value",
          matchingValue: "value",
          entityType: "model",
        },
      ];

      mockImportParser.parse.mockReturnValue(parsedYaml);
      mockImportParser.extractEntityArray.mockReturnValue(entitiesArray);
      mockImportValidator.validateItems.mockReturnValue(validatedEntities);

      const mockEntityRepo = {
        create: jest.fn().mockReturnValue(mockEntity),
        save: jest.fn().mockResolvedValue(mockEntity),
      };

      mockEntityRepository.manager.transaction.mockImplementation(
        async (callback) => {
          const manager = {
            ...mockEntityRepository.manager,
            getRepository: jest.fn().mockReturnValue(mockEntityRepo),
          };
          return callback(manager);
        },
      );

      const result = await service.importFromYaml(
        "org-1",
        "user-1",
        yamlContent,
      );

      expect(mockImportParser.parse).toHaveBeenCalledWith(yamlContent);
      expect(mockImportParser.extractEntityArray).toHaveBeenCalledWith(
        parsedYaml,
      );
      expect(mockImportValidator.validateItems).toHaveBeenCalledWith(
        entitiesArray,
      );
      expect(mockEntityRepo.create).toHaveBeenCalled();
      expect(mockEntityRepo.save).toHaveBeenCalled();
      expect(result).toHaveLength(1);

      expect(mockAuditService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "entities.imported",
          actorId: "user-1",
          actorType: "user",
          resourceType: "entity",
          resourceId: "org-1",
          organisationId: "org-1",
          afterState: expect.objectContaining({
            count: 1,
            entityIds: ["entity-1"],
          }),
          metadata: expect.objectContaining({
            organisationId: "org-1",
            importedById: "user-1",
            count: 1,
          }),
        }),
      );
    });

    it("should handle parser errors", async () => {
      const invalidYaml = "invalid: yaml: content: [";
      mockImportParser.parse.mockImplementation(() => {
        throw new BadRequestException("Failed to parse YAML");
      });

      await expect(
        service.importFromYaml("org-1", "user-1", invalidYaml),
      ).rejects.toThrow(BadRequestException);
    });

    it("should handle validator errors", async () => {
      const yamlContent = "version: 1.0\nentities: []";
      const parsedYaml = { version: "1.0", entities: [] };
      mockImportParser.parse.mockReturnValue(parsedYaml);
      mockImportParser.extractEntityArray.mockReturnValue([]);
      mockImportValidator.validateItems.mockImplementation(() => {
        throw new BadRequestException(
          "YAML file contains no entities to import",
        );
      });

      await expect(
        service.importFromYaml("org-1", "user-1", yamlContent),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
