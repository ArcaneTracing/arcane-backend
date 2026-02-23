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
  seedComparisonEvaluationWithTwoExperiments,
  truncateEvaluationTables,
} from "./helpers/evaluation-seed.helper";
import {
  PAIRED_NUMERIC_VALUES_A_150,
  PAIRED_NUMERIC_VALUES_B_150,
  PAIRED_NOMINAL_VALUES_A_150,
  PAIRED_NOMINAL_VALUES_B_150,
  PAIRED_ORDINAL_VALUES_A_150,
  PAIRED_ORDINAL_VALUES_B_150,
  ORDINAL_SCALE,
  ORDINAL_CONFIG,
} from "./fixtures/statistics-comparison.constants";

jest.setTimeout(90_000);

const e2eBypassGuard: CanActivate = () => true;

describe("Evaluations – statistics vs comparison cross-check (E2E)", () => {
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

  it("numeric: experiment statistics mean matches comparison mean_a and mean_b", async () => {
    const {
      organisationId,
      projectId,
      evaluationId,
      experimentIdA,
      experimentIdB,
      scoreId,
    } = await seedComparisonEvaluationWithTwoExperiments(dataSource, {
      scoringType: "NUMERIC",
      valuesA: PAIRED_NUMERIC_VALUES_A_150,
      valuesB: PAIRED_NUMERIC_VALUES_B_150,
      numRows: 150,
    });

    const [statsRes, compareRes] = await Promise.all([
      request(app.getHttpServer()).get(
        `/v1/organisations/${organisationId}/projects/${projectId}/evaluations/${evaluationId}/experiments/statistics`,
      ),
      request(app.getHttpServer())
        .post(
          `/v1/organisations/${organisationId}/projects/${projectId}/evaluations/${evaluationId}/compare-experiments`,
        )
        .send({ experimentIdA, experimentIdB, scoreId }),
    ]);

    expect(statsRes.status).toBe(200);
    expect(compareRes.status).toBe(201);

    const statsA = statsRes.body.find(
      (s: { experimentId?: string; numeric?: unknown }) =>
        s.experimentId === experimentIdA && s.numeric,
    );
    const statsB = statsRes.body.find(
      (s: { experimentId?: string; numeric?: unknown }) =>
        s.experimentId === experimentIdB && s.numeric,
    );
    const comparison = compareRes.body.numeric;

    expect(statsA).toBeDefined();
    expect(statsB).toBeDefined();
    expect(comparison).toBeDefined();

    expect(statsA.numeric.mean).toBeCloseTo(comparison.mean_a, 5);
    expect(statsB.numeric.mean).toBeCloseTo(comparison.mean_b, 5);
    expect(comparison.n_paired).toBe(150);
    expect(statsA.numeric.n_scored).toBe(150);
    expect(statsB.numeric.n_scored).toBe(150);
  });

  it("nominal: experiment statistics proportions match comparison distribution_comparison", async () => {
    const {
      organisationId,
      projectId,
      evaluationId,
      experimentIdA,
      experimentIdB,
      scoreId,
    } = await seedComparisonEvaluationWithTwoExperiments(dataSource, {
      scoringType: "NOMINAL",
      valuesA: PAIRED_NOMINAL_VALUES_A_150,
      valuesB: PAIRED_NOMINAL_VALUES_B_150,
      numRows: 150,
    });

    const [statsRes, compareRes] = await Promise.all([
      request(app.getHttpServer()).get(
        `/v1/organisations/${organisationId}/projects/${projectId}/evaluations/${evaluationId}/experiments/statistics`,
      ),
      request(app.getHttpServer())
        .post(
          `/v1/organisations/${organisationId}/projects/${projectId}/evaluations/${evaluationId}/compare-experiments`,
        )
        .send({ experimentIdA, experimentIdB, scoreId }),
    ]);

    expect(statsRes.status).toBe(200);
    expect(compareRes.status).toBe(201);

    const statsA = statsRes.body.find(
      (s: { experimentId?: string; nominal?: unknown }) =>
        s.experimentId === experimentIdA && s.nominal,
    );
    const statsB = statsRes.body.find(
      (s: { experimentId?: string; nominal?: unknown }) =>
        s.experimentId === experimentIdB && s.nominal,
    );
    const distComp = compareRes.body.nominal?.distribution_comparison;

    expect(statsA).toBeDefined();
    expect(statsB).toBeDefined();
    expect(distComp).toBeDefined();

    for (const code of Object.keys(distComp)) {
      expect(statsA.nominal.proportions_by_code[code]).toBeCloseTo(
        distComp[code].proportion_a,
        5,
      );
      expect(statsB.nominal.proportions_by_code[code]).toBeCloseTo(
        distComp[code].proportion_b,
        5,
      );
    }
  });

  it("ordinal: experiment statistics pass_rate and cdf match comparison", async () => {
    const {
      organisationId,
      projectId,
      evaluationId,
      experimentIdA,
      experimentIdB,
      scoreId,
    } = await seedComparisonEvaluationWithTwoExperiments(dataSource, {
      scoringType: "ORDINAL",
      valuesA: PAIRED_ORDINAL_VALUES_A_150,
      valuesB: PAIRED_ORDINAL_VALUES_B_150,
      scale: ORDINAL_SCALE,
      ordinalConfig: ORDINAL_CONFIG,
      numRows: 150,
    });

    const [statsRes, compareRes] = await Promise.all([
      request(app.getHttpServer()).get(
        `/v1/organisations/${organisationId}/projects/${projectId}/evaluations/${evaluationId}/experiments/statistics`,
      ),
      request(app.getHttpServer())
        .post(
          `/v1/organisations/${organisationId}/projects/${projectId}/evaluations/${evaluationId}/compare-experiments`,
        )
        .send({ experimentIdA, experimentIdB, scoreId }),
    ]);

    expect(statsRes.status).toBe(200);
    expect(compareRes.status).toBe(201);

    const statsA = statsRes.body.find(
      (s: { experimentId?: string; ordinal?: unknown }) =>
        s.experimentId === experimentIdA && s.ordinal,
    );
    const statsB = statsRes.body.find(
      (s: { experimentId?: string; ordinal?: unknown }) =>
        s.experimentId === experimentIdB && s.ordinal,
    );
    const deltaPass = compareRes.body.ordinal?.delta_pass_rate;
    const cdfComp = compareRes.body.ordinal?.cdf_comparison;

    expect(statsA).toBeDefined();
    expect(statsB).toBeDefined();
    expect(deltaPass).toBeDefined();
    expect(cdfComp).toBeDefined();

    expect(statsA.ordinal.pass_rate.proportion).toBeCloseTo(
      deltaPass.pass_rate_a,
      5,
    );
    expect(statsB.ordinal.pass_rate.proportion).toBeCloseTo(
      deltaPass.pass_rate_b,
      5,
    );

    for (const [label, comp] of Object.entries(cdfComp)) {
      const value = ORDINAL_SCALE.find((s) => s.label === label)?.value;
      if (value !== undefined) {
        const code = String(value);
        expect(statsA.ordinal.cdf[code]).toBeCloseTo(comp.cdf_a, 5);
        expect(statsB.ordinal.cdf[code]).toBeCloseTo(comp.cdf_b, 5);
      }
    }
  });
});
