import { Test, TestingModule } from "@nestjs/testing";
import { BadRequestException } from "@nestjs/common";
import { ConversationConfigImportValidator } from "../../../src/conversation-configuration/validators/conversation-config-import.validator";

describe("ConversationConfigImportValidator", () => {
  let validator: ConversationConfigImportValidator;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ConversationConfigImportValidator],
    }).compile();

    validator = module.get<ConversationConfigImportValidator>(
      ConversationConfigImportValidator,
    );
  });

  describe("validateItems", () => {
    it("should validate and return valid conversation configuration items", () => {
      const configsArray = [
        {
          name: "Config 1",
          stitchingAttributesName: ["attr1", "attr2"],
        },
        {
          name: "Config 2",
          description: "Description",
          stitchingAttributesName: ["attr3"],
        },
      ];

      const result = validator.validateItems(configsArray);

      expect(result).toHaveLength(2);
      expect(result[0].name).toBe("Config 1");
      expect(result[1].name).toBe("Config 2");
    });

    it("should throw BadRequestException when configs array is empty", () => {
      const configsArray: unknown[] = [];

      expect(() => validator.validateItems(configsArray)).toThrow(
        BadRequestException,
      );
      expect(() => validator.validateItems(configsArray)).toThrow(
        "YAML file contains no conversation configurations to import",
      );
    });

    it("should validate required fields", () => {
      const configsArray = [
        {
          name: "Config 1",
          stitchingAttributesName: ["attr1"],
        },
      ];

      const result = validator.validateItems(configsArray);

      expect(result[0]).toMatchObject({
        name: "Config 1",
        stitchingAttributesName: ["attr1"],
      });
    });

    it("should throw BadRequestException when config item is not an object", () => {
      const configsArray = ["not an object"];

      expect(() => validator.validateItems(configsArray)).toThrow(
        BadRequestException,
      );
      expect(() => validator.validateItems(configsArray)).toThrow(
        "Conversation configuration items must be objects",
      );
    });

    it("should throw BadRequestException when name is missing", () => {
      const configsArray = [
        {
          stitchingAttributesName: ["attr1"],
        },
      ];

      expect(() => validator.validateItems(configsArray)).toThrow(
        BadRequestException,
      );
      expect(() => validator.validateItems(configsArray)).toThrow(
        "Conversation configuration name is required",
      );
    });

    it("should throw BadRequestException when stitchingAttributesName is missing", () => {
      const configsArray = [
        {
          name: "Config 1",
        },
      ];

      expect(() => validator.validateItems(configsArray)).toThrow(
        BadRequestException,
      );
      expect(() => validator.validateItems(configsArray)).toThrow(
        "Conversation configuration stitchingAttributesName must be an array",
      );
    });

    it("should throw BadRequestException when stitchingAttributesName is not an array", () => {
      const configsArray = [
        {
          name: "Config 1",
          stitchingAttributesName: "not an array",
        },
      ];

      expect(() => validator.validateItems(configsArray)).toThrow(
        BadRequestException,
      );
      expect(() => validator.validateItems(configsArray)).toThrow(
        "Conversation configuration stitchingAttributesName must be an array",
      );
    });

    it("should handle optional description field", () => {
      const configsArray = [
        {
          name: "Config 1",
          description: "Description",
          stitchingAttributesName: ["attr1"],
        },
      ];

      const result = validator.validateItems(configsArray);

      expect(result[0].description).toBe("Description");
    });
  });
});
