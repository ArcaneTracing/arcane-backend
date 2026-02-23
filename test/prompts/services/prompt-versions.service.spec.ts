import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { NotFoundException, ForbiddenException } from "@nestjs/common";
import { PromptVersionsService } from "../../../src/prompts/services/prompt-versions.service";
import { Prompt } from "../../../src/prompts/entities/prompt.entity";
import { PromptVersion } from "../../../src/prompts/entities/prompt-version.entity";
import { AuditService } from "../../../src/audit/audit.service";
import {
  ERROR_MESSAGES,
  formatError,
} from "../../../src/common/constants/error-messages.constants";
import {
  TemplateType,
  TemplateFormat,
} from "../../../src/prompts/dto/prompt-types";

describe("PromptVersionsService", () => {
  let service: PromptVersionsService;
  let promptRepository: Repository<Prompt>;
  let promptVersionRepository: Repository<PromptVersion>;

  const mockPromptRepository = {
    findOne: jest.fn(),
  };

  const mockPromptVersionRepository = {
    find: jest.fn(),
    findOne: jest.fn(),
  };

  const mockPrompt: Prompt = {
    id: "prompt-1",
    name: "test-prompt",
    description: "Test Description",
    projectId: "project-1",
    promotedVersionId: null,
    metadata: {},
    createdAt: new Date(),
    updatedAt: new Date(),
  } as Prompt;

  const mockPromptVersion: PromptVersion = {
    id: "version-1",
    promptId: "prompt-1",
    prompt: mockPrompt,
    userId: "user-1",
    modelConfigurationId: "model-config-1",
    modelConfiguration: null as any,
    templateType: TemplateType.CHAT,
    templateFormat: TemplateFormat.MUSTACHE,
    template: { type: "chat", messages: [] },
    invocationParameters: { type: "openai", openai: {} },
    tools: null,
    responseFormat: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  } as PromptVersion;

  const mockAuditService = { record: jest.fn().mockResolvedValue(undefined) };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PromptVersionsService,
        {
          provide: getRepositoryToken(Prompt),
          useValue: mockPromptRepository,
        },
        {
          provide: getRepositoryToken(PromptVersion),
          useValue: mockPromptVersionRepository,
        },
        { provide: AuditService, useValue: mockAuditService },
      ],
    }).compile();

    service = module.get<PromptVersionsService>(PromptVersionsService);
    promptRepository = module.get<Repository<Prompt>>(
      getRepositoryToken(Prompt),
    );
    promptVersionRepository = module.get<Repository<PromptVersion>>(
      getRepositoryToken(PromptVersion),
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("findPromptByIdentifier", () => {
    it("should find prompt by id", async () => {
      mockPromptRepository.findOne.mockImplementation((options: any) => {
        if (options.where.id === "prompt-1") {
          return Promise.resolve(mockPrompt);
        }
        return Promise.resolve(null);
      });

      const result = await service.findPromptByIdentifier(
        "project-1",
        "prompt-1",
      );

      expect(mockPromptRepository.findOne).toHaveBeenCalledWith({
        where: { id: "prompt-1", projectId: "project-1" },
      });
      expect(result).toEqual(mockPrompt);
    });

    it("should find prompt by name when id not found", async () => {
      mockPromptRepository.findOne.mockImplementation((options: any) => {
        if (options.where.id === "test-prompt") {
          return Promise.resolve(null);
        }
        if (options.where.name === "test-prompt") {
          return Promise.resolve(mockPrompt);
        }
        return Promise.resolve(null);
      });

      const result = await service.findPromptByIdentifier(
        "project-1",
        "test-prompt",
      );

      expect(mockPromptRepository.findOne).toHaveBeenCalledTimes(2);
      expect(mockPromptRepository.findOne).toHaveBeenNthCalledWith(1, {
        where: { id: "test-prompt", projectId: "project-1" },
      });
      expect(mockPromptRepository.findOne).toHaveBeenNthCalledWith(2, {
        where: { name: "test-prompt", projectId: "project-1" },
      });
      expect(result).toEqual(mockPrompt);
    });

    it("should return null when prompt not found", async () => {
      mockPromptRepository.findOne.mockResolvedValue(null);

      const result = await service.findPromptByIdentifier(
        "project-1",
        "non-existent",
      );

      expect(mockPromptRepository.findOne).toHaveBeenCalledTimes(2);
      expect(result).toBeNull();
    });
  });

  describe("getPromptByIdentifierOrThrow", () => {
    it("should return prompt when found", async () => {
      mockPromptRepository.findOne.mockImplementation((options: any) => {
        if (options.where.id === "prompt-1") {
          return Promise.resolve(mockPrompt);
        }
        return Promise.resolve(null);
      });

      const result = await service.getPromptByIdentifierOrThrow(
        "project-1",
        "prompt-1",
      );

      expect(result).toEqual(mockPrompt);
    });

    it("should throw NotFoundException when prompt not found", async () => {
      mockPromptRepository.findOne.mockResolvedValue(null);

      await expect(
        service.getPromptByIdentifierOrThrow("project-1", "non-existent"),
      ).rejects.toThrow(NotFoundException);
      await expect(
        service.getPromptByIdentifierOrThrow("project-1", "non-existent"),
      ).rejects.toThrow("Prompt not found: non-existent");
    });
  });

  describe("findVersions", () => {
    it("should return all versions for a prompt", async () => {
      mockPromptRepository.findOne.mockResolvedValue(mockPrompt);
      mockPromptVersionRepository.find.mockResolvedValue([mockPromptVersion]);

      const result = await service.findVersions("project-1", "prompt-1");

      expect(mockPromptVersionRepository.find).toHaveBeenCalledWith({
        where: { promptId: "prompt-1" },
        relations: ["modelConfiguration"],
        order: { createdAt: "DESC" },
      });
      expect(result.data).toHaveLength(1);
    });

    it("should throw ForbiddenException when prompt belongs to different project", async () => {
      const promptDifferentProject = {
        ...mockPrompt,
        projectId: "different-project",
      };
      mockPromptRepository.findOne.mockResolvedValue(promptDifferentProject);

      await expect(
        service.findVersions("project-1", "prompt-1"),
      ).rejects.toThrow(ForbiddenException);
      await expect(
        service.findVersions("project-1", "prompt-1"),
      ).rejects.toThrow(
        formatError(ERROR_MESSAGES.PROMPT_DOES_NOT_BELONG_TO_PROJECT),
      );
    });
  });

  describe("findVersionById", () => {
    it("should return a version by id", async () => {
      mockPromptVersionRepository.findOne.mockResolvedValue(mockPromptVersion);

      const result = await service.findVersionById("project-1", "version-1");

      expect(mockPromptVersionRepository.findOne).toHaveBeenCalledWith({
        where: { id: "version-1" },
        relations: ["prompt", "modelConfiguration"],
      });
      expect(result.data.id).toBe("version-1");
    });

    it("should throw NotFoundException when version not found", async () => {
      mockPromptVersionRepository.findOne.mockResolvedValue(null);

      await expect(
        service.findVersionById("project-1", "non-existent"),
      ).rejects.toThrow(NotFoundException);
    });

    it("should throw ForbiddenException when version belongs to different project", async () => {
      const promptDifferentProject = {
        ...mockPrompt,
        projectId: "different-project",
      };
      const versionDifferentProject = {
        ...mockPromptVersion,
        prompt: promptDifferentProject,
      };
      mockPromptVersionRepository.findOne.mockResolvedValue(
        versionDifferentProject,
      );

      await expect(
        service.findVersionById("project-1", "version-1"),
      ).rejects.toThrow(ForbiddenException);
      await expect(
        service.findVersionById("project-1", "version-1"),
      ).rejects.toThrow(
        formatError(ERROR_MESSAGES.PROMPT_VERSION_DOES_NOT_BELONG_TO_PROJECT),
      );
    });
  });

  describe("findLatestVersion", () => {
    it("should return the latest version for a prompt", async () => {
      mockPromptRepository.findOne.mockResolvedValue(mockPrompt);
      mockPromptVersionRepository.findOne.mockResolvedValue(mockPromptVersion);

      const result = await service.findLatestVersion("project-1", "prompt-1");

      expect(mockPromptVersionRepository.findOne).toHaveBeenCalledWith({
        where: { promptId: "prompt-1" },
        relations: ["prompt", "modelConfiguration"],
        order: { createdAt: "DESC" },
      });
      expect(result.data.id).toBe("version-1");
    });

    it("should throw NotFoundException when no versions exist", async () => {
      mockPromptRepository.findOne.mockResolvedValue(mockPrompt);
      mockPromptVersionRepository.findOne.mockResolvedValue(null);

      await expect(
        service.findLatestVersion("project-1", "prompt-1"),
      ).rejects.toThrow(NotFoundException);
      await expect(
        service.findLatestVersion("project-1", "prompt-1"),
      ).rejects.toThrow("No versions found for prompt: prompt-1");
    });

    it("should throw ForbiddenException when prompt belongs to different project", async () => {
      const promptDifferentProject = {
        ...mockPrompt,
        projectId: "different-project",
      };
      mockPromptRepository.findOne.mockResolvedValue(promptDifferentProject);

      await expect(
        service.findLatestVersion("project-1", "prompt-1"),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe("getLatestVersionByPromptId", () => {
    it("should return latest version by prompt ID (internal API - no projectId)", async () => {
      mockPromptRepository.findOne.mockResolvedValue(mockPrompt);
      mockPromptVersionRepository.findOne.mockResolvedValue(mockPromptVersion);

      const result = await service.getLatestVersionByPromptId("prompt-1");

      expect(mockPromptRepository.findOne).toHaveBeenNthCalledWith(1, {
        where: { id: "prompt-1" },
      });
      expect(mockPromptVersionRepository.findOne).toHaveBeenCalledWith({
        where: { promptId: "prompt-1" },
        relations: ["prompt", "modelConfiguration"],
        order: { createdAt: "DESC" },
      });
      expect(result.id).toBe("version-1");
    });

    it("should throw NotFoundException when prompt not found", async () => {
      mockPromptRepository.findOne.mockResolvedValue(null);

      await expect(
        service.getLatestVersionByPromptId("non-existent"),
      ).rejects.toThrow(NotFoundException);
      await expect(
        service.getLatestVersionByPromptId("non-existent"),
      ).rejects.toThrow("Prompt not found: non-existent");
    });
  });
});
