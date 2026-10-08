import { describe, expect, it } from "vitest";
import { validateEnv } from "./env.validation.js";

const KEY = "a".repeat(64);

const minimal = (): Record<string, unknown> => ({
  DATABASE_URL: "postgresql://u:p@localhost:5432/erp",
  REDIS_URL: "redis://localhost:6379/1",
  JWT_SECRET: "x".repeat(32),
  FIELD_ENCRYPTION_KEY: KEY,
});

describe("validateEnv", () => {
  it("applies defaults to a minimal valid environment", () => {
    expect(validateEnv(minimal())).toEqual({
      ...minimal(),
      NODE_ENV: "development",
      PORT: 3000,
      LOG_LEVEL: "info",
      JWT_ACCESS_TTL_SECONDS: 900,
      JWT_REFRESH_TTL_SECONDS: 2_592_000,
      CORS_ORIGIN: "http://localhost:3001",
      TRUST_PROXY_HOPS: 0,
      PASSWORD_RESET_TOKEN_TTL_MINUTES: 30,
      APP_BASE_URL: "http://localhost:3001",
      UPLOAD_DIR: "storage/uploads",
    });
  });

  it("coerces numeric strings from process.env", () => {
    const env = validateEnv({
      ...minimal(),
      NODE_ENV: "production",
      PORT: "8080",
      TRUST_PROXY_HOPS: "2",
      JWT_ACCESS_TTL_SECONDS: "60",
      GMAIL_USER: "a@b.c",
    });
    expect(env).toMatchObject({
      NODE_ENV: "production",
      PORT: 8080,
      TRUST_PROXY_HOPS: 2,
      JWT_ACCESS_TTL_SECONDS: 60,
      GMAIL_USER: "a@b.c",
    });
  });

  it("accepts an upper-case hex encryption key", () => {
    expect(
      validateEnv({ ...minimal(), FIELD_ENCRYPTION_KEY: "AB".repeat(32) })
        .FIELD_ENCRYPTION_KEY,
    ).toBe("AB".repeat(32));
  });

  it("lists every missing required variable in one error", () => {
    let message = "";
    try {
      validateEnv({});
    } catch (e) {
      message = (e as Error).message;
    }
    expect(message).toMatch(/^Invalid environment configuration:\n/);
    for (const key of [
      "DATABASE_URL",
      "REDIS_URL",
      "JWT_SECRET",
      "FIELD_ENCRYPTION_KEY",
    ]) {
      expect(message).toContain(`  - ${key}: `);
    }
  });

  it.each([
    ["JWT_SECRET", "short", /JWT_SECRET must be at least 32 characters/],
    [
      "FIELD_ENCRYPTION_KEY",
      "a".repeat(63),
      /FIELD_ENCRYPTION_KEY must be 64 hex characters/,
    ],
    [
      "FIELD_ENCRYPTION_KEY",
      "g".repeat(64),
      /FIELD_ENCRYPTION_KEY must be 64 hex characters/,
    ],
    ["DATABASE_URL", "not a url", /DATABASE_URL: /],
    ["NODE_ENV", "staging", /NODE_ENV: /],
    ["PORT", "-1", /PORT: /],
    ["TRUST_PROXY_HOPS", "-1", /TRUST_PROXY_HOPS: /],
    ["LOG_LEVEL", "verbose", /LOG_LEVEL: /],
    ["UPLOAD_DIR", "", /UPLOAD_DIR: /],
  ])("rejects an invalid %s (%s)", (key, value, pattern) => {
    expect(() => validateEnv({ ...minimal(), [key]: value })).toThrow(pattern);
  });
});
