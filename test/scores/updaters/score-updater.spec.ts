import { BadRequestException } from "@nestjs/common";
import { ScoreUpdater } from "../../../src/scores/updaters/score-updater";
import { Score, ScoringType } from "../../../src/scores/entities/score.entity";
import { UpdateScoreRequestDto } from "../../../src/scores/dto/request/update-score-request.dto";

describe("ScoreUpdater", () => {
  describe("apply", () => {
    it("should update basic fields", () => {
      const score: Score = {
        id: "score-1",
        name: "Old Name",
        description: "Old Description",
        scoringType: ScoringType.NUMERIC,
      } as Score;
      const dto: UpdateScoreRequestDto = {
        name: "New Name",
        description: "New Description",
      };

      ScoreUpdater.apply(score, dto);

      expect(score.name).toBe("New Name");
      expect(score.description).toBe("New Description");
    });

    it("should update scale for nominal scores", () => {
      const score: Score = {
        id: "score-1",
        scoringType: ScoringType.NOMINAL,
        scale: null,
      } as Score;
      const dto: UpdateScoreRequestDto = {
        scale: [
          { label: "Option 1", value: 1 },
          { label: "Option 2", value: 2 },
        ],
      };

      ScoreUpdater.apply(score, dto);

      expect(score.scale).toEqual(dto.scale);
    });

    it("should update scale for ordinal scores", () => {
      const score: Score = {
        id: "score-1",
        scoringType: ScoringType.ORDINAL,
        scale: null,
      } as Score;
      const dto: UpdateScoreRequestDto = {
        scale: [
          { label: "Poor", value: 1 },
          { label: "Good", value: 2 },
        ],
      };

      ScoreUpdater.apply(score, dto);

      expect(score.scale).toEqual(dto.scale);
    });

    it("should throw BadRequestException when updating scale for non-nominal/ordinal scores", () => {
      const score: Score = {
        id: "score-1",
        scoringType: ScoringType.NUMERIC,
        scale: null,
      } as Score;
      const dto: UpdateScoreRequestDto = {
        scale: [{ label: "Option 1", value: 1 }],
      };

      expect(() => ScoreUpdater.apply(score, dto)).toThrow(BadRequestException);
      expect(() => ScoreUpdater.apply(score, dto)).toThrow(
        "Scale can only be updated for nominal or ordinal scores",
      );
    });

    it("should throw BadRequestException when updating scale with empty array for numeric scores", () => {
      const score: Score = {
        id: "score-1",
        scoringType: ScoringType.NUMERIC,
        scale: null,
      } as Score;
      const dto: UpdateScoreRequestDto = {
        scale: [],
      };

      expect(() => ScoreUpdater.apply(score, dto)).toThrow(BadRequestException);
      expect(() => ScoreUpdater.apply(score, dto)).toThrow(
        "Scale can only be updated for nominal or ordinal scores",
      );
    });

    it("should throw BadRequestException when updating scale with empty array for nominal scores", () => {
      const score: Score = {
        id: "score-1",
        scoringType: ScoringType.NOMINAL,
        scale: [{ label: "Option 1", value: 1 }],
      } as Score;
      const dto: UpdateScoreRequestDto = {
        scale: [],
      };

      expect(() => ScoreUpdater.apply(score, dto)).toThrow(BadRequestException);
      expect(() => ScoreUpdater.apply(score, dto)).toThrow(
        "Scale must contain at least 1 elements",
      );
    });

    it("should throw BadRequestException when updating scale with empty array for ordinal scores", () => {
      const score: Score = {
        id: "score-1",
        scoringType: ScoringType.ORDINAL,
        scale: [
          { label: "Poor", value: 1 },
          { label: "Good", value: 2 },
        ],
      } as Score;
      const dto: UpdateScoreRequestDto = {
        scale: [],
      };

      expect(() => ScoreUpdater.apply(score, dto)).toThrow(BadRequestException);
      expect(() => ScoreUpdater.apply(score, dto)).toThrow(
        "Scale must contain at least 1 elements",
      );
    });

    it("should allow scale to be null for nominal scores", () => {
      const score: Score = {
        id: "score-1",
        scoringType: ScoringType.NOMINAL,
        scale: [{ label: "Option 1", value: 1 }],
      } as Score;
      const dto: UpdateScoreRequestDto = {
        scale: null,
      };

      ScoreUpdater.apply(score, dto);

      expect(score.scale).toBeNull();
    });

    it("should allow scale to be null for ordinal scores", () => {
      const score: Score = {
        id: "score-1",
        scoringType: ScoringType.ORDINAL,
        scale: [{ label: "Poor", value: 1 }],
      } as Score;
      const dto: UpdateScoreRequestDto = {
        scale: null,
      };

      ScoreUpdater.apply(score, dto);

      expect(score.scale).toBeNull();
    });

    it("should not update scale when scale is undefined", () => {
      const originalScale = [{ label: "Option 1", value: 1 }];
      const score: Score = {
        id: "score-1",
        scoringType: ScoringType.NOMINAL,
        scale: originalScale,
      } as Score;
      const dto: UpdateScoreRequestDto = {
        name: "Updated Name",
      };

      ScoreUpdater.apply(score, dto);

      expect(score.scale).toEqual(originalScale);
      expect(score.name).toBe("Updated Name");
    });

    it("should update ordinalConfig for ordinal scores", () => {
      const score: Score = {
        id: "score-1",
        scoringType: ScoringType.ORDINAL,
        ordinalConfig: null,
      } as Score;
      const dto: UpdateScoreRequestDto = {
        ordinalConfig: {
          acceptable_set: ["good", "excellent"],
          threshold_rank: 2,
        },
      };

      ScoreUpdater.apply(score, dto);

      expect(score.ordinalConfig).toEqual(dto.ordinalConfig);
    });

    it("should throw BadRequestException when updating ordinalConfig with object for non-ordinal scores", () => {
      const score: Score = {
        id: "score-1",
        scoringType: ScoringType.NOMINAL,
        ordinalConfig: null,
      } as Score;
      const dto: UpdateScoreRequestDto = {
        ordinalConfig: {
          acceptable_set: ["good"],
        },
      };

      expect(() => ScoreUpdater.apply(score, dto)).toThrow(BadRequestException);
      expect(() => ScoreUpdater.apply(score, dto)).toThrow(
        "OrdinalConfig can only be updated for ordinal scores",
      );
    });

    it("should ignore null ordinalConfig for numeric scores", () => {
      const score: Score = {
        id: "score-1",
        scoringType: ScoringType.NUMERIC,
        ordinalConfig: null,
      } as Score;
      const dto: UpdateScoreRequestDto = {
        name: "Updated Name",
        ordinalConfig: null,
      };

      ScoreUpdater.apply(score, dto);

      expect(score.name).toBe("Updated Name");
      expect(score.ordinalConfig).toBeNull();
    });

    it("should ignore null ordinalConfig for nominal scores", () => {
      const score: Score = {
        id: "score-1",
        scoringType: ScoringType.NOMINAL,
        ordinalConfig: null,
      } as Score;
      const dto: UpdateScoreRequestDto = {
        name: "Updated Name",
        ordinalConfig: null,
      };

      ScoreUpdater.apply(score, dto);

      expect(score.name).toBe("Updated Name");
      expect(score.ordinalConfig).toBeNull();
    });

    it("should not update ordinalConfig when ordinalConfig is undefined", () => {
      const originalOrdinalConfig = {
        acceptable_set: ["good"],
      };
      const score: Score = {
        id: "score-1",
        scoringType: ScoringType.ORDINAL,
        ordinalConfig: originalOrdinalConfig,
      } as Score;
      const dto: UpdateScoreRequestDto = {
        name: "Updated Name",
      };

      ScoreUpdater.apply(score, dto);

      expect(score.ordinalConfig).toEqual(originalOrdinalConfig);
      expect(score.name).toBe("Updated Name");
    });

    it("should set ordinalConfig to null when provided as null", () => {
      const score: Score = {
        id: "score-1",
        scoringType: ScoringType.ORDINAL,
        ordinalConfig: {
          acceptable_set: ["good"],
        },
      } as Score;
      const dto: UpdateScoreRequestDto = {
        ordinalConfig: null,
      };

      ScoreUpdater.apply(score, dto);

      expect(score.ordinalConfig).toBeNull();
    });

    it("should handle partial updates", () => {
      const score: Score = {
        id: "score-1",
        name: "Old Name",
        description: "Old Description",
        scoringType: ScoringType.NUMERIC,
      } as Score;
      const dto: UpdateScoreRequestDto = {
        name: "New Name",
      };

      ScoreUpdater.apply(score, dto);

      expect(score.name).toBe("New Name");
      expect(score.description).toBe("Old Description");
    });

    it("should not update fields that are undefined", () => {
      const score: Score = {
        id: "score-1",
        name: "Old Name",
        description: "Old Description",
        scoringType: ScoringType.NUMERIC,
      } as Score;
      const dto: UpdateScoreRequestDto = {};

      ScoreUpdater.apply(score, dto);

      expect(score.name).toBe("Old Name");
      expect(score.description).toBe("Old Description");
    });
  });
});
