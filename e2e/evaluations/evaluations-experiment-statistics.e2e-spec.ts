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

jest.setTimeout(60_000);

const e2eBypassGuard: CanActivate = () => true;

describe("Evaluations – experiment statistics (E2E)", () => {
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

  it("returns nominal statistics for experiment-scoped evaluation", async () => {
    const { organisationId, projectId, evaluationId, experimentId } =
      await seedExperimentEvaluationWithScoreResults(dataSource, {
        scoringType: "NOMINAL",
        nominalValues: ["A", "B", "A", "C"],
      });

    const { body, status } = await request(app.getHttpServer())
      .get(
        `/v1/organisations/${organisationId}/projects/${projectId}/evaluations/${evaluationId}/experiments/statistics`,
      )
      .expect(200);

    expect(status).toBe(200);
    expect(Array.isArray(body)).toBe(true);
    const nominalStat = body.find(
      (s: any) => s.experimentId === experimentId && s.nominal,
    );
    expect(nominalStat).toBeDefined();
    expect(nominalStat.nominal.counts_by_code).toBeDefined();
    expect(nominalStat.nominal.n_scored).toBeGreaterThan(0);
  });

  it("returns numeric statistics for experiment-scoped evaluation", async () => {
    const { organisationId, projectId, evaluationId, experimentId } =
      await seedExperimentEvaluationWithScoreResults(dataSource, {
        scoringType: "NUMERIC",
        numericValues: [1, 2, 3, 4, 5],
      });

    const { body, status } = await request(app.getHttpServer())
      .get(
        `/v1/organisations/${organisationId}/projects/${projectId}/evaluations/${evaluationId}/experiments/statistics`,
      )
      .expect(200);

    expect(status).toBe(200);
    const numericStat = body.find(
      (s: any) => s.experimentId === experimentId && s.numeric,
    );
    expect(numericStat).toBeDefined();
    expect(numericStat.numeric.mean).toBeCloseTo(3, 5);
    expect(numericStat.numeric.n_scored).toBe(5);
  });
});
