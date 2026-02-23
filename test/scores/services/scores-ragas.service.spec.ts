import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { Repository, IsNull } from "typeorm";
import { ScoresRagasService } from "../../../src/scores/services/scores-ragas.service";
import { Score, ScoringType } from "../../../src/scores/entities/score.entity";
import { RAGAS_SCORES } from "../../../src/scores/constants/ragas.constants";

describe("ScoresRagasService", () => {
  let service: ScoresRagasService;
  let scoreRepository: Repository<Score>;

  const mockScoreRepository = {
    find: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ScoresRagasService,
        {
          provide: getRepositoryToken(Score),
          useValue: mockScoreRepository,
        },
      ],
    }).compile();

    service = module.get<ScoresRagasService>(ScoresRagasService);
    scoreRepository = module.get<Repository<Score>>(getRepositoryToken(Score));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("upsertGlobalRagasScores", () => {
    it("should create new RAGAS scores when none exist", async () => {
      mockScoreRepository.find.mockResolvedValue([]);
      const ragasScoreEntries = Object.entries(RAGAS_SCORES);
      const createdScores = ragasScoreEntries.map(([name, ragasScore]) => ({
        id: `score-${name}`,
        name,
        description: `Ragas metric: ${name}`,
        scoringType: ScoringType.RAGAS,
        ragasScoreKey: ragasScore.id,
        projectId: null,
      }));
      mockScoreRepository.create.mockImplementation((data) => data);
      mockScoreRepository.save.mockResolvedValue(createdScores);

      await service.upsertGlobalRagasScores();

      expect(mockScoreRepository.find).toHaveBeenCalledWith({
        where: {
          projectId: IsNull(),
          scoringType: ScoringType.RAGAS,
        },
      });
      expect(mockScoreRepository.create).toHaveBeenCalledTimes(
        ragasScoreEntries.length,
      );
      expect(mockScoreRepository.save).toHaveBeenCalled();
    });

    it("should update existing RAGAS scores", async () => {
      const ragasScoreEntries = Object.entries(RAGAS_SCORES);
      const firstRagasKey = ragasScoreEntries[0][1].id;
      const existingScore: Score = {
        id: "existing-score-1",
        name: "Old Name",
        description: "Old Description",
        scoringType: ScoringType.RAGAS,
        ragasScoreKey: firstRagasKey,
        projectId: null,
      } as Score;
      mockScoreRepository.find.mockResolvedValue([existingScore]);

      mockScoreRepository.create.mockImplementation((data) => ({
        ...data,
        ragasScoreKey: data.ragasScoreKey,
      }));

      const allScores = ragasScoreEntries.map(([name, ragasScore]) => {
        if (ragasScore.id === firstRagasKey) {
          existingScore.name = name;
          existingScore.description = `Ragas metric: ${name}`;
          return existingScore;
        }

        return {
          id: `score-${name}`,
          name,
          description: `Ragas metric: ${name}`,
          scoringType: ScoringType.RAGAS,
          ragasScoreKey: ragasScore.id,
          projectId: null,
        };
      });
      mockScoreRepository.save.mockResolvedValue(allScores);

      await service.upsertGlobalRagasScores();

      expect(mockScoreRepository.find).toHaveBeenCalled();
      expect(mockScoreRepository.create).toHaveBeenCalledTimes(
        ragasScoreEntries.length - 1,
      );
      expect(mockScoreRepository.save).toHaveBeenCalled();
    });

    it("should create new scores and update existing ones", async () => {
      const ragasScoreEntries = Object.entries(RAGAS_SCORES);
      const firstRagasKey = ragasScoreEntries[0][1].id;
      const existingScore: Score = {
        id: "existing-score-1",
        name: "Old Name",
        description: "Old Description",
        scoringType: ScoringType.RAGAS,
        ragasScoreKey: firstRagasKey,
        projectId: null,
      } as Score;
      mockScoreRepository.find.mockResolvedValue([existingScore]);
      const updatedScore = {
        ...existingScore,
        name: ragasScoreEntries[0][0],
        description: `Ragas metric: ${ragasScoreEntries[0][0]}`,
      };
      const newScores = ragasScoreEntries
        .slice(1)
        .map(([name, ragasScore]) => ({
          id: `score-${name}`,
          name,
          description: `Ragas metric: ${name}`,
          scoringType: ScoringType.RAGAS,
          ragasScoreKey: ragasScore.id,
          projectId: null,
        }));
      mockScoreRepository.create.mockImplementation((data) => data);
      mockScoreRepository.save.mockResolvedValue([updatedScore, ...newScores]);

      await service.upsertGlobalRagasScores();

      expect(mockScoreRepository.create).toHaveBeenCalledTimes(
        ragasScoreEntries.length - 1,
      );
      expect(mockScoreRepository.save).toHaveBeenCalled();
    });

    it("should handle case when all scores already exist", async () => {
      const ragasScoreEntries = Object.entries(RAGAS_SCORES);
      const existingScores = ragasScoreEntries.map(([name, ragasScore]) => ({
        id: `score-${name}`,
        name,
        description: `Ragas metric: ${name}`,
        scoringType: ScoringType.RAGAS,
        ragasScoreKey: ragasScore.id,
        projectId: null,
      }));
      mockScoreRepository.find.mockResolvedValue(existingScores);
      const updatedScores = existingScores.map((score) => ({
        ...score,
        name: score.name,
        description: `Ragas metric: ${score.name}`,
      }));
      mockScoreRepository.save.mockResolvedValue(updatedScores);

      await service.upsertGlobalRagasScores();

      expect(mockScoreRepository.find).toHaveBeenCalled();
      expect(mockScoreRepository.create).not.toHaveBeenCalled();
      expect(mockScoreRepository.save).toHaveBeenCalledWith(updatedScores);
    });
  });

  describe("onModuleInit", () => {
    it("should call upsertGlobalRagasScores on module init", async () => {
      mockScoreRepository.find.mockResolvedValue([]);
      mockScoreRepository.create.mockImplementation((data) => data);
      mockScoreRepository.save.mockResolvedValue([]);

      await service.onModuleInit();

      expect(mockScoreRepository.find).toHaveBeenCalled();
    });

    it("should handle errors gracefully during module init", async () => {
      const error = new Error("Database error");
      mockScoreRepository.find.mockRejectedValue(error);

      await expect(service.onModuleInit()).resolves.not.toThrow();
    });
  });
});
