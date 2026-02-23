jest.mock("@thallesp/nestjs-better-auth", () => ({
  Session:
    () => (target: any, propertyKey: string, parameterIndex: number) => {},
  UserSession: class UserSession {},
}));

jest.mock("../../../src/rbac/guards/org-project-permission.guard", () => ({
  OrgProjectPermissionGuard: jest.fn(() => ({
    canActivate: jest.fn(() => true),
  })),
}));

import { Test, TestingModule } from "@nestjs/testing";
import { PromptVersionsController } from "../../../src/prompts/controllers/prompt-versions.controller";
import { PromptVersionsService } from "../../../src/prompts/services/prompt-versions.service";
import {
  PromptVersionResponseDto,
  ResponseDto,
} from "../../../src/prompts/dto/response/prompt-response.dto";
import {
  TemplateType,
  TemplateFormat,
} from "../../../src/prompts/dto/prompt-types";

describe("PromptVersionsController", () => {
  let controller: PromptVersionsController;
  let promptVersionsService: PromptVersionsService;

  const mockPromptVersionsService = {
    findVersionById: jest.fn(),
  };

  const mockPromptVersionResponseDto: PromptVersionResponseDto = {
    id: "version-1",
    promptId: "prompt-1",
    promptName: "test-prompt",
    versionName: null,
    description: null,
    modelConfigurationId: "model-config-1",
    templateType: TemplateType.CHAT,
    templateFormat: TemplateFormat.MUSTACHE,
    template: { type: "chat", messages: [] },
    invocationParameters: { type: "openai", openai: {} },
    tools: null,
    responseFormat: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PromptVersionsController],
      providers: [
        {
          provide: PromptVersionsService,
          useValue: mockPromptVersionsService,
        },
      ],
    }).compile();

    controller = module.get<PromptVersionsController>(PromptVersionsController);
    promptVersionsService = module.get<PromptVersionsService>(
      PromptVersionsService,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("findVersionById", () => {
    it("should return a prompt version by id", async () => {
      const response: ResponseDto<PromptVersionResponseDto> = {
        data: mockPromptVersionResponseDto,
      };
      mockPromptVersionsService.findVersionById.mockResolvedValue(response);

      const result = await controller.findVersionById("project-1", "version-1");

      expect(result).toEqual(response);
      expect(promptVersionsService.findVersionById).toHaveBeenCalledWith(
        "project-1",
        "version-1",
      );
    });
  });
});
