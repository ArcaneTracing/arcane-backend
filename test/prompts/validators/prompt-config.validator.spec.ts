import { Test, TestingModule } from "@nestjs/testing";
import { UnprocessableEntityException } from "@nestjs/common";
import { PromptConfigValidator } from "../../../src/prompts/validators/prompt-config.validator";
import {
  TemplateType,
  ModelProvider,
} from "../../../src/prompts/dto/prompt-types";

describe("PromptConfigValidator", () => {
  let validator: PromptConfigValidator;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PromptConfigValidator],
    }).compile();

    validator = module.get<PromptConfigValidator>(PromptConfigValidator);
  });

  describe("validateTemplateType", () => {
    it("should validate CHAT template type with chat template", () => {
      expect(() => {
        validator.validateTemplateType(TemplateType.CHAT, { type: "chat" });
      }).not.toThrow();
    });

    it("should throw UnprocessableEntityException for CHAT template type with non-chat template", () => {
      expect(() => {
        validator.validateTemplateType(TemplateType.CHAT, { type: "string" });
      }).toThrow(UnprocessableEntityException);
      expect(() => {
        validator.validateTemplateType(TemplateType.CHAT, { type: "string" });
      }).toThrow('Template type CHAT requires template.type to be "chat"');
    });

    it("should validate STR template type with string template", () => {
      expect(() => {
        validator.validateTemplateType(TemplateType.STR, { type: "string" });
      }).not.toThrow();
    });

    it("should throw UnprocessableEntityException for STR template type with non-string template", () => {
      expect(() => {
        validator.validateTemplateType(TemplateType.STR, { type: "chat" });
      }).toThrow(UnprocessableEntityException);
      expect(() => {
        validator.validateTemplateType(TemplateType.STR, { type: "chat" });
      }).toThrow('Template type STR requires template.type to be "string"');
    });
  });

  describe("validateInvocationParameters", () => {
    it("should validate OpenAI invocation parameters", () => {
      expect(() => {
        validator.validateInvocationParameters(ModelProvider.OPENAI, {
          type: "openai",
        });
      }).not.toThrow();
    });

    it("should validate Azure OpenAI invocation parameters", () => {
      expect(() => {
        validator.validateInvocationParameters(ModelProvider.AZURE_OPENAI, {
          type: "azure_openai",
        });
      }).not.toThrow();
    });

    it("should validate Anthropic invocation parameters", () => {
      expect(() => {
        validator.validateInvocationParameters(ModelProvider.ANTHROPIC, {
          type: "anthropic",
        });
      }).not.toThrow();
    });

    it("should validate Google Vertex AI invocation parameters", () => {
      expect(() => {
        validator.validateInvocationParameters(ModelProvider.GOOGLE, {
          type: "google-vertex-ai",
        });
      }).not.toThrow();
    });

    it("should validate Google AI Studio invocation parameters", () => {
      expect(() => {
        validator.validateInvocationParameters(ModelProvider.GOOGLE, {
          type: "google-ai-studio",
        });
      }).not.toThrow();
    });

    it("should validate DeepSeek invocation parameters", () => {
      expect(() => {
        validator.validateInvocationParameters(ModelProvider.DEEPSEEK, {
          type: "deepseek",
        });
      }).not.toThrow();
    });

    it("should validate XAI invocation parameters", () => {
      expect(() => {
        validator.validateInvocationParameters(ModelProvider.XAI, {
          type: "xai",
        });
      }).not.toThrow();
    });

    it("should validate Ollama invocation parameters", () => {
      expect(() => {
        validator.validateInvocationParameters(ModelProvider.OLLAMA, {
          type: "ollama",
        });
      }).not.toThrow();
    });

    it("should validate Bedrock invocation parameters", () => {
      expect(() => {
        validator.validateInvocationParameters(ModelProvider.AWS, {
          type: "bedrock",
        });
      }).not.toThrow();
    });

    it("should throw UnprocessableEntityException for mismatched provider and type", () => {
      expect(() => {
        validator.validateInvocationParameters(ModelProvider.OPENAI, {
          type: "anthropic",
        });
      }).toThrow(UnprocessableEntityException);
      expect(() => {
        validator.validateInvocationParameters(ModelProvider.OPENAI, {
          type: "anthropic",
        });
      }).toThrow(
        'Invocation parameters type "anthropic" does not match model provider "OPENAI"',
      );
    });
  });
});
