import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication } from "@nestjs/common";
import request from "supertest";
import type { Server } from "node:http";
import { AppModule } from "./../src/app.module.js";

describe("AppController (e2e)", () => {
  let app: INestApplication<Server>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  it("/ (GET)", () => {
    // Wrapped in the { data } envelope by the global ResponseInterceptor
    // (Docs/CODING_STANDARDS.md §9) — this route predates that interceptor
    // and was updated to expect it rather than opting out with
    // @RawResponse(), since there's no reason for it to be an exception.
    return request(app.getHttpServer())
      .get("/")
      .expect(200)
      .expect({ data: "Hello World!" });
  });

  afterEach(async () => {
    await app.close();
  });
});
