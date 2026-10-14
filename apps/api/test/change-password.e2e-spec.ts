import type { INestApplication } from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";
import type { Server } from "node:http";
import { randomUUID } from "node:crypto";
import request from "supertest";
import * as bcrypt from "bcrypt";
import { AppModule } from "../src/app.module.js";
import { PrismaService } from "../src/shared/prisma/prisma.service.js";

interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

describe("change password (e2e)", () => {
  let app: INestApplication<Server>;
  let prisma: PrismaService;

  let org: { id: number; slug: string };
  let user: { id: number; email: string };

  const TEMP = "TempPass123!";
  const NEW = "BrandNew456!";

  const tokensOf = async (password: string): Promise<TokenPair> =>
    ((await login(password).expect(201)).body as { data: TokenPair }).data;

  const login = (password: string) =>
    request(app.getHttpServer())
      .post("/auth/login")
      .send({ organizationSlug: org.slug, email: user.email, password });

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    await app.init();
    prisma = app.get(PrismaService);

    const suffix = randomUUID().slice(0, 8);
    org = await prisma.organization.create({
      data: { name: `CP Org ${suffix}`, slug: `cp-org-${suffix}` },
    });
    user = await prisma.user.create({
      data: {
        organizationId: org.id,
        email: `cp-${suffix}@example.com`,
        fullName: "Change Tester",
        passwordHash: await bcrypt.hash(TEMP, 10),
        mustChangePassword: true,
      },
    });
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { organizationId: org.id } });
    await prisma.organization.delete({ where: { id: org.id } });
    await app.close();
  });

  it("reports mustChangePassword=true to a freshly created account", async () => {
    const res = await login(TEMP).expect(201);
    const tokens = (res.body as { data: TokenPair }).data;
    const me = await request(app.getHttpServer())
      .get("/auth/me")
      .set("Authorization", `Bearer ${tokens.accessToken}`)
      .expect(200);
    expect(
      (me.body as { data: { mustChangePassword: boolean } }).data
        .mustChangePassword,
    ).toBe(true);
  });

  it("rejects an unauthenticated change", async () => {
    await request(app.getHttpServer())
      .post("/auth/change-password")
      .send({ currentPassword: TEMP, newPassword: NEW })
      .expect(401);
  });

  it("rejects a wrong current password", async () => {
    const { accessToken } = await tokensOf(TEMP);
    await request(app.getHttpServer())
      .post("/auth/change-password")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ currentPassword: "not-the-password", newPassword: NEW })
      .expect(401);
  });

  it("rejects a new password equal to the current one", async () => {
    const { accessToken } = await tokensOf(TEMP);
    await request(app.getHttpServer())
      .post("/auth/change-password")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ currentPassword: TEMP, newPassword: TEMP })
      .expect(400);
  });

  it("rejects a new password shorter than 8 characters", async () => {
    const { accessToken } = await tokensOf(TEMP);
    await request(app.getHttpServer())
      .post("/auth/change-password")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ currentPassword: TEMP, newPassword: "short" })
      .expect(400);
  });

  it.each([
    ["no uppercase", "lowercase1!"],
    ["no lowercase", "UPPERCASE1!"],
    ["no digit", "NoDigits!!"],
    ["no special character", "NoSpecial12"],
  ])("rejects a new password with %s", async (_label, weak) => {
    const { accessToken } = await tokensOf(TEMP);
    await request(app.getHttpServer())
      .post("/auth/change-password")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ currentPassword: TEMP, newPassword: weak })
      .expect(400);
  });

  it("changes the password, clears the flag, and revokes every session", async () => {
    const before = await tokensOf(TEMP);

    await request(app.getHttpServer())
      .post("/auth/change-password")
      .set("Authorization", `Bearer ${before.accessToken}`)
      .send({ currentPassword: TEMP, newPassword: NEW })
      .expect(201);

    // Old refresh token is revoked.
    await request(app.getHttpServer())
      .post("/auth/refresh")
      .send({ refreshToken: before.refreshToken })
      .expect(401);

    // Old password no longer works; new one does.
    await login(TEMP).expect(401);
    const after = await tokensOf(NEW);

    const me = await request(app.getHttpServer())
      .get("/auth/me")
      .set("Authorization", `Bearer ${after.accessToken}`)
      .expect(200);
    expect(
      (me.body as { data: { mustChangePassword: boolean } }).data
        .mustChangePassword,
    ).toBe(false);
  });
});
