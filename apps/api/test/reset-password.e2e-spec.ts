import type { INestApplication } from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";
import type { Server } from "node:http";
import { randomBytes, randomUUID } from "node:crypto";
import request from "supertest";
import * as bcrypt from "bcrypt";
import type { Redis } from "ioredis";
import { AppModule } from "../src/app.module.js";
import { PrismaService } from "../src/shared/prisma/prisma.service.js";
import { REDIS_CLIENT } from "../src/shared/redis/redis.constants.js";

/**
 * Proves the non-negotiables from the auth story: a wrong/expired/reused
 * token all get the exact same generic error (never revealing why), a
 * successful reset kills every other active session (Redis refresh-token
 * keys deleted), and the token is single-use.
 */
describe("reset-password (e2e)", () => {
  let app: INestApplication<Server>;
  let prisma: PrismaService;
  let redis: Redis;

  let org: { id: number; slug: string };
  let user: { id: number; email: string };

  const GENERIC_ERROR = "Invalid or expired reset link";

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
    prisma = app.get(PrismaService);
    redis = app.get(REDIS_CLIENT);

    const suffix = randomUUID().slice(0, 8);
    const passwordHash = await bcrypt.hash("OldPassword123!", 10);

    org = await prisma.organization.create({
      data: { name: `Reset Password Org ${suffix}`, slug: `rp-org-${suffix}` },
    });

    user = await prisma.user.create({
      data: {
        organizationId: org.id,
        email: `user-${suffix}@rp.test`,
        passwordHash,
        fullName: "Reset Password User",
      },
    });
  });

  afterAll(async () => {
    await prisma.passwordResetToken.deleteMany({
      where: { userId: user.id },
    });
    await prisma.user.deleteMany({ where: { organizationId: org.id } });
    await prisma.organization.delete({ where: { id: org.id } });
    await app.close();
  });

  async function seedToken(
    overrides: { expiresAt?: Date; usedAt?: Date | null } = {},
  ): Promise<string> {
    const rawToken = randomBytes(32).toString("hex");
    const tokenHash = await bcrypt.hash(rawToken, 10);
    await prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt: overrides.expiresAt ?? new Date(Date.now() + 30 * 60_000),
        usedAt: overrides.usedAt ?? null,
      },
    });
    return rawToken;
  }

  it("resets the password, marks the token used, and revokes every refresh token", async () => {
    const rawToken = await seedToken();

    // Simulate an existing session that must be killed by the reset.
    const refreshKey = `refresh:${user.id}:${randomUUID()}`;
    await redis.set(refreshKey, org.id, "EX", 60);

    const response = await request(app.getHttpServer())
      .post("/auth/reset-password")
      .send({ token: rawToken, newPassword: "NewPassword123!" })
      .expect(201);
    expect((response.body as { data: { message: string } }).data.message).toBe(
      "Password has been reset.",
    );

    const updatedUser = await prisma.user.findUniqueOrThrow({
      where: { id: user.id },
    });
    expect(
      await bcrypt.compare("NewPassword123!", updatedUser.passwordHash),
    ).toBe(true);

    const tokens = await prisma.passwordResetToken.findMany({
      where: { userId: user.id },
    });
    expect(tokens.every((t) => t.usedAt !== null)).toBe(true);

    expect(await redis.exists(refreshKey)).toBe(0);
  });

  it("rejects a reused token with the generic error", async () => {
    const rawToken = await seedToken({ usedAt: new Date() });

    const response = await request(app.getHttpServer())
      .post("/auth/reset-password")
      .send({ token: rawToken, newPassword: "AnotherPassword123!" })
      .expect(401);
    expect((response.body as { message: string }).message).toBe(GENERIC_ERROR);
  });

  it("rejects an expired token with the generic error", async () => {
    const rawToken = await seedToken({
      expiresAt: new Date(Date.now() - 60_000),
    });

    const response = await request(app.getHttpServer())
      .post("/auth/reset-password")
      .send({ token: rawToken, newPassword: "AnotherPassword123!" })
      .expect(401);
    expect((response.body as { message: string }).message).toBe(GENERIC_ERROR);
  });

  it("rejects an invalid/garbage token with the generic error", async () => {
    const response = await request(app.getHttpServer())
      .post("/auth/reset-password")
      .send({ token: "not-a-real-token", newPassword: "AnotherPassword123!" })
      .expect(401);
    expect((response.body as { message: string }).message).toBe(GENERIC_ERROR);
  });

  it("rejects a password shorter than 8 characters with 400", async () => {
    const rawToken = await seedToken();
    await request(app.getHttpServer())
      .post("/auth/reset-password")
      .send({ token: rawToken, newPassword: "short" })
      .expect(400);
  });
});
