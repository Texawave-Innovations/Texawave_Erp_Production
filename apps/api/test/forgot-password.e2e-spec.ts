import type { INestApplication } from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";
import type { Server } from "node:http";
import { randomUUID } from "node:crypto";
import request from "supertest";
import * as bcrypt from "bcrypt";
import type { Redis } from "ioredis";
import { AppModule } from "../src/app.module.js";
import { PrismaService } from "../src/shared/prisma/prisma.service.js";
import { REDIS_CLIENT } from "../src/shared/redis/redis.constants.js";

/**
 * Proves the anti-enumeration requirement structurally, not just by
 * convention: a real account, a wrong email, and a wrong org slug must all
 * produce the exact same response — and only the real account may ever get
 * a PasswordResetToken row. Also proves tokenHash is never the raw token
 * (Docs' auth story non-negotiable).
 */
describe("forgot-password (e2e)", () => {
  let app: INestApplication<Server>;
  let prisma: PrismaService;
  let redis: Redis;

  let org: { id: number; slug: string };
  let activeUser: { id: number; email: string };
  let inactiveUser: { id: number; email: string };

  const GENERIC_MESSAGE = {
    message: "If that account exists, a reset link has been sent.",
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
    prisma = app.get(PrismaService);
    redis = app.get(REDIS_CLIENT);

    const suffix = randomUUID().slice(0, 8);
    const passwordHash = await bcrypt.hash("Password123!", 10);

    org = await prisma.organization.create({
      data: { name: `Forgot Password Org ${suffix}`, slug: `fp-org-${suffix}` },
    });

    activeUser = await prisma.user.create({
      data: {
        organizationId: org.id,
        email: `active-${suffix}@fp.test`,
        passwordHash,
        fullName: "Active User",
      },
    });

    inactiveUser = await prisma.user.create({
      data: {
        organizationId: org.id,
        email: `inactive-${suffix}@fp.test`,
        passwordHash,
        fullName: "Inactive User",
        isActive: false,
      },
    });
  });

  afterAll(async () => {
    await prisma.passwordResetToken.deleteMany({
      where: { userId: { in: [activeUser.id, inactiveUser.id] } },
    });
    await prisma.user.deleteMany({
      where: { organizationId: org.id },
    });
    await prisma.organization.delete({ where: { id: org.id } });
    await app.close();
  });

  it("returns the generic message and creates a token for a real, active user", async () => {
    const response = await request(app.getHttpServer())
      .post("/auth/forgot-password")
      .send({ organizationSlug: org.slug, email: activeUser.email })
      .expect(201);
    expect((response.body as { data: unknown }).data).toEqual(GENERIC_MESSAGE);

    const tokens = await prisma.passwordResetToken.findMany({
      where: { userId: activeUser.id },
    });
    expect(tokens).toHaveLength(1);

    // Never the raw token — only a hash (Docs' auth story non-negotiable).
    expect(tokens[0]!.tokenHash).toMatch(/^\$2[aby]\$/);
    expect(tokens[0]!.usedAt).toBeNull();

    const ttlMs =
      tokens[0]!.expiresAt.getTime() - tokens[0]!.createdAt.getTime();
    expect(ttlMs).toBeGreaterThan(29 * 60_000);
    expect(ttlMs).toBeLessThan(31 * 60_000);
  });

  it("returns the exact same response for an email that doesn't exist", async () => {
    const response = await request(app.getHttpServer())
      .post("/auth/forgot-password")
      .send({ organizationSlug: org.slug, email: "nobody@fp.test" })
      .expect(201);
    expect((response.body as { data: unknown }).data).toEqual(GENERIC_MESSAGE);

    const tokens = await prisma.user
      .findFirst({ where: { email: "nobody@fp.test" } })
      .then(() =>
        prisma.passwordResetToken.findMany({
          where: { user: { email: "nobody@fp.test" } },
        }),
      );
    expect(tokens).toHaveLength(0);
  });

  it("returns the exact same response for an organization slug that doesn't exist", async () => {
    const response = await request(app.getHttpServer())
      .post("/auth/forgot-password")
      .send({ organizationSlug: "no-such-org", email: activeUser.email })
      .expect(201);
    expect((response.body as { data: unknown }).data).toEqual(GENERIC_MESSAGE);
  });

  it("returns the exact same response for a deactivated user and creates no token", async () => {
    const response = await request(app.getHttpServer())
      .post("/auth/forgot-password")
      .send({ organizationSlug: org.slug, email: inactiveUser.email })
      .expect(201);
    expect((response.body as { data: unknown }).data).toEqual(GENERIC_MESSAGE);

    const tokens = await prisma.passwordResetToken.findMany({
      where: { userId: inactiveUser.id },
    });
    expect(tokens).toHaveLength(0);
  });

  it("rejects a malformed email with 400", async () => {
    await request(app.getHttpServer())
      .post("/auth/forgot-password")
      .send({ organizationSlug: org.slug, email: "not-an-email" })
      .expect(400);
  });

  it("rejects a missing organizationSlug with 400", async () => {
    await request(app.getHttpServer())
      .post("/auth/forgot-password")
      .send({ email: activeUser.email })
      .expect(400);
  });

  it("rate-limits repeated requests for the same email, real or fake", async () => {
    const targetEmail = `rate-limit-target-${randomUUID().slice(0, 8)}@fp.test`;

    // Limit is 3/15min per email (AuthService.forgotPassword) — the first 3
    // succeed with the same generic response as every other case above.
    for (let i = 0; i < 3; i++) {
      await request(app.getHttpServer())
        .post("/auth/forgot-password")
        .send({ organizationSlug: org.slug, email: targetEmail })
        .expect(201);
    }

    // The 4th trips the limit — same threshold whether or not the email is
    // real, so this can't be used to distinguish existing from non-existing
    // accounts (only that this exact email string was requested too often).
    await request(app.getHttpServer())
      .post("/auth/forgot-password")
      .send({ organizationSlug: org.slug, email: targetEmail })
      .expect(429);

    await redis.del(`password-reset-attempts:${targetEmail.toLowerCase()}`);
  });
});
