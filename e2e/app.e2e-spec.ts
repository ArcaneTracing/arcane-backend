import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication } from "@nestjs/common";
import request from "supertest";
import { AppModule } from "../src/app.module";
import {
  startTestDatabase,
  stopTestDatabase,
} from "./setup/setup-testcontainers";

jest.setTimeout(60_000);

describe("App (e2e)", () => {
  let app: INestApplication;

  beforeAll(async () => {
    await startTestDatabase();
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  }, 60_000);

  afterAll(async () => {
    await app?.close();
    await stopTestDatabase();
  });

  it("/health (GET)", () => {
    return request(app.getHttpServer()).get("/health").expect(200);
  });
});
