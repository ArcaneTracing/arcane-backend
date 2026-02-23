import { Test, TestingModule } from "@nestjs/testing";
import { BadRequestException } from "@nestjs/common";
import { EntityImportValidator } from "../../../src/entities/validators/entity-import.validator";

describe("EntityImportValidator", () => {
  let validator: EntityImportValidator;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [EntityImportValidator],
    }).compile();

    validator = module.get<EntityImportValidator>(EntityImportValidator);
  });

  describe("validateItems", () => {
    it("should validate and return valid entity items", () => {
      const entitiesArray = [
        {
          name: "Entity 1",
          type: "type1",
          matchingAttributeName: "attr1",
          matchingPatternType: "value",
          entityType: "model",
        },
        {
          name: "Entity 2",
          type: "type2",
          matchingAttributeName: "attr2",
          matchingPatternType: "regex",
          entityType: "tool",
        },
      ];

      const result = validator.validateItems(entitiesArray);

      expect(result).toHaveLength(2);
      expect(result[0].name).toBe("Entity 1");
      expect(result[1].name).toBe("Entity 2");
    });

    it("should throw BadRequestException when entities array is empty", () => {
      const entitiesArray: unknown[] = [];

      expect(() => validator.validateItems(entitiesArray)).toThrow(
        BadRequestException,
      );
      expect(() => validator.validateItems(entitiesArray)).toThrow(
        "YAML file contains no entities to import",
      );
    });

    it("should validate required fields", () => {
      const entitiesArray = [
        {
          name: "Entity 1",
          type: "type1",
          matchingAttributeName: "attr1",
          matchingPatternType: "value",
          entityType: "model",
        },
      ];

      const result = validator.validateItems(entitiesArray);

      expect(result[0]).toMatchObject({
        name: "Entity 1",
        type: "type1",
        matchingAttributeName: "attr1",
        matchingPatternType: "value",
        entityType: "model",
      });
    });

    it("should throw BadRequestException when entity item is not an object", () => {
      const entitiesArray = ["not an object"];

      expect(() => validator.validateItems(entitiesArray)).toThrow(
        BadRequestException,
      );
      expect(() => validator.validateItems(entitiesArray)).toThrow(
        "Entity items must be objects",
      );
    });

    it("should throw BadRequestException when name is missing", () => {
      const entitiesArray = [
        {
          type: "type1",
          matchingAttributeName: "attr1",
          matchingPatternType: "value",
          entityType: "model",
        },
      ];

      expect(() => validator.validateItems(entitiesArray)).toThrow(
        BadRequestException,
      );
      expect(() => validator.validateItems(entitiesArray)).toThrow(
        "Entity name is required",
      );
    });

    it("should throw BadRequestException when type is missing for custom entityType", () => {
      const entitiesArray = [
        {
          name: "Custom Entity",
          matchingAttributeName: "attr1",
          matchingPatternType: "value",
          matchingValue: "custom-value",
          entityType: "custom",
          iconId: "star",
          // type is missing - required for custom
        },
      ];

      expect(() => validator.validateItems(entitiesArray)).toThrow(
        BadRequestException,
      );
      expect(() => validator.validateItems(entitiesArray)).toThrow(
        "Entity type is required for custom entityType",
      );
    });

    it("should throw BadRequestException when matchingAttributeName is missing", () => {
      const entitiesArray = [
        {
          name: "Entity 1",
          type: "type1",
          matchingPatternType: "value",
          entityType: "model",
        },
      ];

      expect(() => validator.validateItems(entitiesArray)).toThrow(
        BadRequestException,
      );
      expect(() => validator.validateItems(entitiesArray)).toThrow(
        "Entity matchingAttributeName is required",
      );
    });

    it("should throw BadRequestException when matchingPatternType is missing", () => {
      const entitiesArray = [
        {
          name: "Entity 1",
          type: "type1",
          matchingAttributeName: "attr1",
          entityType: "model",
        },
      ];

      expect(() => validator.validateItems(entitiesArray)).toThrow(
        BadRequestException,
      );
      expect(() => validator.validateItems(entitiesArray)).toThrow(
        "Entity matchingPatternType is required",
      );
    });

    it("should throw BadRequestException when entityType is missing", () => {
      const entitiesArray = [
        {
          name: "Entity 1",
          type: "type1",
          matchingAttributeName: "attr1",
          matchingPatternType: "value",
        },
      ];

      expect(() => validator.validateItems(entitiesArray)).toThrow(
        BadRequestException,
      );
      expect(() => validator.validateItems(entitiesArray)).toThrow(
        "Entity entityType is required",
      );
    });

    it("should handle optional fields", () => {
      const entitiesArray = [
        {
          name: "Entity 1",
          type: "type1",
          matchingAttributeName: "attr1",
          matchingPatternType: "value",
          entityType: "model",
          description: "Description",
          matchingPattern: "pattern",
          matchingValue: "value",
          entityHighlights: [],
          messageMatching: null,
          iconId: "cloud",
        },
      ];

      const result = validator.validateItems(entitiesArray);

      expect(result[0].description).toBe("Description");
      expect(result[0].matchingPattern).toBe("pattern");
      expect(result[0].matchingValue).toBe("value");
      expect(result[0].entityHighlights).toEqual([]);
      expect(result[0].messageMatching).toBeNull();
      expect(result[0].iconId).toBe("cloud");
    });

    it("should handle CUSTOM entity type", () => {
      const entitiesArray = [
        {
          name: "Custom Entity",
          type: "custom-type",
          matchingAttributeName: "custom.attr",
          matchingPatternType: "value",
          matchingValue: "custom-value",
          entityType: "custom",
          iconId: "star",
        },
      ];

      const result = validator.validateItems(entitiesArray);

      expect(result[0].entityType).toBe("custom");
      expect(result[0].iconId).toBe("star");
      expect(result[0].messageMatching).toBeNull();
    });

    it("should set iconId to null when undefined", () => {
      const entitiesArray = [
        {
          name: "Entity 1",
          type: "type1",
          matchingAttributeName: "attr1",
          matchingPatternType: "value",
          entityType: "model",
        },
      ];

      const result = validator.validateItems(entitiesArray);

      expect(result[0].iconId).toBeNull();
    });

    it("should set messageMatching to null when undefined", () => {
      const entitiesArray = [
        {
          name: "Entity 1",
          type: "type1",
          matchingAttributeName: "attr1",
          matchingPatternType: "value",
          entityType: "model",
        },
      ];

      const result = validator.validateItems(entitiesArray);

      expect(result[0].messageMatching).toBeNull();
    });
  });
});
