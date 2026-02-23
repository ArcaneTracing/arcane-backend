import {
  PostgreSqlContainer,
  StartedPostgreSqlContainer,
} from "@testcontainers/postgresql";
import { execSync } from "child_process";
import { DataSource } from "typeorm";
import path from "path";

process.env.APP_STARTUP_DELAY_MS = "0";

const projectRoot = path.resolve(__dirname, "../..");

let container: StartedPostgreSqlContainer | null = null;
let dataSource: DataSource | null = null;
let initPromise: Promise<{
  container: StartedPostgreSqlContainer;
  dataSource: DataSource;
}> | null = null;

export async function startTestDatabase(): Promise<{
  container: StartedPostgreSqlContainer;
  dataSource: DataSource;
}> {
  if (initPromise) return initPromise;

  initPromise = (async () => {
    const c = await new PostgreSqlContainer("postgres:16-alpine").start();
    container = c;

    const databaseUrl = `postgresql://${c.getUsername()}:${c.getPassword()}@${c.getHost()}:${c.getPort()}/${c.getDatabase()}`;
    process.env.DATABASE_URL = databaseUrl;

    execSync("npm run migration:run", {
      env: { ...process.env, DATABASE_URL: databaseUrl },
      stdio: "inherit",
      cwd: projectRoot,
    });

    const ds = new DataSource({
      type: "postgres",
      host: c.getHost(),
      port: c.getPort(),
      username: c.getUsername(),
      password: c.getPassword(),
      database: c.getDatabase(),
      entities: [path.join(projectRoot, "src/**/*.entity{.ts,.js}")],
      synchronize: false,
      logging: false,
    });
    await ds.initialize();
    dataSource = ds;

    return { container: c, dataSource: ds };
  })();

  return initPromise;
}

export async function stopTestDatabase(): Promise<void> {
  if (dataSource?.isInitialized) {
    await dataSource.destroy();
    dataSource = null;
  }
  if (container) {
    await container.stop();
    container = null;
  }
  initPromise = null;
}
export function getTestDataSource(): DataSource {
  if (!dataSource) {
    throw new Error(
      "Test database not started. Call startTestDatabase() first.",
    );
  }
  return dataSource;
}
export function getTestDatabaseUrl(): string {
  if (!process.env.DATABASE_URL) {
    throw new Error(
      "Test database not started. Call startTestDatabase() first.",
    );
  }
  return process.env.DATABASE_URL;
}
