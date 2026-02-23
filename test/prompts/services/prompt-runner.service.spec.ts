import { Test, TestingModule } from "@nestjs/testing";
import { HttpService } from "@nestjs/axios";
import { ConfigService } from "@nestjs/config";
import { of, throwError } from "rxjs";
import { NotFoundException, BadGatewayException } from "@nestjs/common";
import { PromptRunnerService } from "../../../src/prompts/services/prompt-runner.service";
import { ModelConfigurationService } from "../../../src/model-configuration/services/model-configuration.service";
import { RunPromptRequestDto } from "../../../src/prompts/dto/request/run-prompt-request.dto";
import { LLMServiceResponseDto } from "../../../src/prompts/dto/llm-service-request.dto";
import {
  ERROR_MESSAGES,
  formatError,
} from "../../../src/common/constants/error-messages.constants";

describe("PromptRunnerService", () => {
  let service: PromptRunnerService;
  let modelConfigurationService: ModelConfigurationService;
  let httpService: HttpService;
  let configService: ConfigService;

  const mockModelConfigurationService = {
    findOneById: jest.fn(),
  };

  const mockHttpService = {
    post: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn(),
  };

  const mockModelConfiguration = {
    id: "model-config-1",
    name: "Test Model Config",
    configuration: {
      adapter: "openai",
      apiKey: "sk-plain-api-key",
      modelName: "gpt-4",
    },
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockLLMResponse: LLMServiceResponseDto = {
    output: "Test response",
    usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PromptRunnerService,
        {
          provide: ModelConfigurationService,
          useValue: mockModelConfigurationService,
        },
        {
          provide: HttpService,
          useValue: mockHttpService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<PromptRunnerService>(PromptRunnerService);
    modelConfigurationService = module.get<ModelConfigurationService>(
      ModelConfigurationService,
    );
    httpService = module.get<HttpService>(HttpService);
    configService = module.get<ConfigService>(ConfigService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("run", () => {
    const runDto: RunPromptRequestDto = {
      promptVersion: {
        id: "version-1",
        template: { type: "chat", messages: [] },
        invocationParameters: { type: "openai", openai: {} },
      } as any,
      modelConfigurationId: "model-config-1",
      inputs: { input1: "value1" },
    };

    it("should run a prompt successfully", async () => {
      mockModelConfigurationService.findOneById.mockResolvedValue(
        mockModelConfiguration,
      );
      mockConfigService.get.mockReturnValue("http://localhost:8000/api/v1/run");
      mockHttpService.post.mockReturnValue(of({ data: mockLLMResponse }));

      const result = await service.run("project-1", runDto);

      expect(mockModelConfigurationService.findOneById).toHaveBeenCalledWith(
        "model-config-1",
      );
      expect(mockHttpService.post).toHaveBeenCalled();
      expect(result.data).toEqual(mockLLMResponse);
    });

    it("should throw NotFoundException when promptVersion is missing", async () => {
      const runDtoWithoutVersion = { ...runDto, promptVersion: undefined };

      await expect(
        service.run("project-1", runDtoWithoutVersion as any),
      ).rejects.toThrow(NotFoundException);
      await expect(
        service.run("project-1", runDtoWithoutVersion as any),
      ).rejects.toThrow(formatError(ERROR_MESSAGES.PROMPT_VERSION_REQUIRED));
    });

    it("should throw NotFoundException when model configuration not found", async () => {
      mockModelConfigurationService.findOneById.mockRejectedValue(
        new NotFoundException(
          "Model configuration with ID model-config-1 not found",
        ),
      );

      await expect(service.run("project-1", runDto)).rejects.toThrow(
        NotFoundException,
      );
    });

    it("should throw BadGatewayException when HTTP call fails", async () => {
      mockModelConfigurationService.findOneById.mockResolvedValue(
        mockModelConfiguration,
      );
      mockConfigService.get.mockReturnValue("http://localhost:8000/api/v1/run");
      const error = new Error("Network error");
      (error as any).response = { data: { message: "Service unavailable" } };
      mockHttpService.post.mockReturnValue(throwError(() => error));

      await expect(service.run("project-1", runDto)).rejects.toThrow(
        BadGatewayException,
      );
    });

    it("should use default worker API URL when not configured", async () => {
      mockModelConfigurationService.findOneById.mockResolvedValue(
        mockModelConfiguration,
      );
      mockConfigService.get.mockReturnValue(undefined);
      mockHttpService.post.mockReturnValue(of({ data: mockLLMResponse }));

      await service.run("project-1", runDto);

      expect(mockHttpService.post).toHaveBeenCalledWith(
        "http://localhost:8000/api/v1/run",
        expect.any(Object),
      );
    });

    it("should pass decrypted apiKey to worker (not encrypted)", async () => {
      const decryptedConfig = {
        id: "model-config-1",
        name: "Test Model Config",
        configuration: {
          adapter: "anthropic",
          modelName: "claude-opus-4-6",
          apiKey: "sk-ant-plain-api-key-for-llm-calls",
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockModelConfigurationService.findOneById.mockResolvedValue(
        decryptedConfig,
      );
      mockConfigService.get.mockReturnValue("http://localhost:8000/api/v1/run");
      mockHttpService.post.mockReturnValue(of({ data: mockLLMResponse }));

      await service.run("project-1", runDto);

      const requestBody = mockHttpService.post.mock.calls[0][1];
      expect(requestBody.model_configuration.configuration.apiKey).toBe(
        "sk-ant-plain-api-key-for-llm-calls",
      );
      expect(requestBody.model_configuration.configuration.apiKey).not.toMatch(
        /^[0-9a-f]+:[0-9a-f]+:[0-9a-f]+$/i,
      );
    });
  });
});
