import "reflect-metadata";
import { Test } from "@nestjs/testing";
import {
  CanActivate,
  ExecutionContext,
  INestApplication,
} from "@nestjs/common";
import {
  getTestDataSource,
  startTestDatabase,
  stopTestDatabase,
} from "../setup/setup-testcontainers";
import request from "supertest";
import { AppModule } from "../../src/app.module";
import { OrgProjectPermissionGuard } from "../../src/rbac/guards/org-project-permission.guard";
import { DataSource } from "typeorm";
import {
  seedDatasetEvaluationWithScoreResults,
  truncateEvaluationTables,
} from "./helpers/evaluation-seed.helper";

jest.setTimeout(60_000);

const e2eBypassGuard: CanActivate = () => true;

describe("Evaluations – dataset statistics (E2E)", () => {
  let app: INestApplication;
  let dataSource: DataSource;

  beforeAll(async () => {
    await startTestDatabase();
    dataSource = getTestDataSource();

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideGuard(OrgProjectPermissionGuard)
      .useValue(e2eBypassGuard)
      .compile();

    app = moduleRef.createNestApplication();
    await app.init();
  }, 60_000);

  afterAll(async () => {
    await app?.close();
    await stopTestDatabase();
  });

  beforeEach(async () => {
    await truncateEvaluationTables(dataSource);
  });

  it("returns nominal statistics for dataset-scoped evaluation", async () => {
    const { organisationId, projectId, evaluationId } =
      await seedDatasetEvaluationWithScoreResults(dataSource, {
        scoringType: "NOMINAL",
        nominalValues: ["A", "B", "A", "C"],
      });

    const { body, status } = await request(app.getHttpServer())
      .get(
        `/v1/organisations/${organisationId}/projects/${projectId}/evaluations/${evaluationId}/datasets/statistics`,
      )
      .expect(200);

    expect(status).toBe(200);
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBeGreaterThanOrEqual(1);
    const nominalStat = body.find((s: any) => s.nominal);
    expect(nominalStat).toBeDefined();

    expect(nominalStat.nominal.counts_by_code).toEqual({
      "1": 2,
      "2": 1,
      "3": 1,
    });
    expect(nominalStat.nominal.mode_code).toBe("1");
    expect(nominalStat.nominal.n_scored).toBe(4);
  });

  it("returns numeric statistics with mean and percentiles", async () => {
    const { organisationId, projectId, evaluationId } =
      await seedDatasetEvaluationWithScoreResults(dataSource, {
        scoringType: "NUMERIC",
        numericValues: [1, 2, 3, 4, 5],
      });

    const { body, status } = await request(app.getHttpServer())
      .get(
        `/v1/organisations/${organisationId}/projects/${projectId}/evaluations/${evaluationId}/datasets/statistics`,
      )
      .expect(200);

    expect(status).toBe(200);
    const numericStat = body.find((s: any) => s.numeric);
    expect(numericStat).toBeDefined();
    expect(numericStat.numeric.mean).toBeCloseTo(3, 5);
    expect(numericStat.numeric.n_scored).toBe(5);
    expect(numericStat.numeric.p50).toBeDefined();
    expect(numericStat.numeric.p10).toBeDefined();
    expect(numericStat.numeric.p90).toBeDefined();
  });

  it("returns ordinal statistics with CDF and percentiles", async () => {
    const scale = [
      { label: "Bad", value: 1 },
      { label: "Ok", value: 2 },
      { label: "Good", value: 3 },
    ];

    const { organisationId, projectId, evaluationId } =
      await seedDatasetEvaluationWithScoreResults(dataSource, {
        scoringType: "ORDINAL",
        ordinalValues: ["Bad", "Ok", "Ok", "Good"],
        scale,
      });

    const { body, status } = await request(app.getHttpServer())
      .get(
        `/v1/organisations/${organisationId}/projects/${projectId}/evaluations/${evaluationId}/datasets/statistics`,
      )
      .expect(200);

    expect(status).toBe(200);
    const ordinalStat = body.find((s: any) => s.ordinal);
    expect(ordinalStat).toBeDefined();
    expect(ordinalStat.ordinal.percentile_categories).toBeDefined();
    expect(ordinalStat.ordinal.cdf).toBeDefined();
    expect(ordinalStat.ordinal.n_scored).toBe(4);
  });
});
