import "reflect-metadata";
import { Test } from "@nestjs/testing";
import { CanActivate, INestApplication } from "@nestjs/common";
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
import {
  NUMERIC_VALUES_150,
  NOMINAL_VALUES_150,
  ORDINAL_VALUES_150,
  ORDINAL_SCALE,
  ORDINAL_CONFIG,
  EXPECTED_NUMERIC_STATS,
  EXPECTED_NOMINAL_STATS,
  EXPECTED_ORDINAL_STATS,
} from "./fixtures/statistics-comparison.constants";

jest.setTimeout(90_000);

const e2eBypassGuard: CanActivate = () => true;

describe("Evaluations – dataset statistics deterministic (E2E)", () => {
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
  }, 90_000);

  afterAll(async () => {
    await app?.close();
    await stopTestDatabase();
  });

  beforeEach(async () => {
    await truncateEvaluationTables(dataSource);
  });

  it("returns exact numeric statistics for 150 samples", async () => {
    const { organisationId, projectId, evaluationId } =
      await seedDatasetEvaluationWithScoreResults(dataSource, {
        scoringType: "NUMERIC",
        numericValues: NUMERIC_VALUES_150,
        numRows: 150,
      });

    const { body } = await request(app.getHttpServer())
      .get(
        `/v1/organisations/${organisationId}/projects/${projectId}/evaluations/${evaluationId}/datasets/statistics`,
      )
      .expect(200);

    const numericStat = body.find((s: { numeric?: unknown }) => s.numeric);
    expect(numericStat).toBeDefined();
    expect(numericStat.numeric.mean).toBeCloseTo(
      EXPECTED_NUMERIC_STATS.mean,
      5,
    );
    expect(numericStat.numeric.variance).toBeCloseTo(
      EXPECTED_NUMERIC_STATS.variance,
      5,
    );
    expect(numericStat.numeric.std).toBeCloseTo(EXPECTED_NUMERIC_STATS.std, 5);
    expect(numericStat.numeric.n_scored).toBe(EXPECTED_NUMERIC_STATS.n_scored);
    expect(numericStat.numeric.p50).toBe(EXPECTED_NUMERIC_STATS.p50);
    expect(numericStat.numeric.p10).toBe(EXPECTED_NUMERIC_STATS.p10);
    expect(numericStat.numeric.p90).toBe(EXPECTED_NUMERIC_STATS.p90);
    expect(numericStat.numeric.ci95_mean.lower).toBeCloseTo(
      EXPECTED_NUMERIC_STATS.ci95_mean.lower,
      5,
    );
    expect(numericStat.numeric.ci95_mean.upper).toBeCloseTo(
      EXPECTED_NUMERIC_STATS.ci95_mean.upper,
      5,
    );
  });

  it("returns exact nominal statistics for 150 samples", async () => {
    const { organisationId, projectId, evaluationId } =
      await seedDatasetEvaluationWithScoreResults(dataSource, {
        scoringType: "NOMINAL",
        nominalValues: NOMINAL_VALUES_150,
        numRows: 150,
      });

    const { body } = await request(app.getHttpServer())
      .get(
        `/v1/organisations/${organisationId}/projects/${projectId}/evaluations/${evaluationId}/datasets/statistics`,
      )
      .expect(200);

    const nominalStat = body.find((s: { nominal?: unknown }) => s.nominal);
    expect(nominalStat).toBeDefined();
    expect(nominalStat.nominal.counts_by_code).toEqual(
      EXPECTED_NOMINAL_STATS.counts_by_code,
    );
    expect(nominalStat.nominal.mode_code).toBe(
      EXPECTED_NOMINAL_STATS.mode_code,
    );
    expect(nominalStat.nominal.n_scored).toBe(EXPECTED_NOMINAL_STATS.n_scored);
    expect(nominalStat.nominal.num_distinct_categories).toBe(
      EXPECTED_NOMINAL_STATS.num_distinct_categories,
    );
    for (const [code, expected] of Object.entries(
      EXPECTED_NOMINAL_STATS.proportions_by_code,
    )) {
      expect(nominalStat.nominal.proportions_by_code[code]).toBeCloseTo(
        expected,
        5,
      );
    }
  });

  it("returns exact ordinal statistics for 150 samples", async () => {
    const { organisationId, projectId, evaluationId } =
      await seedDatasetEvaluationWithScoreResults(dataSource, {
        scoringType: "ORDINAL",
        ordinalValues: ORDINAL_VALUES_150,
        scale: ORDINAL_SCALE,
        ordinalConfig: ORDINAL_CONFIG,
        numRows: 150,
      });

    const { body } = await request(app.getHttpServer())
      .get(
        `/v1/organisations/${organisationId}/projects/${projectId}/evaluations/${evaluationId}/datasets/statistics`,
      )
      .expect(200);

    const ordinalStat = body.find((s: { ordinal?: unknown }) => s.ordinal);
    expect(ordinalStat).toBeDefined();
    expect(ordinalStat.ordinal.n_scored).toBe(EXPECTED_ORDINAL_STATS.n_scored);
    expect(ordinalStat.ordinal.median_category).toBe(
      EXPECTED_ORDINAL_STATS.median_category,
    );
    expect(ordinalStat.ordinal.pass_rate).toBeDefined();
    expect(ordinalStat.ordinal.pass_rate.proportion).toBeCloseTo(
      EXPECTED_ORDINAL_STATS.pass_rate.proportion,
      5,
    );
    for (const [code, expected] of Object.entries(EXPECTED_ORDINAL_STATS.cdf)) {
      expect(ordinalStat.ordinal.cdf[code]).toBeCloseTo(expected, 5);
    }
    expect(ordinalStat.ordinal.percentile_categories.p10).toBe(
      EXPECTED_ORDINAL_STATS.percentile_categories.p10,
    );
    expect(ordinalStat.ordinal.percentile_categories.p50).toBe(
      EXPECTED_ORDINAL_STATS.percentile_categories.p50,
    );
    expect(ordinalStat.ordinal.percentile_categories.p90).toBe(
      EXPECTED_ORDINAL_STATS.percentile_categories.p90,
    );
  });
});
