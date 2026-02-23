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
import { ScoresController } from "../../../src/scores/controllers/scores.controller";
import { ScoresService } from "../../../src/scores/services/scores.service";
import { CreateScoreRequestDto } from "../../../src/scores/dto/request/create-score-request.dto";
import { UpdateScoreRequestDto } from "../../../src/scores/dto/request/update-score-request.dto";
import { ScoreResponseDto } from "../../../src/scores/dto/response/score-response.dto";
import { ScoringType } from "../../../src/scores/entities/score.entity";

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

describe("ScoresController", () => {
  let controller: ScoresController;
  let scoresService: ScoresService;

  const mockScoresService = {
    create: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
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

  const mockScoreResponseDto: ScoreResponseDto = {
    id: "score-1",
    projectId: "project-1",
    name: "Test Score",
    description: "Test Description",
    scoringType: ScoringType.NUMERIC,
    scale: null,
    ordinalConfig: null,
    ragasScoreKey: null,
    evaluatorPrompt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ScoresController],
      providers: [
        {
          provide: ScoresService,
          useValue: mockScoresService,
        },
      ],
    }).compile();

    controller = module.get<ScoresController>(ScoresController);
    scoresService = module.get<ScoresService>(ScoresService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("create", () => {
    it("should create a score", async () => {
      const createDto: CreateScoreRequestDto = {
        name: "Test Score",
        scoringType: ScoringType.NUMERIC,
      };
      mockScoresService.create.mockResolvedValue(mockScoreResponseDto);

      const result = await controller.create(
        "org-1",
        "project-1",
        createDto,
        mockUserSession,
      );

      expect(result).toEqual(mockScoreResponseDto);
      expect(scoresService.create).toHaveBeenCalledWith(
        "project-1",
        createDto,
        mockUserSession.user.id,
        "org-1",
      );
    });
  });

  describe("findAll", () => {
    it("should return all scores for a project", async () => {
      mockScoresService.findAll.mockResolvedValue([mockScoreResponseDto]);

      const result = await controller.findAll("project-1");

      expect(result).toEqual([mockScoreResponseDto]);
      expect(scoresService.findAll).toHaveBeenCalledWith("project-1");
    });
  });

  describe("findOne", () => {
    it("should return a score by id", async () => {
      mockScoresService.findOne.mockResolvedValue(mockScoreResponseDto);

      const result = await controller.findOne("project-1", "score-1");

      expect(result).toEqual(mockScoreResponseDto);
      expect(scoresService.findOne).toHaveBeenCalledWith(
        "project-1",
        "score-1",
      );
    });
  });

  describe("update", () => {
    it("should update a score", async () => {
      const updateDto: UpdateScoreRequestDto = {
        name: "Updated Score",
      };
      const updatedScore = { ...mockScoreResponseDto, name: "Updated Score" };
      mockScoresService.update.mockResolvedValue(updatedScore);

      const result = await controller.update(
        "org-1",
        "project-1",
        "score-1",
        updateDto,
        mockUserSession,
      );

      expect(result).toEqual(updatedScore);
      expect(scoresService.update).toHaveBeenCalledWith(
        "project-1",
        "score-1",
        updateDto,
        mockUserSession.user.id,
        "org-1",
      );
    });
  });

  describe("remove", () => {
    it("should remove a score", async () => {
      mockScoresService.remove.mockResolvedValue(undefined);

      await controller.remove("org-1", "project-1", "score-1", mockUserSession);

      expect(scoresService.remove).toHaveBeenCalledWith(
        "project-1",
        "score-1",
        mockUserSession.user.id,
        "org-1",
      );
    });
  });
});
