import {
  BadRequestException,
  Logger,
  UnauthorizedException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { ThrottlerException } from "@nestjs/throttler";
import * as bcrypt from "bcrypt";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { AuthService } from "./auth.service.js";
import type {
  AccessTokenPayload,
  RefreshTokenPayload,
} from "./jwt-payload.interface.js";

const SECRET = "unit-test-secret-at-least-32-characters-long";
const ORG = { id: 1, slug: "acme" };
const PASSWORD = "CorrectHorse1!";

let passwordHash: string;

beforeAll(async () => {
  // Low cost factor keeps the suite fast; compare() works with any cost.
  passwordHash = await bcrypt.hash(PASSWORD, 4);
});

afterEach(() => {
  vi.restoreAllMocks();
});

/** In-memory stand-in for the ioredis calls AuthService makes. */
function makeRedis() {
  const store = new Map<string, string>();
  const ttls = new Map<string, number>();
  let scanSnapshot: string[] = [];
  const redis = {
    store,
    ttls,
    getdel: vi.fn((key: string) => {
      const value = store.get(key) ?? null;
      store.delete(key);
      return Promise.resolve(value);
    }),
    set: vi.fn(
      (key: string, value: string | number, _mode: "EX", ttl: number) => {
        store.set(key, String(value));
        ttls.set(key, ttl);
        return Promise.resolve("OK");
      },
    ),
    del: vi.fn((...keys: string[]) => {
      let removed = 0;
      for (const key of keys) {
        if (store.delete(key)) removed++;
      }
      return Promise.resolve(removed);
    }),
    // Like real SCAN: walks the whole keyspace a page at a time (one key per
    // page here, so multi-page iteration is always exercised) and filters
    // each page by MATCH — a page can come back empty with a non-zero cursor.
    // Keys present for the whole iteration are always returned even if others
    // are deleted mid-scan, so the walk runs over a snapshot taken at cursor 0.
    scan: vi.fn(
      (cursor: string, _match: "MATCH", pattern: string, _count: "COUNT") => {
        const regex = new RegExp(
          `^${pattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*")}$`,
        );
        if (cursor === "0") scanSnapshot = [...store.keys()];
        const all = scanSnapshot;
        const index = Number(cursor);
        const page = all.slice(index, index + 1).filter((k) => regex.test(k));
        const next = index + 1 >= all.length ? "0" : String(index + 1);
        return Promise.resolve([next, page] as [string, string[]]);
      },
    ),
    incr: vi.fn((key: string) => {
      const next = Number(store.get(key) ?? "0") + 1;
      store.set(key, String(next));
      return Promise.resolve(next);
    }),
    expire: vi.fn((key: string, ttl: number) => {
      ttls.set(key, ttl);
      return Promise.resolve(1);
    }),
  };
  return redis;
}

function makeUser(overrides: Record<string, unknown> = {}) {
  return {
    id: 7,
    organizationId: ORG.id,
    email: "jane@acme.test",
    fullName: "Jane Doe",
    passwordHash,
    isActive: true,
    mustChangePassword: false,
    ...overrides,
  };
}

function makeService(configOverrides: Record<string, unknown> = {}) {
  const organizations = { findBySlug: vi.fn().mockResolvedValue(ORG) };
  const users = {
    findByEmail: vi.fn().mockResolvedValue(makeUser()),
    findById: vi.fn().mockResolvedValue(makeUser()),
    updatePasswordHash: vi.fn().mockResolvedValue({ count: 1 }),
  };
  const permissions = {
    invalidate: vi.fn().mockResolvedValue(undefined),
    getRoleIdsForUser: vi.fn().mockResolvedValue([3, 4]),
    getPermissionsForUser: vi
      .fn()
      .mockResolvedValue(["users:read", "roles:read"]),
  };
  const jwt = new JwtService();
  const configValues: Record<string, unknown> = {
    JWT_SECRET: SECRET,
    JWT_ACCESS_TTL_SECONDS: 900,
    JWT_REFRESH_TTL_SECONDS: 3600,
    PASSWORD_RESET_TOKEN_TTL_MINUTES: 30,
    APP_BASE_URL: "https://erp.example.test",
    ...configOverrides,
  };
  const config = {
    getOrThrow: vi.fn((key: string) => {
      if (!(key in configValues)) throw new Error(`Missing config ${key}`);
      return configValues[key];
    }),
  };
  const mailer = {
    sendPasswordResetEmail: vi.fn().mockResolvedValue(undefined),
  };
  const passwordResetTokens = {
    create: vi.fn().mockResolvedValue({ id: 1 }),
    findValidCandidates: vi.fn().mockResolvedValue([]),
    markUsed: vi.fn().mockResolvedValue({ id: 1 }),
  };
  const redis = makeRedis();

  const service = new AuthService(
    organizations as never,
    users as never,
    permissions as never,
    jwt,
    config as never,
    mailer as never,
    passwordResetTokens as never,
    redis as never,
  );
  return {
    service,
    organizations,
    users,
    permissions,
    jwt,
    config,
    mailer,
    passwordResetTokens,
    redis,
  };
}

function refreshKeysFor(
  redis: ReturnType<typeof makeRedis>,
  userId: number,
): string[] {
  return [...redis.store.keys()].filter((k) =>
    k.startsWith(`refresh:${userId}:`),
  );
}

describe("AuthService", () => {
  describe("login()", () => {
    it("issues a signed access token and a Redis-backed refresh token on valid credentials", async () => {
      const { service, jwt, redis, permissions, organizations, users } =
        makeService();

      const tokens = await service.login("acme", "jane@acme.test", PASSWORD);

      expect(organizations.findBySlug).toHaveBeenCalledWith("acme");
      expect(users.findByEmail).toHaveBeenCalledWith(
        { organizationId: ORG.id },
        "jane@acme.test",
      );

      const access = jwt.verify<
        AccessTokenPayload & { exp: number; iat: number }
      >(tokens.accessToken, { secret: SECRET });
      expect(access).toMatchObject({
        sub: 7,
        organizationId: ORG.id,
        roleIds: [3, 4],
        type: "access",
      });
      expect(access.exp - access.iat).toBe(900);

      const refresh = jwt.verify<
        RefreshTokenPayload & { exp: number; iat: number }
      >(tokens.refreshToken, { secret: SECRET });
      expect(refresh.type).toBe("refresh");
      expect(refresh.sub).toBe(7);
      expect(refresh.exp - refresh.iat).toBe(3600);
      // The refresh payload must not carry org/role claims.
      expect(refresh).not.toHaveProperty("roleIds");

      const key = `refresh:7:${refresh.jti}`;
      expect(redis.store.get(key)).toBe(String(ORG.id));
      expect(redis.ttls.get(key)).toBe(3600);

      expect(permissions.invalidate).toHaveBeenCalledWith(7);
    });

    it("issues a fresh jti per login so sessions are independently revocable", async () => {
      const { service, redis } = makeService();
      await service.login("acme", "jane@acme.test", PASSWORD);
      await service.login("acme", "jane@acme.test", PASSWORD);
      expect(refreshKeysFor(redis, 7)).toHaveLength(2);
    });

    it("rejects an unknown organization with the generic credentials error", async () => {
      const { service, organizations, users } = makeService();
      organizations.findBySlug.mockResolvedValue(null);

      await expect(
        service.login("nope", "jane@acme.test", PASSWORD),
      ).rejects.toThrow(
        new UnauthorizedException("Invalid organization, email, or password"),
      );
      expect(users.findByEmail).not.toHaveBeenCalled();
    });

    it("rejects an unknown email with the same generic error", async () => {
      const { service, users, redis } = makeService();
      users.findByEmail.mockResolvedValue(null);

      await expect(
        service.login("acme", "ghost@acme.test", PASSWORD),
      ).rejects.toThrow("Invalid organization, email, or password");
      expect(redis.set).not.toHaveBeenCalled();
    });

    it("rejects an inactive user even with the correct password", async () => {
      const { service, users, redis, permissions } = makeService();
      users.findByEmail.mockResolvedValue(makeUser({ isActive: false }));

      await expect(
        service.login("acme", "jane@acme.test", PASSWORD),
      ).rejects.toBeInstanceOf(UnauthorizedException);
      expect(redis.set).not.toHaveBeenCalled();
      expect(permissions.getRoleIdsForUser).not.toHaveBeenCalled();
    });

    it("rejects a wrong password with the same generic error and issues no tokens", async () => {
      const { service, redis, permissions } = makeService();

      await expect(
        service.login("acme", "jane@acme.test", "WrongPassword1!"),
      ).rejects.toThrow("Invalid organization, email, or password");
      expect(redis.set).not.toHaveBeenCalled();
      expect(permissions.invalidate).not.toHaveBeenCalled();
    });
  });

  describe("refresh()", () => {
    it("rotates: returns new tokens and deletes the old refresh key", async () => {
      const { service, jwt, redis } = makeService();
      const first = await service.login("acme", "jane@acme.test", PASSWORD);
      const oldJti = jwt.decode<RefreshTokenPayload>(first.refreshToken).jti;

      const second = await service.refresh(first.refreshToken);

      const newJti = jwt.decode<RefreshTokenPayload>(second.refreshToken).jti;
      expect(newJti).not.toBe(oldJti);
      expect(redis.store.has(`refresh:7:${oldJti}`)).toBe(false);
      expect(redis.store.get(`refresh:7:${newJti}`)).toBe(String(ORG.id));
      const access = jwt.verify<AccessTokenPayload>(second.accessToken, {
        secret: SECRET,
      });
      expect(access.organizationId).toBe(ORG.id);
      expect(access.type).toBe("access");
    });

    it("parses the organizationId stored in Redis back to a number for the user lookup", async () => {
      const { service, users } = makeService();
      const tokens = await service.login("acme", "jane@acme.test", PASSWORD);

      await service.refresh(tokens.refreshToken);

      expect(users.findById).toHaveBeenCalledWith({ organizationId: 1 }, 7);
    });

    it("rejects reuse of an already-rotated refresh token", async () => {
      const { service } = makeService();
      const tokens = await service.login("acme", "jane@acme.test", PASSWORD);
      await service.refresh(tokens.refreshToken);

      await expect(service.refresh(tokens.refreshToken)).rejects.toThrow(
        new UnauthorizedException("Refresh token has been revoked or expired"),
      );
    });

    it("rejects a refresh token whose Redis entry has been revoked (logout)", async () => {
      const { service } = makeService();
      const tokens = await service.login("acme", "jane@acme.test", PASSWORD);
      await service.logout(7);

      await expect(service.refresh(tokens.refreshToken)).rejects.toThrow(
        "Refresh token has been revoked or expired",
      );
    });

    it("rejects an access token presented as a refresh token", async () => {
      const { service, redis } = makeService();
      const tokens = await service.login("acme", "jane@acme.test", PASSWORD);

      await expect(service.refresh(tokens.accessToken)).rejects.toThrow(
        new UnauthorizedException("Not a refresh token"),
      );
      expect(redis.getdel).not.toHaveBeenCalled();
    });

    it("rejects a token signed with a different secret", async () => {
      const { service, jwt } = makeService();
      const forged = jwt.sign(
        { sub: 7, jti: "abc", type: "refresh" },
        { secret: "attacker-controlled-secret-0123456789abcdef" },
      );

      await expect(service.refresh(forged)).rejects.toThrow(
        new UnauthorizedException("Invalid or expired refresh token"),
      );
    });

    it("rejects an expired refresh token even if its Redis key still exists", async () => {
      const { service, jwt, redis } = makeService();
      const expired = jwt.sign(
        {
          sub: 7,
          jti: "expired-jti",
          type: "refresh",
          exp: Math.floor(Date.now() / 1000) - 60,
        },
        { secret: SECRET },
      );
      redis.store.set("refresh:7:expired-jti", "1");

      await expect(service.refresh(expired)).rejects.toThrow(
        "Invalid or expired refresh token",
      );
      expect(redis.store.has("refresh:7:expired-jti")).toBe(true);
    });

    it("rejects garbage input", async () => {
      const { service } = makeService();
      await expect(service.refresh("not-a-jwt")).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it("rejects when the user no longer exists, and still burns the presented token", async () => {
      const { service, users, redis, jwt } = makeService();
      const tokens = await service.login("acme", "jane@acme.test", PASSWORD);
      const jti = jwt.decode<RefreshTokenPayload>(tokens.refreshToken).jti;
      users.findById.mockResolvedValue(null);

      await expect(service.refresh(tokens.refreshToken)).rejects.toThrow(
        new UnauthorizedException("User no longer exists"),
      );
      expect(redis.store.has(`refresh:7:${jti}`)).toBe(false);
      expect(refreshKeysFor(redis, 7)).toHaveLength(0);
    });

    it("rejects a deactivated user and revokes all of their sessions", async () => {
      const { service, users, redis } = makeService();
      const first = await service.login("acme", "jane@acme.test", PASSWORD);
      await service.login("acme", "jane@acme.test", PASSWORD);
      users.findById.mockResolvedValue(makeUser({ isActive: false }));

      await expect(service.refresh(first.refreshToken)).rejects.toThrow(
        new UnauthorizedException("User no longer exists"),
      );
      expect(refreshKeysFor(redis, 7)).toHaveLength(0);
    });

    it("lets only one of two concurrent refreshes with the same token succeed", async () => {
      const { service } = makeService();
      const tokens = await service.login("acme", "jane@acme.test", PASSWORD);

      const results = await Promise.allSettled([
        service.refresh(tokens.refreshToken),
        service.refresh(tokens.refreshToken),
      ]);

      expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
      expect(results.filter((r) => r.status === "rejected")).toHaveLength(1);
    });

    it("looks the user up in the org stored server-side, not one the client could influence", async () => {
      const { service, users, redis, jwt } = makeService();
      const tokens = await service.login("acme", "jane@acme.test", PASSWORD);
      const jti = jwt.decode<RefreshTokenPayload>(tokens.refreshToken).jti;
      redis.store.set(`refresh:7:${jti}`, "99");

      await service.refresh(tokens.refreshToken);

      expect(users.findById).toHaveBeenCalledWith({ organizationId: 99 }, 7);
    });
  });

  describe("logout()", () => {
    it("revokes every refresh token for the user and leaves other users' sessions alone", async () => {
      const { service, redis, permissions } = makeService();
      await service.login("acme", "jane@acme.test", PASSWORD);
      await service.login("acme", "jane@acme.test", PASSWORD);
      redis.store.set("refresh:8:other-user", "1");
      // A user whose id shares a prefix must not be caught by the pattern.
      redis.store.set("refresh:70:prefix-user", "1");

      await service.logout(7);

      expect(refreshKeysFor(redis, 7)).toHaveLength(0);
      expect(redis.store.has("refresh:8:other-user")).toBe(true);
      expect(redis.store.has("refresh:70:prefix-user")).toBe(true);
      expect(redis.scan).toHaveBeenCalledWith(
        "0",
        "MATCH",
        "refresh:7:*",
        "COUNT",
        100,
      );
      expect(permissions.invalidate).toHaveBeenCalledWith(7);
    });

    it("does not call DEL with no arguments when the user has no sessions", async () => {
      const { service, redis, permissions } = makeService();

      await service.logout(7);

      expect(redis.del).not.toHaveBeenCalled();
      expect(permissions.invalidate).toHaveBeenCalledWith(7);
    });
  });

  describe("forgotPassword()", () => {
    it("stores only a bcrypt hash of the token and emails the raw token link", async () => {
      vi.spyOn(Date, "now").mockReturnValue(1_700_000_000_000);
      const { service, passwordResetTokens, mailer } = makeService();

      await service.forgotPassword("acme", "jane@acme.test");

      expect(passwordResetTokens.create).toHaveBeenCalledTimes(1);
      const [userId, tokenHash, expiresAt] = passwordResetTokens.create.mock
        .calls[0] as [number, string, Date];
      expect(userId).toBe(7);
      expect(expiresAt.getTime()).toBe(1_700_000_000_000 + 30 * 60_000);

      expect(mailer.sendPasswordResetEmail).toHaveBeenCalledTimes(1);
      const [to, url] = mailer.sendPasswordResetEmail.mock.calls[0] as [
        string,
        string,
      ];
      expect(to).toBe("jane@acme.test");
      const match =
        /^https:\/\/erp\.example\.test\/reset-password\?token=([0-9a-f]{64})$/.exec(
          url,
        );
      expect(match).not.toBeNull();
      const rawToken = match![1]!;
      expect(tokenHash).not.toContain(rawToken);
      expect(await bcrypt.compare(rawToken, tokenHash)).toBe(true);
    });

    it("silently does nothing for an unknown organization", async () => {
      const { service, organizations, users, passwordResetTokens, mailer } =
        makeService();
      organizations.findBySlug.mockResolvedValue(null);

      await expect(
        service.forgotPassword("nope", "jane@acme.test"),
      ).resolves.toBeUndefined();
      expect(users.findByEmail).not.toHaveBeenCalled();
      expect(passwordResetTokens.create).not.toHaveBeenCalled();
      expect(mailer.sendPasswordResetEmail).not.toHaveBeenCalled();
    });

    it("silently does nothing for an unknown email", async () => {
      const { service, users, passwordResetTokens, mailer } = makeService();
      users.findByEmail.mockResolvedValue(null);

      await expect(
        service.forgotPassword("acme", "ghost@acme.test"),
      ).resolves.toBeUndefined();
      expect(passwordResetTokens.create).not.toHaveBeenCalled();
      expect(mailer.sendPasswordResetEmail).not.toHaveBeenCalled();
    });

    it("silently does nothing for an inactive user", async () => {
      const { service, users, passwordResetTokens, mailer } = makeService();
      users.findByEmail.mockResolvedValue(makeUser({ isActive: false }));

      await expect(
        service.forgotPassword("acme", "jane@acme.test"),
      ).resolves.toBeUndefined();
      expect(passwordResetTokens.create).not.toHaveBeenCalled();
      expect(mailer.sendPasswordResetEmail).not.toHaveBeenCalled();
    });

    it("throttles after 3 attempts per email (case-insensitive) with a 15-minute window", async () => {
      const { service, redis, passwordResetTokens } = makeService();

      await service.forgotPassword("acme", "jane@acme.test");
      await service.forgotPassword("acme", "JANE@acme.test");
      await service.forgotPassword("acme", "Jane@Acme.Test");

      await expect(
        service.forgotPassword("acme", "jane@ACME.test"),
      ).rejects.toBeInstanceOf(ThrottlerException);

      expect(redis.store.get("password-reset-attempts:jane@acme.test")).toBe(
        "4",
      );
      // TTL is set only on the first increment, so the window doesn't slide.
      expect(redis.expire).toHaveBeenCalledTimes(1);
      expect(redis.expire).toHaveBeenCalledWith(
        "password-reset-attempts:jane@acme.test",
        900,
      );
      expect(passwordResetTokens.create).toHaveBeenCalledTimes(3);
    });

    it("throttles a nonexistent email exactly like a real one (no enumeration via the limiter)", async () => {
      const { service, organizations } = makeService();
      organizations.findBySlug.mockResolvedValue(null);

      for (let i = 0; i < 3; i++) {
        await service.forgotPassword("acme", "ghost@acme.test");
      }
      await expect(
        service.forgotPassword("acme", "ghost@acme.test"),
      ).rejects.toBeInstanceOf(ThrottlerException);
    });

    it("checks the limiter before any account lookup", async () => {
      const { service, redis, organizations } = makeService();
      redis.store.set("password-reset-attempts:jane@acme.test", "3");

      await expect(
        service.forgotPassword("acme", "jane@acme.test"),
      ).rejects.toBeInstanceOf(ThrottlerException);
      expect(organizations.findBySlug).not.toHaveBeenCalled();
    });
  });

  describe("resetPassword()", () => {
    async function candidate(
      rawToken: string,
      overrides: Record<string, unknown> = {},
    ) {
      return {
        id: 55,
        userId: 7,
        tokenHash: await bcrypt.hash(rawToken, 4),
        user: makeUser(),
        ...overrides,
      };
    }

    it("matches the raw token against hashed candidates, marks it used, updates the password, and kills all sessions", async () => {
      const { service, passwordResetTokens, users, redis, permissions } =
        makeService();
      passwordResetTokens.findValidCandidates.mockResolvedValue([
        await candidate("other-token", { id: 54, userId: 9 }),
        await candidate("the-token"),
      ]);
      await service.login("acme", "jane@acme.test", PASSWORD);
      expect(refreshKeysFor(redis, 7)).toHaveLength(1);

      await service.resetPassword("the-token", "BrandNewPass1!");

      expect(passwordResetTokens.markUsed).toHaveBeenCalledWith(
        55,
        expect.any(Date),
      );
      const [scope, userId, newHash] = users.updatePasswordHash.mock
        .calls[0] as [{ organizationId: number }, number, string];
      expect(scope).toEqual({ organizationId: ORG.id });
      expect(userId).toBe(7);
      expect(newHash).not.toBe("BrandNewPass1!");
      expect(await bcrypt.compare("BrandNewPass1!", newHash)).toBe(true);
      expect(refreshKeysFor(redis, 7)).toHaveLength(0);
      expect(permissions.invalidate).toHaveBeenCalledWith(7);
    });

    it("marks the token used before changing the password", async () => {
      const { service, passwordResetTokens, users } = makeService();
      passwordResetTokens.findValidCandidates.mockResolvedValue([
        await candidate("the-token"),
      ]);

      await service.resetPassword("the-token", "BrandNewPass1!");

      expect(
        passwordResetTokens.markUsed.mock.invocationCallOrder[0],
      ).toBeLessThan(users.updatePasswordHash.mock.invocationCallOrder[0]!);
    });

    it("only queries candidates that are valid as of now", async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
      vi.spyOn(Logger.prototype, "warn").mockImplementation(() => undefined);
      try {
        const { service, passwordResetTokens } = makeService();
        await expect(service.resetPassword("x", "y")).rejects.toBeInstanceOf(
          UnauthorizedException,
        );
        expect(passwordResetTokens.findValidCandidates).toHaveBeenCalledWith(
          new Date("2026-01-01T00:00:00Z"),
        );
      } finally {
        vi.useRealTimers();
      }
    });

    it("rejects an unknown/expired/used token with one generic error and changes nothing", async () => {
      const { service, passwordResetTokens, users, redis } = makeService();
      vi.spyOn(Logger.prototype, "warn").mockImplementation(() => undefined);
      passwordResetTokens.findValidCandidates.mockResolvedValue([
        await candidate("some-other-token"),
      ]);

      await expect(
        service.resetPassword("guessed-token", "BrandNewPass1!"),
      ).rejects.toThrow(
        new UnauthorizedException("Invalid or expired reset link"),
      );
      expect(passwordResetTokens.markUsed).not.toHaveBeenCalled();
      expect(users.updatePasswordHash).not.toHaveBeenCalled();
      expect(redis.scan).not.toHaveBeenCalled();
    });

    it("rejects a valid token belonging to an inactive user with the same generic error", async () => {
      const { service, passwordResetTokens, users } = makeService();
      const warn = vi
        .spyOn(Logger.prototype, "warn")
        .mockImplementation(() => undefined);
      passwordResetTokens.findValidCandidates.mockResolvedValue([
        await candidate("the-token", { user: makeUser({ isActive: false }) }),
      ]);

      await expect(
        service.resetPassword("the-token", "BrandNewPass1!"),
      ).rejects.toThrow("Invalid or expired reset link");
      expect(passwordResetTokens.markUsed).not.toHaveBeenCalled();
      expect(users.updatePasswordHash).not.toHaveBeenCalled();
      expect(warn).toHaveBeenCalledWith(expect.stringContaining("inactive"));
    });
  });

  describe("changePassword()", () => {
    it("updates the hash, revokes all sessions and invalidates permissions", async () => {
      const { service, users, redis, permissions } = makeService();
      await service.login("acme", "jane@acme.test", PASSWORD);

      await service.changePassword(7, ORG.id, PASSWORD, "AnotherPass2!");

      expect(users.findById).toHaveBeenCalledWith(
        { organizationId: ORG.id },
        7,
      );
      const [, , newHash] = users.updatePasswordHash.mock.calls[0] as [
        unknown,
        number,
        string,
      ];
      expect(await bcrypt.compare("AnotherPass2!", newHash)).toBe(true);
      expect(refreshKeysFor(redis, 7)).toHaveLength(0);
      expect(permissions.invalidate).toHaveBeenCalledWith(7);
    });

    it("rejects a wrong current password", async () => {
      const { service, users } = makeService();
      await expect(
        service.changePassword(7, ORG.id, "nope", "AnotherPass2!"),
      ).rejects.toThrow(
        new UnauthorizedException("Current password is incorrect"),
      );
      expect(users.updatePasswordHash).not.toHaveBeenCalled();
    });

    it("rejects reusing the current password", async () => {
      const { service, users } = makeService();
      await expect(
        service.changePassword(7, ORG.id, PASSWORD, PASSWORD),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(users.updatePasswordHash).not.toHaveBeenCalled();
    });

    it("rejects a missing user", async () => {
      const { service, users } = makeService();
      users.findById.mockResolvedValue(null);
      await expect(
        service.changePassword(7, ORG.id, PASSWORD, "AnotherPass2!"),
      ).rejects.toThrow(new UnauthorizedException("User not found"));
    });

    it("rejects an inactive user", async () => {
      const { service, users } = makeService();
      users.findById.mockResolvedValue(makeUser({ isActive: false }));
      await expect(
        service.changePassword(7, ORG.id, PASSWORD, "AnotherPass2!"),
      ).rejects.toBeInstanceOf(UnauthorizedException);
      expect(users.updatePasswordHash).not.toHaveBeenCalled();
    });
  });

  describe("getMe()", () => {
    it("returns the profile with roles and permissions and never the password hash", async () => {
      const { service, users } = makeService();
      users.findById.mockResolvedValue(makeUser({ mustChangePassword: true }));

      const me = await service.getMe(7, ORG.id);

      expect(me).toEqual({
        userId: 7,
        organizationId: ORG.id,
        email: "jane@acme.test",
        fullName: "Jane Doe",
        mustChangePassword: true,
        roleIds: [3, 4],
        permissions: ["users:read", "roles:read"],
      });
      expect(me).not.toHaveProperty("passwordHash");
      expect(users.findById).toHaveBeenCalledWith(
        { organizationId: ORG.id },
        7,
      );
    });

    it("rejects when the user is not found in the caller's org", async () => {
      const { service, users } = makeService();
      users.findById.mockResolvedValue(null);
      await expect(service.getMe(7, 2)).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });
  });

  it("fails closed when JWT_SECRET is not configured", async () => {
    const { service, config, redis } = makeService();
    config.getOrThrow.mockImplementation((key: string) => {
      throw new Error(`Missing config ${key}`);
    });
    await expect(
      service.login("acme", "jane@acme.test", PASSWORD),
    ).rejects.toThrow("Missing config JWT_SECRET");
    expect(redis.set).not.toHaveBeenCalled();
  });
});
