import { Test, TestingModule } from "@nestjs/testing";
import { BadRequestException } from "@nestjs/common";
import { EntityImportParser } from "../../../src/entities/validators/entity-import.parser";

describe("EntityImportParser", () => {
  let parser: EntityImportParser;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [EntityImportParser],
    }).compile();

    parser = module.get<EntityImportParser>(EntityImportParser);
  });

  describe("parse", () => {
    it("should parse valid YAML content", () => {
      const yamlContent = `
version: '1.0'
entities:
  - name: Test Entity
    type: test-type
      `;

      const result = parser.parse(yamlContent);

      expect(result).toBeDefined();
      expect((result as any).version).toBe("1.0");
      expect((result as any).entities).toBeDefined();
    });

    it("should throw BadRequestException for invalid YAML", () => {
      const invalidYaml = "invalid: yaml: content: [";

      expect(() => parser.parse(invalidYaml)).toThrow(BadRequestException);
      expect(() => parser.parse(invalidYaml)).toThrow(
        "Failed to parse YAML file",
      );
    });

    it("should handle empty YAML", () => {
      const emptyYaml = "";

      const result = parser.parse(emptyYaml);
      expect(result === null || result === undefined).toBe(true);
    });
  });

  describe("extractEntityArray", () => {
    it("should extract entities array from object with entities property", () => {
      const parsedYaml = {
        version: "1.0",
        entities: [{ name: "Entity 1" }, { name: "Entity 2" }],
      };

      const result = parser.extractEntityArray(parsedYaml);

      expect(result).toEqual([{ name: "Entity 1" }, { name: "Entity 2" }]);
    });

    it("should return array directly if parsed YAML is already an array", () => {
      const parsedYaml = [{ name: "Entity 1" }, { name: "Entity 2" }];

      const result = parser.extractEntityArray(parsedYaml);

      expect(result).toEqual([{ name: "Entity 1" }, { name: "Entity 2" }]);
    });

    it("should return empty array when entities property is missing", () => {
      const parsedYaml = { version: "1.0" };

      const result = parser.extractEntityArray(parsedYaml);

      expect(result).toEqual([]);
    });

    it("should throw BadRequestException when parsed YAML is not an object", () => {
      const parsedYaml = "not an object";

      expect(() => parser.extractEntityArray(parsedYaml)).toThrow(
        BadRequestException,
      );
      expect(() => parser.extractEntityArray(parsedYaml)).toThrow(
        "Invalid YAML format: expected an object",
      );
    });

    it("should throw BadRequestException when parsed YAML is null", () => {
      expect(() => parser.extractEntityArray(null)).toThrow(
        BadRequestException,
      );
    });

    it("should throw BadRequestException when entities is not an array", () => {
      const parsedYaml = {
        version: "1.0",
        entities: "not an array",
      };

      expect(() => parser.extractEntityArray(parsedYaml)).toThrow(
        BadRequestException,
      );
      expect(() => parser.extractEntityArray(parsedYaml)).toThrow(
        "Invalid YAML format: entities must be an array",
      );
    });
  });
});
