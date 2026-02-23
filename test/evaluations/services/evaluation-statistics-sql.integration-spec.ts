import { Test } from "@nestjs/testing";
import { ConfigModule } from "@nestjs/config";
import { TypeOrmModule } from "@nestjs/typeorm";
import {
  getTestDataSource,
  startTestDatabase,
  stopTestDatabase,
} from "../../setup-testcontainers";
import { EvaluationStatisticsSqlService } from "../../../src/evaluations/services/statistics/evaluation-statistics-sql.service";
import { ScoreResult } from "../../../src/evaluations/entities/score-result.entity";
import { Evaluation } from "../../../src/evaluations/entities/evaluation.entity";
import { Score } from "../../../src/scores/entities/score.entity";
import { DataSource } from "typeorm";
import { seedDatasetEvaluationWithScoreResults } from "../helpers/evaluation-seed.helper";
import { ScoringType } from "../../../src/scores/entities/score.entity";

jest.setTimeout(60_000);

describe("EvaluationStatisticsSqlService (integration)", () => {
  let service: EvaluationStatisticsSqlService;
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
        TypeOrmModule.forFeature([ScoreResult, Evaluation, Score]),
      ],

      providers: [EvaluationStatisticsSqlService],
    }).compile();

    service = moduleRef.get(EvaluationStatisticsSqlService);
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

  it("getNumericCountAndPercentiles returns correct count and percentiles", async () => {
    const { evaluationId, scoreId } =
      await seedDatasetEvaluationWithScoreResults(dataSource, {
        scoringType: "NUMERIC",
        numericValues: [1, 2, 3, 4, 5],
      });

    const result = await service.getNumericCountAndPercentiles(
      evaluationId,
      scoreId,
    );

    expect(result.nScored).toBe(5);
    expect(result.nTotal).toBe(5);
    expect(result.p50).toBeCloseTo(3, 1);
    expect(result.p10).toBeDefined();
    expect(result.p90).toBeDefined();
  });

  it("getNumericCountAndPercentiles returns null percentiles for empty evaluation", async () => {
    const { evaluationId, scoreId } =
      await seedDatasetEvaluationWithScoreResults(dataSource, {
        scoringType: "NUMERIC",
        numericValues: [],
      });

    const result = await service.getNumericCountAndPercentiles(
      evaluationId,
      scoreId,
    );

    expect(result.nScored).toBe(0);
    expect(result.p10).toBeNull();
    expect(result.p50).toBeNull();
    expect(result.p90).toBeNull();
  });

  it("getOrdinalAggregates returns CDF and percentiles for ordinal score", async () => {
    const scale = [
      { label: "Bad", value: 1 },
      { label: "Ok", value: 2 },
      { label: "Good", value: 3 },
    ];

    const { evaluationId, scoreId } =
      await seedDatasetEvaluationWithScoreResults(dataSource, {
        scoringType: "ORDINAL",
        ordinalValues: ["Bad", "Ok", "Ok", "Good"],
        scale,
      });

    const result = await service.getOrdinalAggregates(
      evaluationId,
      scoreId,
      scale,
      null,
    );

    expect(result.nScored).toBe(4);
    expect(result.cdf).toBeDefined();
    expect(result.p50).toBe("Ok");
    expect(result.iqrRank).toBeDefined();
  });

  it("getOrdinalAggregates returns pass rate when configured", async () => {
    const scale = [
      { label: "Bad", value: 1 },
      { label: "Ok", value: 2 },
      { label: "Good", value: 3 },
    ];

    const { evaluationId, scoreId } =
      await seedDatasetEvaluationWithScoreResults(dataSource, {
        scoringType: "ORDINAL",
        ordinalValues: ["Bad", "Ok", "Good", "Good"],
        scale,
        ordinalConfig: {
          acceptable_set: ["Ok", "Good"],
        },
      });

    const result = await service.getOrdinalAggregates(
      evaluationId,
      scoreId,
      scale,
      { acceptable_set: ["Ok", "Good"] },
    );

    expect(result.passRate).toBeDefined();
    expect(result.passRate?.acceptableCount).toBe(3);
    expect(result.passRate?.totalScored).toBe(4);
  });
});
