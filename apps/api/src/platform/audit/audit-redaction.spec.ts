import {
  AuditPayloadTooLargeError,
  MAX_SNAPSHOT_BYTES,
  isSecretKey,
  toAuditSnapshot,
} from "./audit-redaction.js";

describe("isSecretKey", () => {
  it.each([
    "password",
    "passwordHash",
    "password_hash",
    "newPassword",
    "token",
    "tokenHash",
    "refreshToken",
    "activation_token",
    "accessToken",
    "secret",
    "clientSecret",
    "authorization",
    "otp",
    "otpCode",
    "apiKey",
    "api_key",
    "api-key",
    "credentials",
  ])("treats %s as secret", (key) => {
    expect(isSecretKey(key)).toBe(true);
  });

  it.each([
    "fullName",
    "status",
    "footprint", // contains the letters "otp" but is not the word
    "hotpot",
    "employeeCode",
    "designationId",
    "reason",
  ])("does not treat %s as secret", (key) => {
    expect(isSecretKey(key)).toBe(false);
  });
});

describe("toAuditSnapshot", () => {
  it("returns undefined for null/undefined", () => {
    expect(toAuditSnapshot(undefined)).toBeUndefined();
    expect(toAuditSnapshot(null)).toBeUndefined();
  });

  it("redacts secrets at any depth but keeps the key, and never the value", () => {
    const snapshot = toAuditSnapshot({
      fullName: "Asha",
      passwordHash: "$2b$10$abc",
      nested: {
        activationToken: "raw-token-123",
        deep: [{ refreshToken: "r", ok: 1 }],
      },
    });
    expect(snapshot).toEqual({
      fullName: "Asha",
      passwordHash: "[redacted]",
      nested: {
        activationToken: "[redacted]",
        deep: [{ refreshToken: "[redacted]", ok: 1 }],
      },
    });
    expect(JSON.stringify(snapshot)).not.toMatch(/raw-token-123|\$2b\$10/);
  });

  it("converts dates and bigints so the JSON column accepts them", () => {
    expect(
      toAuditSnapshot({ at: new Date("2026-09-30T01:02:03.000Z"), id: 12n }),
    ).toEqual({ at: "2026-09-30T01:02:03.000Z", id: "12" });
  });

  it("drops undefined properties and keeps null", () => {
    expect(toAuditSnapshot({ a: undefined, b: null, c: 0, d: false })).toEqual({
      b: null,
      c: 0,
      d: false,
    });
  });

  it("does not mutate its input", () => {
    const input = { passwordHash: "x", inner: { token: "y" } };
    toAuditSnapshot(input);
    expect(input).toEqual({ passwordHash: "x", inner: { token: "y" } });
  });

  it("rejects an oversized snapshot instead of truncating it", () => {
    expect(() =>
      toAuditSnapshot({ blob: "x".repeat(MAX_SNAPSHOT_BYTES + 1) }),
    ).toThrow(AuditPayloadTooLargeError);
  });

  it("accepts a snapshot just under the limit", () => {
    expect(() =>
      toAuditSnapshot({ blob: "x".repeat(MAX_SNAPSHOT_BYTES - 64) }),
    ).not.toThrow();
  });

  it("cuts off pathologically deep structures", () => {
    let deep: Record<string, unknown> = { leaf: 1 };
    for (let i = 0; i < 20; i++) deep = { child: deep };
    expect(JSON.stringify(toAuditSnapshot(deep))).toContain("[redacted]");
  });
});
