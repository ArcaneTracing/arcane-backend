import "reflect-metadata";
import { Test } from "@nestjs/testing";
import { CanActivate, INestApplication } from "@nestjs/common";
import { CACHE_MANAGER } from "@nestjs/cache-manager";
import { Cache } from "cache-manager";
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
import { measurePerformance } from "./helpers/performance-measurement.helper";
import {
  generateNominalValues,
  generateNumericValues,
  generateOrdinalValues,
} from "./helpers/data-generators.helper";

jest.setTimeout(300_000);

const e2eBypassGuard: CanActivate = () => true;

const log = (msg: string) => console.log(`[E2E] ${msg}`);

describe("Evaluations – experiment comparison performance (E2E)", () => {
  let app: INestApplication;
  let dataSource: DataSource;

  beforeAll(async () => {
    log("Starting test database...");
    await startTestDatabase();
    dataSource = getTestDataSource();
    log("Database ready. Compiling app...");

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideGuard(OrgProjectPermissionGuard)
      .useValue(e2eBypassGuard)
      .compile();

    app = moduleRef.createNestApplication();
    await app.init();
    log("App initialized.");
  }, 60_000);

  afterAll(async () => {
    log("Shutting down app and database...");
    await app?.close();
    await stopTestDatabase();
  });

  beforeEach(async () => {
    log("Truncating evaluation tables...");
    await truncateEvaluationTables(dataSource);
    const cacheManager = app.get<Cache>(CACHE_MANAGER);
    if (typeof cacheManager.reset === "function") {
      await cacheManager.reset();
    }
  });

  const testSizes = [1_000, 10_000, 100_000];

  describe.each(testSizes)("Dataset size: %d paired rows", (size) => {
    it("numeric comparison - correctness and performance", async () => {
      log(`\n--- Numeric comparison (${size} paired rows) ---`);
      const valuesA = generateNumericValues(size, 0.5, 0.1, 42);
      const valuesB = valuesA.map((v, i) => v + (i % 2 === 0 ? 0.05 : -0.02));

      log(`Seeding comparison evaluation (${size} rows)...`);
      const {
        organisationId,
        projectId,
        evaluationId,
        experimentIdA,
        experimentIdB,
        scoreId,
      } = await seedComparisonEvaluationWithTwoExperiments(dataSource, {
        scoringType: "NUMERIC",
        numRows: size,
        valuesA,
        valuesB,
      });
      log(`Seeding complete. Calling API...`);

      const { result, metrics } = await measurePerformance(async () => {
        const response = await request(app.getHttpServer())
          .post(
            `/v1/organisations/${organisationId}/projects/${projectId}/evaluations/${evaluationId}/compare-experiments`,
          )
          .send({ experimentIdA, experimentIdB, scoreId });
        return { body: response.body, status: response.status };
      }, `Numeric Comparison - ${size} entries`);

      expect(result.status).toBe(201);
      expect(result.body.numeric).toBeDefined();
      expect(result.body.numeric.n_paired).toBe(size);
      expect(result.body.numeric.delta_mean).toBeDefined();
      expect(result.body.numeric.win_rate).toBeDefined();
      expect(result.body.numeric.loss_rate).toBeDefined();
      expect(result.body.numeric.ci95_delta).toBeDefined();
      expect(result.body.numeric.ci95_delta.lower).toBeDefined();
      expect(result.body.numeric.ci95_delta.upper).toBeDefined();

      if (size === 1_000) {
        expect(metrics.executionTimeMs).toBeLessThan(5000);
      } else if (size === 10_000) {
        expect(metrics.executionTimeMs).toBeLessThan(15000);
      } else if (size === 100_000) {
        expect(metrics.executionTimeMs).toBeLessThan(60000);
      }

      expect(metrics.memoryDeltaMB).toBeLessThan(200);

      log(
        `[RESULTS] Numeric ${size}: n_paired=${result.body.numeric.n_paired} delta_mean=${result.body.numeric.delta_mean?.toFixed(4)} win_rate=${result.body.numeric.win_rate?.toFixed(4)} | time=${metrics.executionTimeMs.toFixed(0)}ms mem=${metrics.memoryDeltaMB.toFixed(2)}MB`,
      );
    });

    it("nominal comparison - correctness and performance", async () => {
      log(`\n--- Nominal comparison (${size} paired rows) ---`);
      const distribution = { A: 0.4, B: 0.3, C: 0.2, D: 0.1 };
      const valuesA = generateNominalValues(size, distribution, 42);
      const valuesB = generateNominalValues(size, distribution, 43);

      log(`Seeding comparison evaluation (${size} rows)...`);
      const {
        organisationId,
        projectId,
        evaluationId,
        experimentIdA,
        experimentIdB,
        scoreId,
      } = await seedComparisonEvaluationWithTwoExperiments(dataSource, {
        scoringType: "NOMINAL",
        numRows: size,
        valuesA,
        valuesB,
      });
      log(`Seeding complete. Calling API...`);

      const { result, metrics } = await measurePerformance(async () => {
        const response = await request(app.getHttpServer())
          .post(
            `/v1/organisations/${organisationId}/projects/${projectId}/evaluations/${evaluationId}/compare-experiments`,
          )
          .send({ experimentIdA, experimentIdB, scoreId });
        return { body: response.body, status: response.status };
      }, `Nominal Comparison - ${size} entries`);

      expect(result.status).toBe(201);
      expect(result.body.nominal).toBeDefined();
      expect(result.body.nominal.n_paired).toBe(size);
      expect(result.body.nominal.bowker_test).toBeDefined();
      expect(result.body.nominal.cramers_v).toBeDefined();
      expect(result.body.nominal.distribution_comparison).toBeDefined();

      if (size === 1_000) {
        expect(metrics.executionTimeMs).toBeLessThan(5000);
      } else if (size === 10_000) {
        expect(metrics.executionTimeMs).toBeLessThan(15000);
      } else if (size === 100_000) {
        expect(metrics.executionTimeMs).toBeLessThan(60000);
      }

      expect(metrics.memoryDeltaMB).toBeLessThan(200);

      log(
        `[RESULTS] Nominal ${size}: n_paired=${result.body.nominal.n_paired} cramers_v=${result.body.nominal.cramers_v?.toFixed(4)} | time=${metrics.executionTimeMs.toFixed(0)}ms mem=${metrics.memoryDeltaMB.toFixed(2)}MB`,
      );
    });

    it("ordinal comparison - correctness and performance", async () => {
      log(`\n--- Ordinal comparison (${size} paired rows) ---`);
      const scale = [
        { label: "Poor", value: 1 },
        { label: "Fair", value: 2 },
        { label: "Good", value: 3 },
        { label: "Very Good", value: 4 },
        { label: "Excellent", value: 5 },
      ];

      const distribution = [0.1, 0.2, 0.4, 0.2, 0.1];
      const valuesA = generateOrdinalValues(size, scale, distribution, 42);
      const valuesB = generateOrdinalValues(size, scale, distribution, 43);

      log(`Seeding comparison evaluation (${size} rows)...`);
      const {
        organisationId,
        projectId,
        evaluationId,
        experimentIdA,
        experimentIdB,
        scoreId,
      } = await seedComparisonEvaluationWithTwoExperiments(dataSource, {
        scoringType: "ORDINAL",
        numRows: size,
        valuesA,
        valuesB,
        scale,
      });
      log(`Seeding complete. Calling API...`);

      const { result, metrics } = await measurePerformance(async () => {
        const response = await request(app.getHttpServer())
          .post(
            `/v1/organisations/${organisationId}/projects/${projectId}/evaluations/${evaluationId}/compare-experiments`,
          )
          .send({ experimentIdA, experimentIdB, scoreId });
        return { body: response.body, status: response.status };
      }, `Ordinal Comparison - ${size} entries`);

      expect(result.status).toBe(201);
      expect(result.body.ordinal).toBeDefined();
      expect(result.body.ordinal.n_paired).toBe(size);
      expect(result.body.ordinal.wilcoxon_signed_rank).toBeDefined();
      expect(result.body.ordinal.cliffs_delta).toBeDefined();
      expect(result.body.ordinal.probability_of_superiority).toBeDefined();

      if (size === 1_000) {
        expect(metrics.executionTimeMs).toBeLessThan(5000);
      } else if (size === 10_000) {
        expect(metrics.executionTimeMs).toBeLessThan(15000);
      } else if (size === 100_000) {
        expect(metrics.executionTimeMs).toBeLessThan(60000);
      }

      expect(metrics.memoryDeltaMB).toBeLessThan(200);

      log(
        `[RESULTS] Ordinal ${size}: n_paired=${result.body.ordinal.n_paired} cliffs_delta=${result.body.ordinal.cliffs_delta?.toFixed(4)} | time=${metrics.executionTimeMs.toFixed(0)}ms mem=${metrics.memoryDeltaMB.toFixed(2)}MB`,
      );
    });
  });

  describe("Memory footprint", () => {
    it("comparison keeps memory bounded across sizes", async () => {
      log(`\n--- Memory footprint test ---`);
      const sizes = [1_000, 10_000, 100_000];
      const memoryDeltas: number[] = [];

      for (const size of sizes) {
        log(`Memory test: seeding ${size} paired rows...`);
        const {
          organisationId,
          projectId,
          evaluationId,
          experimentIdA,
          experimentIdB,
          scoreId,
        } = await seedComparisonEvaluationWithTwoExperiments(dataSource, {
          scoringType: "NOMINAL",
          numRows: size,
        });

        const { metrics } = await measurePerformance(async () => {
          await request(app.getHttpServer())
            .post(
              `/v1/organisations/${organisationId}/projects/${projectId}/evaluations/${evaluationId}/compare-experiments`,
            )
            .send({ experimentIdA, experimentIdB, scoreId });
        });

        log(`Memory test ${size}: ${metrics.memoryDeltaMB.toFixed(2)}MB delta`);
        memoryDeltas.push(metrics.memoryDeltaMB);
        await truncateEvaluationTables(dataSource);
      }

      const [delta1k, delta10k, delta100k] = memoryDeltas;
      const abs1k = Math.abs(delta1k);

      expect(Math.abs(delta10k)).toBeLessThan(abs1k * 15);
      expect(Math.abs(delta100k)).toBeLessThan(abs1k * 35);
      expect(Math.max(...memoryDeltas)).toBeLessThan(200);

      log(
        `[RESULTS] Memory footprint: 1k=${delta1k.toFixed(2)}MB 10k=${delta10k.toFixed(2)}MB 100k=${delta100k.toFixed(2)}MB`,
      );
    });
  });
});
