import { IdentifierUtils } from "../../../src/prompts/utils/identifier.utils";

describe("IdentifierUtils", () => {
  describe("validate", () => {
    it("should validate a valid identifier", () => {
      expect(IdentifierUtils.validate("test-prompt")).toBe("test-prompt");
      expect(IdentifierUtils.validate("test.prompt")).toBe("test.prompt");
      expect(IdentifierUtils.validate("test_prompt")).toBe("test_prompt");
      expect(IdentifierUtils.validate("test prompt")).toBe("test prompt");
      expect(IdentifierUtils.validate("test123")).toBe("test123");
    });

    it("should trim whitespace", () => {
      expect(IdentifierUtils.validate("  test-prompt  ")).toBe("test-prompt");
    });

    it("should throw error for empty identifier", () => {
      expect(() => IdentifierUtils.validate("")).toThrow(
        "Identifier cannot be empty",
      );
      expect(() => IdentifierUtils.validate("   ")).toThrow(
        "Identifier cannot be empty",
      );
    });

    it("should throw error for identifier starting with dot", () => {
      expect(() => IdentifierUtils.validate(".test-prompt")).toThrow(
        "Identifier cannot start or end with a dot",
      );
    });

    it("should throw error for identifier ending with dot", () => {
      expect(() => IdentifierUtils.validate("test-prompt.")).toThrow(
        "Identifier cannot start or end with a dot",
      );
    });

    it("should throw error for consecutive dots", () => {
      expect(() => IdentifierUtils.validate("test..prompt")).toThrow(
        "Identifier cannot contain consecutive dots",
      );
    });

    it("should throw error for invalid characters", () => {
      expect(() => IdentifierUtils.validate("test@prompt")).toThrow(
        "Identifier contains invalid characters",
      );
      expect(() => IdentifierUtils.validate("test#prompt")).toThrow(
        "Identifier contains invalid characters",
      );
      expect(() => IdentifierUtils.validate("test$prompt")).toThrow(
        "Identifier contains invalid characters",
      );
    });

    it("should allow valid special characters", () => {
      expect(IdentifierUtils.validate("test-prompt_name.123")).toBe(
        "test-prompt_name.123",
      );
      expect(IdentifierUtils.validate("test prompt name")).toBe(
        "test prompt name",
      );
    });
  });
});
