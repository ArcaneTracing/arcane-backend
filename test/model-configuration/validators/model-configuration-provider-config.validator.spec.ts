import { Test, TestingModule } from "@nestjs/testing";
import { BadRequestException } from "@nestjs/common";
import { ModelConfigurationProviderConfigValidator } from "../../../src/model-configuration/validators/model-configuration-provider-config.validator";

describe("ModelConfigurationProviderConfigValidator", () => {
  let validator: ModelConfigurationProviderConfigValidator;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ModelConfigurationProviderConfigValidator],
    }).compile();

    validator = module.get<ModelConfigurationProviderConfigValidator>(
      ModelConfigurationProviderConfigValidator,
    );
  });

  describe("validate", () => {
    it("should pass validation when config is undefined", () => {
      expect(() => validator.validate("openai", undefined)).not.toThrow();
      expect(() => validator.validate("anthropic", undefined)).not.toThrow();
      expect(() => validator.validate("azure", undefined)).not.toThrow();
    });

    it("should validate Azure adapter requires endpoint", () => {
      expect(() => {
        validator.validate("azure", { endpoint: "https://test.azure.com" });
      }).not.toThrow();

      expect(() => {
        validator.validate("azure", {});
      }).toThrow(BadRequestException);
      expect(() => {
        validator.validate("azure", {});
      }).toThrow("Azure adapter requires config.endpoint to be a string");

      expect(() => {
        validator.validate("azure", { endpoint: 123 });
      }).toThrow(BadRequestException);
    });

    it("should validate Bedrock adapter requires region", () => {
      expect(() => {
        validator.validate("bedrock", { region: "us-east-1" });
      }).not.toThrow();

      expect(() => {
        validator.validate("bedrock", {});
      }).toThrow(BadRequestException);
      expect(() => {
        validator.validate("bedrock", {});
      }).toThrow("Bedrock adapter requires config.region to be a string");

      expect(() => {
        validator.validate("bedrock", { region: 123 });
      }).toThrow(BadRequestException);
    });

    it("should allow optional config for OpenAI adapter", () => {
      expect(() => {
        validator.validate("openai", {});
      }).not.toThrow();
      expect(() => {
        validator.validate("openai", { baseUrl: "https://api.openai.com" });
      }).not.toThrow();
    });

    it("should allow optional config for Anthropic adapter", () => {
      expect(() => {
        validator.validate("anthropic", {});
      }).not.toThrow();
      expect(() => {
        validator.validate("anthropic", {
          baseUrl: "https://api.anthropic.com",
        });
      }).not.toThrow();
    });

    it("should allow optional config for Google Vertex AI adapter", () => {
      expect(() => {
        validator.validate("google-vertex-ai", {});
      }).not.toThrow();
      expect(() => {
        validator.validate("google-vertex-ai", { project: "test-project" });
      }).not.toThrow();
    });

    it("should allow optional config for Google AI Studio adapter", () => {
      expect(() => {
        validator.validate("google-ai-studio", {});
      }).not.toThrow();
      expect(() => {
        validator.validate("google-ai-studio", {
          baseUrl: "https://generativelanguage.googleapis.com",
        });
      }).not.toThrow();
    });

    it("should handle unknown adapter types gracefully", () => {
      expect(() => {
        validator.validate("unknown-adapter" as any, {});
      }).not.toThrow();
    });
  });
});
