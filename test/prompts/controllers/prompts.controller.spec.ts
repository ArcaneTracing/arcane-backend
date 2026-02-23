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
import { PromptsController } from "../../../src/prompts/controllers/prompts.controller";
import { PromptsService } from "../../../src/prompts/services/prompts.service";
import { PromptVersionsService } from "../../../src/prompts/services/prompt-versions.service";
import { PromptRunnerService } from "../../../src/prompts/services/prompt-runner.service";
import {
  CreatePromptRequestBodyDto,
  UpdatePromptRequestDto,
} from "../../../src/prompts/dto/request/create-prompt-request.dto";
import { RunPromptRequestDto } from "../../../src/prompts/dto/request/run-prompt-request.dto";
import {
  PromptResponseDto,
  PromptVersionResponseDto,
  ListResponseDto,
  ResponseDto,
} from "../../../src/prompts/dto/response/prompt-response.dto";
import { LLMServiceResponseDto } from "../../../src/prompts/dto/llm-service-request.dto";
import {
  TemplateType,
  TemplateFormat,
} from "../../../src/prompts/dto/prompt-types";

type UserSession = {
  session: {
    id: string;
    createdAt: Date;
    updatedAt: Date;
    userId: string;
    expiresAt: Date;
    token: string;
  };
  user: {
    id: string;
    email?: string;
    name: string;
    emailVerified: boolean;
    createdAt: Date;
    updatedAt: Date;
  };
};

describe("PromptsController", () => {
  let controller: PromptsController;
  let promptsService: PromptsService;
  let promptVersionsService: PromptVersionsService;
  let promptRunnerService: PromptRunnerService;

  const mockPromptsService = {
    findAll: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
  };

  const mockPromptVersionsService = {
    findVersions: jest.fn(),
    findLatestVersion: jest.fn(),
  };

  const mockPromptRunnerService = {
    run: jest.fn(),
  };

  const mockUserSession: UserSession = {
    session: {
      id: "session-1",
      createdAt: new Date(),
      updatedAt: new Date(),
      userId: "user-1",
      expiresAt: new Date(),
      token: "token-1",
    },
    user: {
      id: "user-1",
      email: "test@example.com",
      name: "Test User",
      emailVerified: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  };

  const mockPromptResponseDto: PromptResponseDto = {
    id: "prompt-1",
    name: "test-prompt",
    description: "Test Description",
    metadata: {},
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
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
      controllers: [PromptsController],
      providers: [
        {
          provide: PromptsService,
          useValue: mockPromptsService,
        },
        {
          provide: PromptVersionsService,
          useValue: mockPromptVersionsService,
        },
        {
          provide: PromptRunnerService,
          useValue: mockPromptRunnerService,
        },
      ],
    }).compile();

    controller = module.get<PromptsController>(PromptsController);
    promptsService = module.get<PromptsService>(PromptsService);
    promptVersionsService = module.get<PromptVersionsService>(
      PromptVersionsService,
    );
    promptRunnerService = module.get<PromptRunnerService>(PromptRunnerService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("findAll", () => {
    it("should return all prompts for a project", async () => {
      const listResponse: ListResponseDto<PromptResponseDto> = {
        data: [mockPromptResponseDto],
      };
      mockPromptsService.findAll.mockResolvedValue(listResponse);

      const result = await controller.findAll("project-1");

      expect(result).toEqual(listResponse);
      expect(promptsService.findAll).toHaveBeenCalledWith("project-1");
    });
  });

  describe("create", () => {
    it("should create a prompt with initial version", async () => {
      const createDto: CreatePromptRequestBodyDto = {
        prompt: {
          name: "test-prompt",
          description: "Test Description",
        },
        version: {
          modelConfigurationId: "model-config-1",
          templateType: TemplateType.CHAT,
          templateFormat: TemplateFormat.MUSTACHE,
          template: { type: "chat", messages: [] },
          invocationParameters: { type: "openai", openai: {} },
        },
      };
      const response: ResponseDto<PromptVersionResponseDto> = {
        data: mockPromptVersionResponseDto,
      };
      mockPromptsService.create.mockResolvedValue(response);

      const result = await controller.create(
        "org-1",
        "project-1",
        createDto,
        mockUserSession,
      );

      expect(result).toEqual(response);
      expect(promptsService.create).toHaveBeenCalledWith(
        "project-1",
        createDto,
        mockUserSession?.user?.id,
        "org-1",
      );
    });
  });

  describe("update", () => {
    it("should update a prompt", async () => {
      const updateDto: UpdatePromptRequestDto = {
        name: "updated-prompt",
        description: "Updated Description",
      };
      const response: ResponseDto<PromptResponseDto> = {
        data: {
          ...mockPromptResponseDto,
          name: "updated-prompt",
          description: "Updated Description",
        },
      };
      mockPromptsService.update.mockResolvedValue(response);

      const result = await controller.update(
        "org-1",
        "project-1",
        "prompt-1",
        updateDto,
        mockUserSession,
      );

      expect(result).toEqual(response);
      expect(promptsService.update).toHaveBeenCalledWith(
        "project-1",
        "prompt-1",
        updateDto,
        mockUserSession?.user?.id,
        "org-1",
      );
    });
  });

  describe("remove", () => {
    it("should remove a prompt", async () => {
      mockPromptsService.remove.mockResolvedValue(undefined);

      await controller.remove(
        "org-1",
        "project-1",
        "prompt-1",
        mockUserSession,
      );

      expect(promptsService.remove).toHaveBeenCalledWith(
        "project-1",
        "prompt-1",
        mockUserSession?.user?.id,
        "org-1",
      );
    });
  });

  describe("findVersions", () => {
    it("should return all versions for a prompt", async () => {
      const listResponse: ListResponseDto<PromptVersionResponseDto> = {
        data: [mockPromptVersionResponseDto],
      };
      mockPromptVersionsService.findVersions.mockResolvedValue(listResponse);

      const result = await controller.findVersions("project-1", "prompt-1");

      expect(result).toEqual(listResponse);
      expect(promptVersionsService.findVersions).toHaveBeenCalledWith(
        "project-1",
        "prompt-1",
      );
    });
  });

  describe("findLatestVersion", () => {
    it("should return the latest version for a prompt", async () => {
      const response: ResponseDto<PromptVersionResponseDto> = {
        data: mockPromptVersionResponseDto,
      };
      mockPromptVersionsService.findLatestVersion.mockResolvedValue(response);

      const result = await controller.findLatestVersion(
        "project-1",
        "prompt-1",
      );

      expect(result).toEqual(response);
      expect(promptVersionsService.findLatestVersion).toHaveBeenCalledWith(
        "project-1",
        "prompt-1",
      );
    });
  });

  describe("run", () => {
    it("should run a prompt", async () => {
      const runDto: RunPromptRequestDto = {
        promptVersion: mockPromptVersionResponseDto,
        modelConfigurationId: "model-config-1",
        inputs: { input1: "value1" },
      };
      const response: ResponseDto<LLMServiceResponseDto> = {
        data: {
          output: "Test response",
          usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 },
        },
      };
      mockPromptRunnerService.run.mockResolvedValue(response);

      const result = await controller.run("project-1", runDto);

      expect(result).toEqual(response);
      expect(promptRunnerService.run).toHaveBeenCalledWith("project-1", runDto);
    });
  });
});
