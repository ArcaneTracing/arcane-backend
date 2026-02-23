import { Test } from "@nestjs/testing";
import { ConfigModule } from "@nestjs/config";
import { TypeOrmModule } from "@nestjs/typeorm";
import {
  getTestDataSource,
  startTestDatabase,
  stopTestDatabase,
} from "../../setup-testcontainers";
import { EvaluationStatisticsStreamingService } from "../../../src/evaluations/services/statistics/evaluation-statistics-streaming.service";
import { ScoreResult } from "../../../src/evaluations/entities/score-result.entity";
import { DataSource } from "typeorm";
import { seedDatasetEvaluationWithScoreResults } from "../helpers/evaluation-seed.helper";

jest.setTimeout(60_000);

describe("EvaluationStatisticsStreamingService (integration)", () => {
  let service: EvaluationStatisticsStreamingService;
  let dataSource: DataSource;

  beforeAll(async () => {
    await startTestDatabase();
    dataSource = getTestDataSource();

    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        TypeOrmModule.forRoot({
          type: "postgres",
          url: process.env.DATABASE_URL,
          entities: [__dirname + "/../../../src/**/*.entity{.ts,.js}"],
          synchronize: false,
          logging: false,
        }),
        TypeOrmModule.forFeature([ScoreResult]),
      ],

      providers: [EvaluationStatisticsStreamingService],
    }).compile();

    service = moduleRef.get(EvaluationStatisticsStreamingService);
  });

  afterAll(async () => {
    await stopTestDatabase();
  });

  beforeEach(async () => {
    await dataSource.query("TRUNCATE TABLE score_results CASCADE");
    await dataSource.query("TRUNCATE TABLE evaluation_scores CASCADE");
    await dataSource.query("TRUNCATE TABLE evaluations CASCADE");
    await dataSource.query("TRUNCATE TABLE scores CASCADE");
    await dataSource.query("TRUNCATE TABLE dataset_rows CASCADE");
    await dataSource.query("TRUNCATE TABLE datasets CASCADE");
    await dataSource.query("TRUNCATE TABLE projects CASCADE");
    await dataSource.query("TRUNCATE TABLE organisations CASCADE");
  });

  it("aggregateNominalFromStream returns correct counts and mode", async () => {
    const { evaluationId, scoreId } =
      await seedDatasetEvaluationWithScoreResults(dataSource, {
        scoringType: "NOMINAL",
        nominalValues: ["A", "B", "A", "C"],
      });

    const result = await service.aggregateNominalFromStream(
      evaluationId,
      scoreId,
    );

    expect(result.countsByCode).toEqual({ A: 2, B: 1, C: 1 });
    expect(result.nScored).toBe(4);
    expect(result.nTotal).toBe(4);
    expect(result.modeCode).toBe("A");
  });

  it("aggregateNominalFromStream handles empty evaluation", async () => {
    const { evaluationId, scoreId } =
      await seedDatasetEvaluationWithScoreResults(dataSource, {
        scoringType: "NOMINAL",
        nominalValues: [],
      });

    const result = await service.aggregateNominalFromStream(
      evaluationId,
      scoreId,
    );

    expect(result.countsByCode).toEqual({});
    expect(result.nScored).toBe(0);
    expect(result.modeCode).toBeNull();
  });

  it("aggregateNumericFromStream returns correct mean and variance", async () => {
    const { evaluationId, scoreId } =
      await seedDatasetEvaluationWithScoreResults(dataSource, {
        scoringType: "NUMERIC",
        numericValues: [1, 2, 3, 4, 5],
      });

    const result = await service.aggregateNumericFromStream(
      evaluationId,
      scoreId,
    );

    expect(result.mean).toBeCloseTo(3, 5);
    expect(result.variance).toBeGreaterThan(0);
    expect(result.std).toBeGreaterThan(0);
    expect(Math.sqrt(result.variance)).toBeCloseTo(result.std, 5);
  });

  it("aggregateNumericFromStream handles empty evaluation", async () => {
    const { evaluationId, scoreId } =
      await seedDatasetEvaluationWithScoreResults(dataSource, {
        scoringType: "NUMERIC",
        numericValues: [],
      });

    const result = await service.aggregateNumericFromStream(
      evaluationId,
      scoreId,
    );

    expect(result.mean).toBe(0);
    expect(result.variance).toBe(0);
    expect(result.std).toBe(0);
  });
});
