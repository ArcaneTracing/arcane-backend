jest.mock("@thallesp/nestjs-better-auth", () => ({
  AllowAnonymous: () => () => {},
}));

jest.mock("../../../src/auth/guards/api-key.guard", () => ({
  ApiKeyGuard: jest.fn(() => ({
    canActivate: jest.fn(() => true),
  })),
}));

import { Test, TestingModule } from "@nestjs/testing";
import { PromptsInternalController } from "../../../src/prompts/controllers/prompts-internal.controller";
import { PromptVersionsService } from "../../../src/prompts/services/prompt-versions.service";
import {
  TemplateType,
  TemplateFormat,
} from "../../../src/prompts/dto/prompt-types";

describe("PromptsInternalController", () => {
  let controller: PromptsInternalController;
  let promptVersionsService: PromptVersionsService;

  const mockPromptVersion = {
    id: "version-1",
    promptId: "prompt-1",
    prompt: { id: "prompt-1", name: "Test Prompt" },
    modelConfigurationId: "model-config-1",
    templateType: TemplateType.CHAT,
    templateFormat: TemplateFormat.MUSTACHE,
    template: { type: "chat", messages: [] },
    invocationParameters: { type: "openai", openai: {} },
    tools: null,
    responseFormat: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockPromptVersionsService = {
    getLatestVersionByPromptId: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PromptsInternalController],
      providers: [
        {
          provide: PromptVersionsService,
          useValue: mockPromptVersionsService,
        },
      ],
    }).compile();

    controller = module.get<PromptsInternalController>(
      PromptsInternalController,
    );
    promptVersionsService = module.get<PromptVersionsService>(
      PromptVersionsService,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("getLatestVersion", () => {
    it("should return latest prompt version by prompt ID", async () => {
      mockPromptVersionsService.getLatestVersionByPromptId.mockResolvedValue(
        mockPromptVersion,
      );

      const result = await controller.getLatestVersion("prompt-uuid-123");

      expect(
        promptVersionsService.getLatestVersionByPromptId,
      ).toHaveBeenCalledWith("prompt-uuid-123");
      expect(result).toBeDefined();
      expect(result.id).toBe("version-1");
    });
  });
});
