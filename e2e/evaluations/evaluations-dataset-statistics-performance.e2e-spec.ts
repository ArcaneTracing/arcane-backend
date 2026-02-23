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
  seedDatasetEvaluationWithScoreResults,
  truncateEvaluationTables,
} from "./helpers/evaluation-seed.helper";
import {
  measurePerformance,
  formatPerformanceMetrics,
  PerformanceMetrics,
} from "./helpers/performance-measurement.helper";
import {
  generateNominalValues,
  generateNumericValues,
  generateOrdinalValues,
} from "./helpers/data-generators.helper";

jest.setTimeout(300_000);

const e2eBypassGuard: CanActivate = () => true;

const log = (msg: string) => console.log(`[E2E] ${msg}`);

describe("Evaluations – dataset statistics performance (E2E)", () => {
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

  describe.each(testSizes)("Dataset size: %d entries", (size) => {
    it("nominal statistics - correctness and performance", async () => {
      log(`\n--- Nominal stats (${size} entries) ---`);

      const distribution = { A: 0.4, B: 0.3, C: 0.2, D: 0.1 };
      const expectedCounts = {
        "1": Math.round(size * 0.4),
        "2": Math.round(size * 0.3),
        "3": Math.round(size * 0.2),
        "4": Math.round(size * 0.1),
      };
      const expectedMode = "1";

      log(`Seeding dataset evaluation (${size} rows)...`);
      const { organisationId, projectId, evaluationId } =
        await seedDatasetEvaluationWithScoreResults(dataSource, {
          scoringType: "NOMINAL",
          numRows: size,
          nominalValues: generateNominalValues(size, distribution, 42),
        });
      log(`Seeding complete. Calling API...`);

      const { result, metrics } = await measurePerformance(async () => {
        const response = await request(app.getHttpServer()).get(
          `/v1/organisations/${organisationId}/projects/${projectId}/evaluations/${evaluationId}/datasets/statistics`,
        );
        return { body: response.body, status: response.status };
      }, `Nominal Statistics - ${size} entries`);

      expect(result.status).toBe(200);
      expect(Array.isArray(result.body)).toBe(true);
      const nominalStat = result.body.find((s: any) => s.nominal);
      expect(nominalStat).toBeDefined();
      expect(nominalStat.nominal.n_scored).toBe(size);
      expect(nominalStat.nominal.mode_code).toBe(expectedMode);

      const tolerance = Math.max(25, Math.round(expectedCounts["1"] * 0.04));
      expect(nominalStat.nominal.counts_by_code["1"]).toBeGreaterThanOrEqual(
        expectedCounts["1"] - tolerance,
      );
      expect(nominalStat.nominal.counts_by_code["1"]).toBeLessThanOrEqual(
        expectedCounts["1"] + tolerance,
      );

      if (size === 1_000) {
        expect(metrics.executionTimeMs).toBeLessThan(1000);
      } else if (size === 10_000) {
        expect(metrics.executionTimeMs).toBeLessThan(5000);
      } else if (size === 100_000) {
        expect(metrics.executionTimeMs).toBeLessThan(30000);
      }

      expect(metrics.memoryDeltaMB).toBeLessThan(100);

      log(
        `[RESULTS] Nominal ${size}: counts_by_code=${JSON.stringify(nominalStat.nominal.counts_by_code)} mode=${nominalStat.nominal.mode_code} n_scored=${nominalStat.nominal.n_scored} | time=${metrics.executionTimeMs.toFixed(0)}ms mem=${metrics.memoryDeltaMB.toFixed(2)}MB`,
      );
    });

    it("numeric statistics - correctness and performance", async () => {
      log(`\n--- Numeric stats (${size} entries) ---`);

      const mean = 50;
      const stdDev = 10;
      const numericValues = generateNumericValues(size, mean, stdDev, 42);

      log(`Seeding dataset evaluation (${size} rows)...`);
      const { organisationId, projectId, evaluationId } =
        await seedDatasetEvaluationWithScoreResults(dataSource, {
          scoringType: "NUMERIC",
          numRows: size,
          numericValues,
        });
      log(`Seeding complete. Calling API...`);

      const { result, metrics } = await measurePerformance(async () => {
        const response = await request(app.getHttpServer()).get(
          `/v1/organisations/${organisationId}/projects/${projectId}/evaluations/${evaluationId}/datasets/statistics`,
        );
        return { body: response.body, status: response.status };
      }, `Numeric Statistics - ${size} entries`);

      expect(result.status).toBe(200);
      const numericStat = result.body.find((s: any) => s.numeric);
      expect(numericStat).toBeDefined();
      expect(numericStat.numeric.n_scored).toBe(size);

      const meanTolerance = Math.max(0.5, mean * 0.01);
      expect(Math.abs(numericStat.numeric.mean - mean)).toBeLessThan(
        meanTolerance,
      );

      expect(numericStat.numeric.p10).toBeDefined();
      expect(numericStat.numeric.p50).toBeDefined();
      expect(numericStat.numeric.p90).toBeDefined();

      if (size === 1_000) {
        expect(metrics.executionTimeMs).toBeLessThan(1000);
      } else if (size === 10_000) {
        expect(metrics.executionTimeMs).toBeLessThan(5000);
      } else if (size === 100_000) {
        expect(metrics.executionTimeMs).toBeLessThan(30000);
      }

      expect(metrics.memoryDeltaMB).toBeLessThan(100);

      log(
        `[RESULTS] Numeric ${size}: mean=${numericStat.numeric.mean?.toFixed(4)} std=${numericStat.numeric.std?.toFixed(4)} p10=${numericStat.numeric.p10} p50=${numericStat.numeric.p50} p90=${numericStat.numeric.p90} n_scored=${numericStat.numeric.n_scored} | time=${metrics.executionTimeMs.toFixed(0)}ms mem=${metrics.memoryDeltaMB.toFixed(2)}MB`,
      );
    });

    it("ordinal statistics - correctness and performance", async () => {
      log(`\n--- Ordinal stats (${size} entries) ---`);
      const scale = [
        { label: "Poor", value: 1 },
        { label: "Fair", value: 2 },
        { label: "Good", value: 3 },
        { label: "Very Good", value: 4 },
        { label: "Excellent", value: 5 },
      ];

      const distribution = [0.1, 0.2, 0.4, 0.2, 0.1];
      const ordinalValues = generateOrdinalValues(
        size,
        scale,
        distribution,
        42,
      );

      log(`Seeding dataset evaluation (${size} rows)...`);
      const { organisationId, projectId, evaluationId } =
        await seedDatasetEvaluationWithScoreResults(dataSource, {
          scoringType: "ORDINAL",
          numRows: size,
          ordinalValues,
          scale,
        });
      log(`Seeding complete. Calling API...`);

      const { result, metrics } = await measurePerformance(async () => {
        const response = await request(app.getHttpServer()).get(
          `/v1/organisations/${organisationId}/projects/${projectId}/evaluations/${evaluationId}/datasets/statistics`,
        );
        return { body: response.body, status: response.status };
      }, `Ordinal Statistics - ${size} entries`);

      expect(result.status).toBe(200);
      const ordinalStat = result.body.find((s: any) => s.ordinal);
      expect(ordinalStat).toBeDefined();
      expect(ordinalStat.ordinal.n_scored).toBe(size);
      expect(ordinalStat.ordinal.percentile_categories).toBeDefined();
      expect(ordinalStat.ordinal.cdf).toBeDefined();
      expect(ordinalStat.ordinal.median_category).toBeDefined();

      if (size === 1_000) {
        expect(metrics.executionTimeMs).toBeLessThan(1000);
      } else if (size === 10_000) {
        expect(metrics.executionTimeMs).toBeLessThan(5000);
      } else if (size === 100_000) {
        expect(metrics.executionTimeMs).toBeLessThan(30000);
      }

      expect(metrics.memoryDeltaMB).toBeLessThan(100);

      log(
        `[RESULTS] Ordinal ${size}: cdf=${JSON.stringify(ordinalStat.ordinal.cdf)} percentiles=${JSON.stringify(ordinalStat.ordinal.percentile_categories)} median=${ordinalStat.ordinal.median_category} n_scored=${ordinalStat.ordinal.n_scored} | time=${metrics.executionTimeMs.toFixed(0)}ms mem=${metrics.memoryDeltaMB.toFixed(2)}MB`,
      );
    });
  });

  describe("Memory footprint", () => {
    it("streaming approach keeps memory bounded across sizes", async () => {
      log(`\n--- Memory footprint test ---`);
      const sizes = [1_000, 10_000, 100_000];
      const memoryDeltas: number[] = [];

      for (const size of sizes) {
        log(`Memory test: seeding ${size} rows...`);
        const { organisationId, projectId, evaluationId } =
          await seedDatasetEvaluationWithScoreResults(dataSource, {
            scoringType: "NOMINAL",
            numRows: size,
            nominalValues: generateNominalValues(size, { A: 0.5, B: 0.5 }, 42),
          });

        const { metrics } = await measurePerformance(async () => {
          await request(app.getHttpServer()).get(
            `/v1/organisations/${organisationId}/projects/${projectId}/evaluations/${evaluationId}/datasets/statistics`,
          );
        });

        log(`Memory test ${size}: ${metrics.memoryDeltaMB.toFixed(2)}MB delta`);
        memoryDeltas.push(metrics.memoryDeltaMB);
        await truncateEvaluationTables(dataSource);
      }

      const [delta1k, delta10k, delta100k] = memoryDeltas;
      const abs1k = Math.abs(delta1k);

      expect(Math.abs(delta10k)).toBeLessThan(abs1k * 10);

      expect(Math.abs(delta100k)).toBeLessThan(abs1k * 35);

      expect(Math.max(...memoryDeltas)).toBeLessThan(200);

      log(
        `[RESULTS] Memory footprint: 1k=${delta1k.toFixed(2)}MB 10k=${delta10k.toFixed(2)}MB 100k=${delta100k.toFixed(2)}MB`,
      );
    });
  });
});
