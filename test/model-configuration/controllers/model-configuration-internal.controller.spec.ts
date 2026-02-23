jest.mock("@thallesp/nestjs-better-auth", () => ({
  AllowAnonymous: () => () => {},
}));

jest.mock("../../../src/auth/guards/api-key.guard", () => ({
  ApiKeyGuard: jest.fn(() => ({
    canActivate: jest.fn(() => true),
  })),
}));

import { Test, TestingModule } from "@nestjs/testing";
import { ModelConfigurationInternalController } from "../../../src/model-configuration/controllers/model-configuration-internal.controller";
import { ModelConfigurationService } from "../../../src/model-configuration/services/model-configuration.service";
import { ModelConfigurationResponseDto } from "../../../src/model-configuration/dto/response/model-configuration-response.dto";

describe("ModelConfigurationInternalController", () => {
  let controller: ModelConfigurationInternalController;
  let modelConfigurationService: ModelConfigurationService;

  const mockModelConfigurationService = {
    findOneById: jest.fn(),
  };

  const mockModelConfigurationResponseDto: ModelConfigurationResponseDto = {
    id: "config-1",
    name: "Test Config",
    configuration: {
      adapter: "openai",
      modelName: "gpt-4",
      apiKey: "sk-test-key",
    } as any,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ModelConfigurationInternalController],
      providers: [
        {
          provide: ModelConfigurationService,
          useValue: mockModelConfigurationService,
        },
      ],
    }).compile();

    controller = module.get<ModelConfigurationInternalController>(
      ModelConfigurationInternalController,
    );
    modelConfigurationService = module.get<ModelConfigurationService>(
      ModelConfigurationService,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("findOne", () => {
    it("should return a model configuration by id (internal endpoint)", async () => {
      mockModelConfigurationService.findOneById.mockResolvedValue(
        mockModelConfigurationResponseDto,
      );

      const result = await controller.findOne("config-1");

      expect(result).toEqual(mockModelConfigurationResponseDto);
      expect(modelConfigurationService.findOneById).toHaveBeenCalledWith(
        "config-1",
      );
    });
  });
});
