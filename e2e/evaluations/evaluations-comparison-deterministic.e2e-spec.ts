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
  EXPECTED_NUMERIC_COMPARISON,
  EXPECTED_NOMINAL_COMPARISON,
  EXPECTED_ORDINAL_COMPARISON,
} from "./fixtures/statistics-comparison.constants";

jest.setTimeout(90_000);

const e2eBypassGuard: CanActivate = () => true;

describe("Evaluations – comparison deterministic (E2E)", () => {
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

  it("returns exact numeric comparison for 150 paired samples", async () => {
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

    const { body } = await request(app.getHttpServer())
      .post(
        `/v1/organisations/${organisationId}/projects/${projectId}/evaluations/${evaluationId}/compare-experiments`,
      )
      .send({
        experimentIdA,
        experimentIdB,
        scoreId,
      })
      .expect(201);

    expect(body.numeric).toBeDefined();
    expect(body.numeric.n_paired).toBe(EXPECTED_NUMERIC_COMPARISON.n_paired);
    expect(body.numeric.mean_a).toBeCloseTo(
      EXPECTED_NUMERIC_COMPARISON.mean_a,
      5,
    );
    expect(body.numeric.mean_b).toBeCloseTo(
      EXPECTED_NUMERIC_COMPARISON.mean_b,
      5,
    );
    expect(body.numeric.delta_mean).toBeCloseTo(
      EXPECTED_NUMERIC_COMPARISON.delta_mean,
      5,
    );
    expect(body.numeric.win_rate).toBeCloseTo(
      EXPECTED_NUMERIC_COMPARISON.win_rate,
      5,
    );
    expect(body.numeric.loss_rate).toBeCloseTo(
      EXPECTED_NUMERIC_COMPARISON.loss_rate,
      5,
    );
    expect(body.numeric.tie_rate).toBeCloseTo(
      EXPECTED_NUMERIC_COMPARISON.tie_rate,
      5,
    );
  });

  it("returns exact nominal comparison for 150 paired samples", async () => {
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

    const { body } = await request(app.getHttpServer())
      .post(
        `/v1/organisations/${organisationId}/projects/${projectId}/evaluations/${evaluationId}/compare-experiments`,
      )
      .send({
        experimentIdA,
        experimentIdB,
        scoreId,
      })
      .expect(201);

    expect(body.nominal).toBeDefined();
    expect(body.nominal.n_paired).toBe(EXPECTED_NOMINAL_COMPARISON.n_paired);
    const dist = body.nominal.distribution_comparison;
    expect(dist).toBeDefined();
    for (const [code, expectedA] of Object.entries(
      EXPECTED_NOMINAL_COMPARISON.proportion_a_by_code,
    )) {
      expect(dist[code]).toBeDefined();
      expect(dist[code].proportion_a).toBeCloseTo(expectedA, 5);
    }
    for (const [code, expectedB] of Object.entries(
      EXPECTED_NOMINAL_COMPARISON.proportion_b_by_code,
    )) {
      expect(dist[code]).toBeDefined();
      expect(dist[code].proportion_b).toBeCloseTo(expectedB, 5);
    }
  });

  it("returns exact ordinal comparison for 150 paired samples", async () => {
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

    const { body } = await request(app.getHttpServer())
      .post(
        `/v1/organisations/${organisationId}/projects/${projectId}/evaluations/${evaluationId}/compare-experiments`,
      )
      .send({
        experimentIdA,
        experimentIdB,
        scoreId,
      })
      .expect(201);

    expect(body.ordinal).toBeDefined();
    expect(body.ordinal.n_paired).toBe(EXPECTED_ORDINAL_COMPARISON.n_paired);
    expect(body.ordinal.delta_pass_rate).toBeDefined();
    expect(body.ordinal.delta_pass_rate.pass_rate_a).toBeCloseTo(
      EXPECTED_ORDINAL_COMPARISON.pass_rate_a,
      5,
    );
    expect(body.ordinal.delta_pass_rate.pass_rate_b).toBeCloseTo(
      EXPECTED_ORDINAL_COMPARISON.pass_rate_b,
      5,
    );
    const cdfComp = body.ordinal.cdf_comparison;
    expect(cdfComp).toBeDefined();
    for (const [label, expected] of Object.entries(
      EXPECTED_ORDINAL_COMPARISON.cdf_a,
    )) {
      expect(cdfComp[label]).toBeDefined();
      expect(cdfComp[label].cdf_a).toBeCloseTo(expected, 5);
    }
    for (const [label, expected] of Object.entries(
      EXPECTED_ORDINAL_COMPARISON.cdf_b,
    )) {
      expect(cdfComp[label]).toBeDefined();
      expect(cdfComp[label].cdf_b).toBeCloseTo(expected, 5);
    }
  });
});
