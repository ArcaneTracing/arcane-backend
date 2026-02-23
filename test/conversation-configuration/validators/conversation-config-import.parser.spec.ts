import { Test, TestingModule } from "@nestjs/testing";
import { BadRequestException } from "@nestjs/common";
import { ConversationConfigImportParser } from "../../../src/conversation-configuration/validators/conversation-config-import.parser";

describe("ConversationConfigImportParser", () => {
  let parser: ConversationConfigImportParser;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ConversationConfigImportParser],
    }).compile();

    parser = module.get<ConversationConfigImportParser>(
      ConversationConfigImportParser,
    );
  });

  describe("parse", () => {
    it("should parse valid YAML content", () => {
      const yamlContent = `
version: '1.0'
conversationConfigurations:
  - name: Test Config
    stitchingAttributesName: ['attr1']
      `;

      const result = parser.parse(yamlContent);

      expect(result).toBeDefined();
      expect((result as any).version).toBe("1.0");
      expect((result as any).conversationConfigurations).toBeDefined();
    });

    it("should throw BadRequestException for invalid YAML", () => {
      const invalidYaml = "invalid: yaml: content: [";

      expect(() => parser.parse(invalidYaml)).toThrow(BadRequestException);
      expect(() => parser.parse(invalidYaml)).toThrow(
        "Failed to parse YAML file",
      );
    });
  });

  describe("extractConfigArray", () => {
    it("should extract conversationConfigurations array from object", () => {
      const parsedYaml = {
        version: "1.0",
        conversationConfigurations: [
          { name: "Config 1", stitchingAttributesName: ["attr1"] },
          { name: "Config 2", stitchingAttributesName: ["attr2"] },
        ],
      };

      const result = parser.extractConfigArray(parsedYaml);

      expect(result).toEqual([
        { name: "Config 1", stitchingAttributesName: ["attr1"] },
        { name: "Config 2", stitchingAttributesName: ["attr2"] },
      ]);
    });

    it("should return array directly if parsed YAML is already an array", () => {
      const parsedYaml = [
        { name: "Config 1", stitchingAttributesName: ["attr1"] },
        { name: "Config 2", stitchingAttributesName: ["attr2"] },
      ];

      const result = parser.extractConfigArray(parsedYaml);

      expect(result).toEqual(parsedYaml);
    });

    it("should return empty array when conversationConfigurations property is missing", () => {
      const parsedYaml = { version: "1.0" };

      const result = parser.extractConfigArray(parsedYaml);

      expect(result).toEqual([]);
    });

    it("should throw BadRequestException when parsed YAML is not an object", () => {
      const parsedYaml = "not an object";

      expect(() => parser.extractConfigArray(parsedYaml)).toThrow(
        BadRequestException,
      );
      expect(() => parser.extractConfigArray(parsedYaml)).toThrow(
        "Invalid YAML format: expected an object",
      );
    });

    it("should throw BadRequestException when parsed YAML is null", () => {
      expect(() => parser.extractConfigArray(null)).toThrow(
        BadRequestException,
      );
    });

    it("should throw BadRequestException when conversationConfigurations is not an array", () => {
      const parsedYaml = {
        version: "1.0",
        conversationConfigurations: "not an array",
      };

      expect(() => parser.extractConfigArray(parsedYaml)).toThrow(
        BadRequestException,
      );
      expect(() => parser.extractConfigArray(parsedYaml)).toThrow(
        "Invalid YAML format: conversationConfigurations must be an array",
      );
    });
  });
});
