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
  seedExperimentEvaluationWithScoreResults,
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

describe("Evaluations – experiment statistics deterministic (E2E)", () => {
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

  it("returns exact numeric statistics for experiment with 150 samples", async () => {
    const { organisationId, projectId, evaluationId, experimentId } =
      await seedExperimentEvaluationWithScoreResults(dataSource, {
        scoringType: "NUMERIC",
        numericValues: NUMERIC_VALUES_150,
        numRows: 150,
      });

    const { body } = await request(app.getHttpServer())
      .get(
        `/v1/organisations/${organisationId}/projects/${projectId}/evaluations/${evaluationId}/experiments/statistics`,
      )
      .expect(200);

    const numericStat = body.find(
      (s: { experimentId?: string; numeric?: unknown }) =>
        s.experimentId === experimentId && s.numeric,
    );
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
  });

  it("returns exact nominal statistics for experiment with 150 samples", async () => {
    const { organisationId, projectId, evaluationId, experimentId } =
      await seedExperimentEvaluationWithScoreResults(dataSource, {
        scoringType: "NOMINAL",
        nominalValues: NOMINAL_VALUES_150,
        numRows: 150,
      });

    const { body } = await request(app.getHttpServer())
      .get(
        `/v1/organisations/${organisationId}/projects/${projectId}/evaluations/${evaluationId}/experiments/statistics`,
      )
      .expect(200);

    const nominalStat = body.find(
      (s: { experimentId?: string; nominal?: unknown }) =>
        s.experimentId === experimentId && s.nominal,
    );
    expect(nominalStat).toBeDefined();
    expect(nominalStat.nominal.counts_by_code).toEqual(
      EXPECTED_NOMINAL_STATS.counts_by_code,
    );
    expect(nominalStat.nominal.n_scored).toBe(EXPECTED_NOMINAL_STATS.n_scored);
    for (const [code, expected] of Object.entries(
      EXPECTED_NOMINAL_STATS.proportions_by_code,
    )) {
      expect(nominalStat.nominal.proportions_by_code[code]).toBeCloseTo(
        expected,
        5,
      );
    }
  });

  it("returns exact ordinal statistics for experiment with 150 samples", async () => {
    const { organisationId, projectId, evaluationId, experimentId } =
      await seedExperimentEvaluationWithScoreResults(dataSource, {
        scoringType: "ORDINAL",
        ordinalValues: ORDINAL_VALUES_150,
        scale: ORDINAL_SCALE,
        ordinalConfig: ORDINAL_CONFIG,
        numRows: 150,
      });

    const { body } = await request(app.getHttpServer())
      .get(
        `/v1/organisations/${organisationId}/projects/${projectId}/evaluations/${evaluationId}/experiments/statistics`,
      )
      .expect(200);

    const ordinalStat = body.find(
      (s: { experimentId?: string; ordinal?: unknown }) =>
        s.experimentId === experimentId && s.ordinal,
    );
    expect(ordinalStat).toBeDefined();
    expect(ordinalStat.ordinal.n_scored).toBe(EXPECTED_ORDINAL_STATS.n_scored);
    expect(ordinalStat.ordinal.pass_rate.proportion).toBeCloseTo(
      EXPECTED_ORDINAL_STATS.pass_rate.proportion,
      5,
    );
    for (const [code, expected] of Object.entries(EXPECTED_ORDINAL_STATS.cdf)) {
      expect(ordinalStat.ordinal.cdf[code]).toBeCloseTo(expected, 5);
    }
  });
});
