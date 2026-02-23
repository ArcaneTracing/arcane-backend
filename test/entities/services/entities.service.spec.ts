import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { NotFoundException } from "@nestjs/common";
import { EntitiesService } from "../../../src/entities/services/entities.service";
import {
  Entity,
  MatchPatternType,
  EntityType,
} from "../../../src/entities/entities/entity.entity";
import {
  CreateEntityRequestDto,
  UpdateEntityRequestDto,
} from "../../../src/entities/dto/request/create-entity.dto";
import { EntityResponseDto } from "../../../src/entities/dto/response/entity-response.dto";
import {
  ERROR_MESSAGES,
  formatError,
} from "../../../src/common/constants/error-messages.constants";
import { AuditService } from "../../../src/audit/audit.service";

describe("EntitiesService", () => {
  let service: EntitiesService;
  let entityRepository: Repository<Entity>;
  let mockAuditService: { record: jest.Mock };

  const mockEntityRepository = {
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    remove: jest.fn(),
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

  const createMockEntityResponseDto = (entity: Entity): EntityResponseDto => ({
    id: entity.id,
    name: entity.name,
    description: entity.description,
    type: entity.type,
    matchingAttributeName: entity.matchingAttributeName,
    matchingPatternType: entity.matchingPatternType,
    matchingPattern: entity.matchingPattern,
    matchingValue: entity.matchingValue,
    entityType: entity.entityType,
    entityHighlights: entity.entityHighlights,
    messageMatching: entity.messageMatching ?? null,
    iconId: entity.iconId ?? null,
    externalId: entity.externalId ?? null,
    createdAt: entity.createdAt,
    updatedAt: entity.updatedAt,
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EntitiesService,
        {
          provide: getRepositoryToken(Entity),
          useValue: mockEntityRepository,
        },
        { provide: AuditService, useValue: mockAuditService },
      ],
    }).compile();

    service = module.get<EntitiesService>(EntitiesService);
    entityRepository = module.get<Repository<Entity>>(
      getRepositoryToken(Entity),
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("create", () => {
    it("should create an entity successfully", async () => {
      const createDto: CreateEntityRequestDto = {
        name: "Test Entity",
        description: "Test Description",
        type: "test-type",
        matchingAttributeName: "attribute",
        matchingPatternType: MatchPatternType.VALUE,
        matchingValue: "value",
        entityType: EntityType.MODEL,
      };
      mockEntityRepository.create.mockReturnValue(mockEntity);
      mockEntityRepository.save.mockResolvedValue(mockEntity);

      const result = await service.create("org-1", "user-1", createDto);

      expect(mockEntityRepository.create).toHaveBeenCalledWith({
        ...createDto,
        organisationId: "org-1",
        createdById: "user-1",
      });
      expect(mockEntityRepository.save).toHaveBeenCalled();
      expect(result).toEqual(createMockEntityResponseDto(mockEntity));

      expect(mockAuditService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "entity.created",
          actorId: "user-1",
          actorType: "user",
          resourceType: "entity",
          resourceId: mockEntity.id,
          organisationId: "org-1",
          afterState: expect.objectContaining({
            id: mockEntity.id,
            name: mockEntity.name,
            type: mockEntity.type,
            entityType: mockEntity.entityType,
            iconId: null,
            organisationId: "org-1",
            createdById: "user-1",
          }),
          metadata: expect.objectContaining({
            creatorId: "user-1",
            organisationId: "org-1",
          }),
        }),
      );
    });

    it("should create a CUSTOM entity with iconId successfully", async () => {
      const createDto: CreateEntityRequestDto = {
        name: "Custom Entity",
        description: "Custom Description",
        type: "custom-type",
        matchingAttributeName: "custom.attribute",
        matchingPatternType: MatchPatternType.VALUE,
        matchingValue: "custom-value",
        entityType: EntityType.CUSTOM,
        iconId: "cloud",
      };
      const customEntity = {
        ...mockEntity,
        name: "Custom Entity",
        description: "Custom Description",
        type: "custom-type",
        matchingAttributeName: "custom.attribute",
        matchingValue: "custom-value",
        entityType: EntityType.CUSTOM,
        iconId: "cloud",
        messageMatching: null,
      };
      mockEntityRepository.create.mockReturnValue(customEntity);
      mockEntityRepository.save.mockResolvedValue(customEntity);

      const result = await service.create("org-1", "user-1", createDto);

      expect(mockEntityRepository.create).toHaveBeenCalledWith({
        ...createDto,
        organisationId: "org-1",
        createdById: "user-1",
      });
      expect(result.iconId).toBe("cloud");
      expect(result.entityType).toBe(EntityType.CUSTOM);
    });
  });

  describe("findOne", () => {
    it("should return an entity by id", async () => {
      mockEntityRepository.findOne.mockResolvedValue(mockEntity);

      const result = await service.findOne("org-1", "entity-1");

      expect(mockEntityRepository.findOne).toHaveBeenCalledWith({
        where: { id: "entity-1", organisationId: "org-1" },
      });
      expect(result).toEqual(createMockEntityResponseDto(mockEntity));
    });

    it("should throw NotFoundException when entity not found", async () => {
      mockEntityRepository.findOne.mockResolvedValue(null);

      await expect(service.findOne("org-1", "non-existent")).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.findOne("org-1", "non-existent")).rejects.toThrow(
        formatError(ERROR_MESSAGES.ENTITY_NOT_FOUND, "non-existent"),
      );
    });
  });

  describe("findAll", () => {
    it("should return all entities for an organisation", async () => {
      mockEntityRepository.find.mockResolvedValue([mockEntity]);

      const result = await service.findAll("org-1");

      expect(mockEntityRepository.find).toHaveBeenCalledWith({
        where: { organisationId: "org-1" },
        order: { createdAt: "DESC" },
      });
      expect(result).toEqual([createMockEntityResponseDto(mockEntity)]);
    });

    it("should return empty array when no entities exist", async () => {
      mockEntityRepository.find.mockResolvedValue([]);

      const result = await service.findAll("org-1");

      expect(result).toEqual([]);
    });
  });

  describe("update", () => {
    it("should update an entity successfully", async () => {
      const updateDto: UpdateEntityRequestDto = {
        name: "Updated Entity",
      };
      const updatedEntity = { ...mockEntity, name: "Updated Entity" };
      mockEntityRepository.findOne.mockResolvedValue(mockEntity);
      mockEntityRepository.save.mockResolvedValue(updatedEntity);

      const result = await service.update(
        "org-1",
        "entity-1",
        updateDto,
        "user-1",
      );

      expect(mockEntityRepository.findOne).toHaveBeenCalledWith({
        where: { id: "entity-1", organisationId: "org-1" },
      });
      expect(mockEntityRepository.save).toHaveBeenCalledWith({
        ...mockEntity,
        name: "Updated Entity",
      });
      expect(result.name).toBe("Updated Entity");

      expect(mockAuditService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "entity.updated",
          actorId: "user-1",
          resourceType: "entity",
          resourceId: "entity-1",
          organisationId: "org-1",
          beforeState: expect.objectContaining({
            id: "entity-1",
            name: "Test Entity",
          }),
          afterState: expect.objectContaining({
            id: "entity-1",
            name: "Updated Entity",
          }),
          metadata: expect.objectContaining({
            changedFields: ["name"],
            organisationId: "org-1",
          }),
        }),
      );
    });

    it("should throw NotFoundException when entity not found", async () => {
      const updateDto: UpdateEntityRequestDto = {
        name: "Updated Entity",
      };
      mockEntityRepository.findOne.mockResolvedValue(null);

      await expect(
        service.update("org-1", "non-existent", updateDto, "user-1"),
      ).rejects.toThrow(NotFoundException);
      expect(mockEntityRepository.save).not.toHaveBeenCalled();
    });
  });

  describe("remove", () => {
    it("should remove an entity successfully", async () => {
      const entityToRemove = {
        ...mockEntity,
        name: "Test Entity",
        description: "Test Description",
      } as Entity;
      mockEntityRepository.findOne.mockResolvedValue(entityToRemove);
      mockEntityRepository.remove.mockResolvedValue(entityToRemove);

      const result = await service.remove("org-1", "entity-1", "user-1");

      expect(mockEntityRepository.findOne).toHaveBeenCalledWith({
        where: { id: "entity-1", organisationId: "org-1" },
      });
      expect(mockEntityRepository.remove).toHaveBeenCalledWith(entityToRemove);
      expect(result).toEqual({ message: "Entity deleted successfully" });

      expect(mockAuditService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "entity.deleted",
          actorId: "user-1",
          resourceType: "entity",
          resourceId: "entity-1",
          organisationId: "org-1",
          beforeState: expect.objectContaining({
            id: "entity-1",
            name: "Test Entity",
          }),
          afterState: null,
          metadata: expect.objectContaining({ organisationId: "org-1" }),
        }),
      );
    });

    it("should throw NotFoundException when entity not found", async () => {
      mockEntityRepository.findOne.mockResolvedValue(null);

      await expect(service.remove("org-1", "non-existent")).rejects.toThrow(
        NotFoundException,
      );
      expect(mockEntityRepository.remove).not.toHaveBeenCalled();
    });
  });
});
