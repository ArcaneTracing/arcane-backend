import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import {
  NotFoundException,
  UnprocessableEntityException,
  ForbiddenException,
} from "@nestjs/common";
import { PromptsService } from "../../../src/prompts/services/prompts.service";
import { PromptVersionsService } from "../../../src/prompts/services/prompt-versions.service";
import { PromptConfigValidator } from "../../../src/prompts/validators/prompt-config.validator";
import { Prompt } from "../../../src/prompts/entities/prompt.entity";
import { PromptVersion } from "../../../src/prompts/entities/prompt-version.entity";
import { ModelConfiguration } from "../../../src/model-configuration/entities/model-configuration.entity";
import {
  CreatePromptRequestBodyDto,
  UpdatePromptRequestDto,
} from "../../../src/prompts/dto/request/create-prompt-request.dto";
import {
  TemplateType,
  TemplateFormat,
} from "../../../src/prompts/dto/prompt-types";
import { AuditService } from "../../../src/audit/audit.service";

describe("PromptsService", () => {
  let service: PromptsService;
  let promptRepository: Repository<Prompt>;
  let promptVersionRepository: Repository<PromptVersion>;
  let modelConfigurationRepository: Repository<ModelConfiguration>;
  let promptVersionsService: PromptVersionsService;
  let promptConfigValidator: PromptConfigValidator;

  const mockAuditService = { record: jest.fn().mockResolvedValue(undefined) };

  const mockPromptRepository = {
    find: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    remove: jest.fn(),
  };

  const mockPromptVersionRepository = {
    save: jest.fn(),
    count: jest.fn(),
  };

  const mockModelConfigurationRepository = {
    findOne: jest.fn(),
  };

  const mockPromptVersionsService = {
    getPromptByIdentifierOrThrow: jest.fn(),
  };

  const mockPromptConfigValidator = {
    validateTemplateType: jest.fn(),
    validateInvocationParameters: jest.fn(),
  };

  const mockPrompt: Prompt = {
    id: "prompt-1",
    name: "test-prompt",
    description: "Test Description",
    projectId: "project-1",
    metadata: {},
    createdAt: new Date(),
    updatedAt: new Date(),
  } as Prompt;

  const mockModelConfiguration: ModelConfiguration = {
    id: "model-config-1",
    name: "Test Model Config",
    configuration: { adapter: "openai" },
    createdAt: new Date(),
    updatedAt: new Date(),
  } as ModelConfiguration;

  const mockPromptVersion: PromptVersion = {
    id: "version-1",
    promptId: "prompt-1",
    prompt: mockPrompt,
    userId: "user-1",
    modelConfigurationId: "model-config-1",
    modelConfiguration: mockModelConfiguration,
    templateType: TemplateType.CHAT,
    templateFormat: TemplateFormat.MUSTACHE,
    template: { type: "chat", messages: [] },
    invocationParameters: { type: "openai", openai: {} },
    tools: null,
    responseFormat: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  } as PromptVersion;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PromptsService,
        {
          provide: getRepositoryToken(Prompt),
          useValue: mockPromptRepository,
        },
        {
          provide: getRepositoryToken(PromptVersion),
          useValue: mockPromptVersionRepository,
        },
        {
          provide: getRepositoryToken(ModelConfiguration),
          useValue: mockModelConfigurationRepository,
        },
        {
          provide: PromptVersionsService,
          useValue: mockPromptVersionsService,
        },
        {
          provide: PromptConfigValidator,
          useValue: mockPromptConfigValidator,
        },
        { provide: AuditService, useValue: mockAuditService },
      ],
    }).compile();

    service = module.get<PromptsService>(PromptsService);
    promptRepository = module.get<Repository<Prompt>>(
      getRepositoryToken(Prompt),
    );
    promptVersionRepository = module.get<Repository<PromptVersion>>(
      getRepositoryToken(PromptVersion),
    );
    modelConfigurationRepository = module.get<Repository<ModelConfiguration>>(
      getRepositoryToken(ModelConfiguration),
    );
    promptVersionsService = module.get<PromptVersionsService>(
      PromptVersionsService,
    );
    promptConfigValidator = module.get<PromptConfigValidator>(
      PromptConfigValidator,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("findAll", () => {
    it("should return all prompts for a project", async () => {
      mockPromptRepository.find.mockResolvedValue([mockPrompt]);

      const result = await service.findAll("project-1");

      expect(mockPromptRepository.find).toHaveBeenCalledWith({
        where: { projectId: "project-1" },
        order: { createdAt: "DESC" },
      });
      expect(result.data).toHaveLength(1);
      expect(result.data[0].id).toBe(mockPrompt.id);
    });

    it("should return empty array when no prompts exist", async () => {
      mockPromptRepository.find.mockResolvedValue([]);

      const result = await service.findAll("project-1");

      expect(result.data).toEqual([]);
    });
  });

  describe("create", () => {
    const createDto: CreatePromptRequestBodyDto = {
      prompt: {
        name: "test-prompt",
        description: "Test Description",
        metadata: {},
      },
      version: {
        modelConfigurationId: "model-config-1",
        templateType: TemplateType.CHAT,
        templateFormat: TemplateFormat.MUSTACHE,
        template: { type: "chat", messages: [] },
        invocationParameters: { type: "openai", openai: {} },
      },
    };

    it("should create a prompt with initial version", async () => {
      mockModelConfigurationRepository.findOne.mockResolvedValue(
        mockModelConfiguration,
      );
      mockPromptRepository.findOne.mockResolvedValue(null);
      mockPromptRepository.save.mockResolvedValue(mockPrompt);
      mockPromptVersionRepository.count.mockResolvedValue(0);
      mockPromptVersionRepository.save.mockResolvedValue(mockPromptVersion);

      const result = await service.create(
        "project-1",
        createDto,
        "user-1",
        "org-1",
      );

      expect(mockPromptConfigValidator.validateTemplateType).toHaveBeenCalled();
      expect(mockModelConfigurationRepository.findOne).toHaveBeenCalledWith({
        where: { id: "model-config-1" },
      });
      expect(
        mockPromptConfigValidator.validateInvocationParameters,
      ).toHaveBeenCalled();
      expect(mockPromptRepository.save).toHaveBeenCalled();
      expect(mockPromptVersionRepository.save).toHaveBeenCalled();
      expect(mockAuditService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "prompt.created",
          actorId: "user-1",
          resourceType: "prompt",
          resourceId: mockPrompt.id,
          organisationId: "org-1",
          projectId: "project-1",
          afterState: expect.objectContaining({
            id: mockPrompt.id,
            name: mockPrompt.name,
            description: mockPrompt.description,
            projectId: mockPrompt.projectId,
          }),
          metadata: expect.objectContaining({
            creatorId: "user-1",
            organisationId: "org-1",
            projectId: "project-1",
            initialVersionId: mockPromptVersion.id,
          }),
        }),
      );
      expect(result.data).toBeDefined();
    });

    it("should throw UnprocessableEntityException for non-CHAT template type", async () => {
      const invalidDto = {
        ...createDto,
        version: {
          ...createDto.version,
          templateType: TemplateType.STR,
        },
      };

      await expect(
        service.create("project-1", invalidDto, "user-1", "org-1"),
      ).rejects.toThrow(UnprocessableEntityException);
      await expect(
        service.create("project-1", invalidDto, "user-1", "org-1"),
      ).rejects.toThrow("Only CHAT template type is currently supported");
    });

    it("should throw NotFoundException when model configuration not found", async () => {
      mockModelConfigurationRepository.findOne.mockResolvedValue(null);

      await expect(
        service.create("project-1", createDto, "user-1", "org-1"),
      ).rejects.toThrow(NotFoundException);
      expect(mockPromptRepository.save).not.toHaveBeenCalled();
    });
  });

  describe("update", () => {
    it("should update prompt name and description", async () => {
      const updateDto: UpdatePromptRequestDto = {
        name: "updated-prompt",
        description: "Updated Description",
      };
      mockPromptVersionsService.getPromptByIdentifierOrThrow.mockResolvedValue(
        mockPrompt,
      );
      mockPromptRepository.findOne.mockResolvedValue(null);
      const updatedPrompt = {
        ...mockPrompt,
        name: "updated-prompt",
        description: "Updated Description",
      };
      mockPromptRepository.save.mockResolvedValue(updatedPrompt);

      const result = await service.update(
        "project-1",
        "prompt-1",
        updateDto,
        "user-1",
        "org-1",
      );

      expect(
        mockPromptVersionsService.getPromptByIdentifierOrThrow,
      ).toHaveBeenCalledWith("project-1", "prompt-1");
      expect(mockPromptRepository.save).toHaveBeenCalled();
      expect(mockAuditService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "prompt.updated",
          actorId: "user-1",
          resourceType: "prompt",
          resourceId: mockPrompt.id,
          organisationId: "org-1",
          projectId: "project-1",
          metadata: {
            changedFields: ["name", "description"],
            organisationId: "org-1",
            projectId: "project-1",
          },
        }),
      );
      expect(result.data.name).toBe("updated-prompt");
    });

    it("should throw ForbiddenException when prompt belongs to different project", async () => {
      const updateDto: UpdatePromptRequestDto = {
        name: "updated-prompt",
      };
      const promptDifferentProject = {
        ...mockPrompt,
        projectId: "different-project",
      };
      mockPromptVersionsService.getPromptByIdentifierOrThrow.mockResolvedValue(
        promptDifferentProject,
      );

      await expect(
        service.update("project-1", "prompt-1", updateDto, "user-1", "org-1"),
      ).rejects.toThrow(ForbiddenException);
      expect(mockPromptRepository.save).not.toHaveBeenCalled();
    });

    it("should throw UnprocessableEntityException when name already exists", async () => {
      const updateDto: UpdatePromptRequestDto = {
        name: "existing-prompt",
      };
      mockPromptVersionsService.getPromptByIdentifierOrThrow.mockResolvedValue(
        mockPrompt,
      );
      const existingPrompt = {
        ...mockPrompt,
        id: "different-id",
        name: "existing-prompt",
      };
      mockPromptRepository.findOne.mockResolvedValue(existingPrompt);

      await expect(
        service.update("project-1", "prompt-1", updateDto, "user-1", "org-1"),
      ).rejects.toThrow(UnprocessableEntityException);
      await expect(
        service.update("project-1", "prompt-1", updateDto, "user-1", "org-1"),
      ).rejects.toThrow(
        'Prompt with name "existing-prompt" already exists in this project',
      );
    });

    it("should allow updating description only", async () => {
      const updateDto: UpdatePromptRequestDto = {
        description: "Updated Description",
      };
      mockPromptVersionsService.getPromptByIdentifierOrThrow.mockResolvedValue(
        mockPrompt,
      );
      const updatedPrompt = {
        ...mockPrompt,
        description: "Updated Description",
      };
      mockPromptRepository.save.mockResolvedValue(updatedPrompt);

      const result = await service.update(
        "project-1",
        "prompt-1",
        updateDto,
        "user-1",
        "org-1",
      );

      expect(result.data.description).toBe("Updated Description");
    });
  });

  describe("remove", () => {
    it("should remove a prompt", async () => {
      mockPromptVersionsService.getPromptByIdentifierOrThrow.mockResolvedValue(
        mockPrompt,
      );
      mockPromptRepository.remove.mockResolvedValue(mockPrompt);

      await service.remove("project-1", "prompt-1", "user-1", "org-1");

      expect(
        mockPromptVersionsService.getPromptByIdentifierOrThrow,
      ).toHaveBeenCalledWith("project-1", "prompt-1");
      expect(mockPromptRepository.remove).toHaveBeenCalledWith(mockPrompt);
      expect(mockAuditService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "prompt.deleted",
          actorId: "user-1",
          resourceType: "prompt",
          resourceId: mockPrompt.id,
          organisationId: "org-1",
          projectId: "project-1",
          beforeState: expect.any(Object),
          afterState: null,
          metadata: { organisationId: "org-1", projectId: "project-1" },
        }),
      );
    });

    it("should throw NotFoundException when prompt not found", async () => {
      mockPromptVersionsService.getPromptByIdentifierOrThrow.mockRejectedValue(
        new NotFoundException("Prompt not found: non-existent"),
      );

      await expect(
        service.remove("project-1", "non-existent", "user-1", "org-1"),
      ).rejects.toThrow(NotFoundException);
      expect(mockPromptRepository.remove).not.toHaveBeenCalled();
    });
  });
});
