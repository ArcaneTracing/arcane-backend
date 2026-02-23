import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { Repository, IsNull } from "typeorm";
import { NotFoundException, BadRequestException } from "@nestjs/common";
import { ScoresService } from "../../../src/scores/services/scores.service";
import { Score, ScoringType } from "../../../src/scores/entities/score.entity";
import { Prompt } from "../../../src/prompts/entities/prompt.entity";
import { CreateScoreRequestDto } from "../../../src/scores/dto/request/create-score-request.dto";
import { UpdateScoreRequestDto } from "../../../src/scores/dto/request/update-score-request.dto";
import { ScoreResponseDto } from "../../../src/scores/dto/response/score-response.dto";
import { AuditService } from "../../../src/audit/audit.service";

describe("ScoresService", () => {
  let service: ScoresService;
  let scoreRepository: Repository<Score>;
  let promptRepository: Repository<Prompt>;

  const mockAuditService = { record: jest.fn().mockResolvedValue(undefined) };

  const mockScoreRepository = {
    save: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    remove: jest.fn(),
  };

  const mockPromptRepository = {
    findOne: jest.fn(),
  };

  const mockPrompt: Prompt = {
    id: "prompt-1",
    name: "Test Prompt",
    projectId: "project-1",
    createdAt: new Date(),
    updatedAt: new Date(),
  } as Prompt;

  const mockScore: Score = {
    id: "score-1",
    projectId: "project-1",
    name: "Test Score",
    description: "Test Description",
    scoringType: ScoringType.NUMERIC,
    scale: null,
    ordinalConfig: null,
    ragasScoreKey: null,
    evaluatorPromptId: "prompt-1",
    evaluatorPrompt: mockPrompt,
    createdById: "user-1",
    createdAt: new Date(),
    updatedAt: new Date(),
  } as Score;

  const mockGlobalScore: Score = {
    ...mockScore,
    id: "global-score-1",
    projectId: null,
    ragasScoreKey: "ragas-key",
    scoringType: ScoringType.RAGAS,
  } as Score;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ScoresService,
        {
          provide: getRepositoryToken(Score),
          useValue: mockScoreRepository,
        },
        {
          provide: getRepositoryToken(Prompt),
          useValue: mockPromptRepository,
        },
        { provide: AuditService, useValue: mockAuditService },
      ],
    }).compile();

    service = module.get<ScoresService>(ScoresService);
    scoreRepository = module.get<Repository<Score>>(getRepositoryToken(Score));
    promptRepository = module.get<Repository<Prompt>>(
      getRepositoryToken(Prompt),
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("create", () => {
    it("should create a score successfully", async () => {
      const createDto: CreateScoreRequestDto = {
        name: "Test Score",
        description: "Test Description",
        scoringType: ScoringType.NUMERIC,
      };
      mockScoreRepository.save.mockResolvedValue(mockScore);

      const result = await service.create(
        "project-1",
        createDto,
        "user-1",
        "org-1",
      );

      expect(mockScoreRepository.save).toHaveBeenCalled();
      expect(mockAuditService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "score.created",
          actorId: "user-1",
          resourceType: "score",
          resourceId: mockScore.id,
          organisationId: "org-1",
          projectId: "project-1",
          afterState: expect.objectContaining({
            id: mockScore.id,
            name: mockScore.name,
            scoringType: mockScore.scoringType,
            projectId: mockScore.projectId,
          }),
          metadata: {
            creatorId: "user-1",
            organisationId: "org-1",
            projectId: "project-1",
          },
        }),
      );
      expect(result.id).toBe(mockScore.id);
      expect(result.name).toBe(mockScore.name);
    });

    it("should create a score with evaluator prompt", async () => {
      const createDto: CreateScoreRequestDto = {
        name: "Test Score",
        scoringType: ScoringType.NUMERIC,
        evaluatorPromptId: "prompt-1",
      };
      mockPromptRepository.findOne.mockResolvedValue(mockPrompt);
      mockScoreRepository.save.mockResolvedValue(mockScore);

      const result = await service.create(
        "project-1",
        createDto,
        "user-1",
        "org-1",
      );

      expect(mockPromptRepository.findOne).toHaveBeenCalledWith({
        where: { id: "prompt-1" },
      });
      expect(mockScoreRepository.save).toHaveBeenCalled();
      expect(result.id).toBe(mockScore.id);
    });

    it("should throw NotFoundException when evaluator prompt not found", async () => {
      const createDto: CreateScoreRequestDto = {
        name: "Test Score",
        scoringType: ScoringType.NUMERIC,
        evaluatorPromptId: "non-existent",
      };
      mockPromptRepository.findOne.mockResolvedValue(null);

      await expect(
        service.create("project-1", createDto, "user-1", "org-1"),
      ).rejects.toThrow(NotFoundException);
      expect(mockScoreRepository.save).not.toHaveBeenCalled();
    });

    it("should throw NotFoundException when evaluator prompt belongs to different project", async () => {
      const createDto: CreateScoreRequestDto = {
        name: "Test Score",
        scoringType: ScoringType.NUMERIC,
        evaluatorPromptId: "prompt-1",
      };
      const promptDifferentProject = {
        ...mockPrompt,
        projectId: "different-project",
      };
      mockPromptRepository.findOne.mockResolvedValue(promptDifferentProject);

      await expect(
        service.create("project-1", createDto, "user-1", "org-1"),
      ).rejects.toThrow(NotFoundException);
      expect(mockScoreRepository.save).not.toHaveBeenCalled();
    });
  });

  describe("findAll", () => {
    it("should return all scores for a project including global scores", async () => {
      mockScoreRepository.find.mockResolvedValue([mockScore, mockGlobalScore]);

      const result = await service.findAll("project-1");

      expect(mockScoreRepository.find).toHaveBeenCalledWith({
        where: [{ projectId: "project-1" }, { projectId: IsNull() }],
        relations: ["evaluatorPrompt"],
        order: { createdAt: "DESC" },
      });
      expect(result).toHaveLength(2);
    });

    it("should return empty array when no scores exist", async () => {
      mockScoreRepository.find.mockResolvedValue([]);

      const result = await service.findAll("project-1");

      expect(result).toEqual([]);
    });
  });

  describe("findOne", () => {
    it("should return a score by id", async () => {
      mockScoreRepository.findOne.mockResolvedValue(mockScore);

      const result = await service.findOne("project-1", "score-1");

      expect(mockScoreRepository.findOne).toHaveBeenCalledWith({
        where: [
          { id: "score-1", projectId: "project-1" },
          { id: "score-1", projectId: IsNull() },
        ],

        relations: ["evaluatorPrompt"],
      });
      expect(result.id).toBe(mockScore.id);
    });

    it("should return global score when found", async () => {
      mockScoreRepository.findOne.mockResolvedValue(mockGlobalScore);

      const result = await service.findOne("project-1", "global-score-1");

      expect(result.id).toBe(mockGlobalScore.id);
      expect(result.projectId).toBeNull();
    });

    it("should throw NotFoundException when score not found", async () => {
      mockScoreRepository.findOne.mockResolvedValue(null);

      await expect(
        service.findOne("project-1", "non-existent"),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe("update", () => {
    it("should update a score successfully", async () => {
      const updateDto: UpdateScoreRequestDto = {
        name: "Updated Score",
      };
      const updatedScore = { ...mockScore, name: "Updated Score" };
      mockScoreRepository.findOne
        .mockResolvedValueOnce(mockScore)
        .mockResolvedValueOnce(updatedScore);
      mockScoreRepository.save.mockResolvedValue(updatedScore);

      const result = await service.update(
        "project-1",
        "score-1",
        updateDto,
        "user-1",
        "org-1",
      );

      expect(mockScoreRepository.findOne).toHaveBeenCalledTimes(2);
      expect(mockScoreRepository.save).toHaveBeenCalled();
      expect(mockAuditService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "score.updated",
          actorId: "user-1",
          resourceType: "score",
          resourceId: "score-1",
          organisationId: "org-1",
          projectId: "project-1",
          metadata: expect.objectContaining({
            changedFields: ["name"],
            organisationId: "org-1",
            projectId: "project-1",
          }),
        }),
      );
      expect(result.name).toBe("Updated Score");
    });

    it("should throw NotFoundException when score not found", async () => {
      const updateDto: UpdateScoreRequestDto = {
        name: "Updated Score",
      };
      mockScoreRepository.findOne.mockResolvedValue(null);

      await expect(
        service.update(
          "project-1",
          "non-existent",
          updateDto,
          "user-1",
          "org-1",
        ),
      ).rejects.toThrow(NotFoundException);
      expect(mockScoreRepository.save).not.toHaveBeenCalled();
    });

    it("should throw BadRequestException when trying to update global score", async () => {
      const updateDto: UpdateScoreRequestDto = {
        name: "Updated Score",
      };
      mockScoreRepository.findOne.mockResolvedValue(mockGlobalScore);

      await expect(
        service.update(
          "project-1",
          "global-score-1",
          updateDto,
          "user-1",
          "org-1",
        ),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.update(
          "project-1",
          "global-score-1",
          updateDto,
          "user-1",
          "org-1",
        ),
      ).rejects.toThrow("Global scores cannot be updated");
    });

    it("should update evaluator prompt", async () => {
      const updateDto: UpdateScoreRequestDto = {
        evaluatorPromptId: "prompt-2",
      };
      const newPrompt = { ...mockPrompt, id: "prompt-2" };
      const updatedScore = { ...mockScore, evaluatorPrompt: newPrompt };
      mockScoreRepository.findOne
        .mockResolvedValueOnce(mockScore)
        .mockResolvedValueOnce(updatedScore);
      mockPromptRepository.findOne.mockResolvedValue(newPrompt);
      mockScoreRepository.save.mockResolvedValue(updatedScore);

      const result = await service.update(
        "project-1",
        "score-1",
        updateDto,
        "user-1",
        "org-1",
      );

      expect(mockPromptRepository.findOne).toHaveBeenCalledWith({
        where: { id: "prompt-2" },
      });
      expect(result.evaluatorPrompt?.id).toBe("prompt-2");
    });

    it("should remove evaluator prompt when set to null", async () => {
      const updateDto: UpdateScoreRequestDto = {
        evaluatorPromptId: null,
      };
      const updatedScore = {
        ...mockScore,
        evaluatorPrompt: null,
        evaluatorPromptId: null,
      };
      mockScoreRepository.findOne
        .mockResolvedValueOnce(mockScore)
        .mockResolvedValueOnce(updatedScore);
      mockScoreRepository.save.mockResolvedValue(updatedScore);

      const result = await service.update(
        "project-1",
        "score-1",
        updateDto,
        "user-1",
        "org-1",
      );

      expect(mockPromptRepository.findOne).not.toHaveBeenCalled();
      expect(result.evaluatorPrompt).toBeNull();
    });
  });

  describe("remove", () => {
    it("should remove a score successfully", async () => {
      mockScoreRepository.findOne.mockResolvedValue(mockScore);
      mockScoreRepository.remove.mockResolvedValue(mockScore);

      await service.remove("project-1", "score-1", "user-1", "org-1");

      expect(mockScoreRepository.findOne).toHaveBeenCalledWith({
        where: [
          { id: "score-1", projectId: "project-1" },
          { id: "score-1", projectId: IsNull() },
        ],
      });
      expect(mockScoreRepository.remove).toHaveBeenCalledWith(mockScore);
      expect(mockAuditService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "score.deleted",
          actorId: "user-1",
          resourceType: "score",
          resourceId: "score-1",
          organisationId: "org-1",
          projectId: "project-1",
          beforeState: expect.any(Object),
          afterState: null,
          metadata: { organisationId: "org-1", projectId: "project-1" },
        }),
      );
    });

    it("should throw NotFoundException when score not found", async () => {
      mockScoreRepository.findOne.mockResolvedValue(null);

      await expect(
        service.remove("project-1", "non-existent", "user-1", "org-1"),
      ).rejects.toThrow(NotFoundException);
      expect(mockScoreRepository.remove).not.toHaveBeenCalled();
    });

    it("should throw BadRequestException when trying to delete RAGAS score", async () => {
      mockScoreRepository.findOne.mockResolvedValue(mockGlobalScore);

      await expect(
        service.remove("project-1", "global-score-1", "user-1", "org-1"),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.remove("project-1", "global-score-1", "user-1", "org-1"),
      ).rejects.toThrow("Ragas scores cannot be deleted");
      expect(mockScoreRepository.remove).not.toHaveBeenCalled();
    });
  });
});
