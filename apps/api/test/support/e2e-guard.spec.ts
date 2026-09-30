import {
  OVERRIDE_PHRASE,
  assessE2eEnvironment,
  databaseName,
  explain,
  redisDbIndex,
} from "./e2e-guard.js";

const OK_DB = "postgresql://u:p@localhost:5432/texawave_erp_test?schema=public";
const OK_REDIS = "redis://localhost:6379/5";

describe("databaseName / redisDbIndex", () => {
  it("reads the database name and Redis DB index", () => {
    expect(databaseName(OK_DB)).toBe("texawave_erp_test");
    expect(databaseName("postgresql://u:p@h/db%5Fx")).toBe("db_x");
    expect(databaseName(undefined)).toBeUndefined();
    expect(databaseName("not a url")).toBeUndefined();
    expect(redisDbIndex(OK_REDIS)).toBe(5);
    expect(redisDbIndex("redis://localhost:6379")).toBe(0);
    expect(redisDbIndex("redis://localhost:6379/")).toBe(0);
    expect(redisDbIndex(undefined)).toBe(0);
  });
});

describe("assessE2eEnvironment", () => {
  it("accepts a disposable database with its own Redis index", () => {
    expect(
      assessE2eEnvironment({ DATABASE_URL: OK_DB, REDIS_URL: OK_REDIS }),
    ).toEqual({ ok: true, problems: [] });
  });

  it.each([
    "postgresql://u:p@localhost:5432/texawave_erp_test?schema=public",
    "postgresql://u:p@localhost:5432/e2e",
    "postgresql://u:p@localhost:5432/analysis-e2e-run",
    "postgresql://u:p@localhost:5432/TEST_db",
  ])("accepts disposable-looking name %s", (url) => {
    expect(
      assessE2eEnvironment({ DATABASE_URL: url, REDIS_URL: OK_REDIS }).ok,
    ).toBe(true);
  });

  it.each([
    "postgresql://u:p@localhost:5432/texawave_erp?schema=public", // the dev database
    "postgresql://u:p@localhost:5432/production",
    "postgresql://u:p@localhost:5432/latest_data", // contains 'test' inside a word: not disposable
    "postgresql://u:p@localhost:5432/contest",
    "postgresql://u:p@localhost:5432/",
  ])("refuses shared-looking database %s", (url) => {
    const r = assessE2eEnvironment({ DATABASE_URL: url, REDIS_URL: OK_REDIS });
    expect(r.ok).toBe(false);
    expect(r.problems[0]).toMatch(/DATABASE_URL/);
  });

  it("refuses Redis DB 0 or no index (the shared dev keys)", () => {
    for (const REDIS_URL of [
      "redis://localhost:6379",
      "redis://localhost:6379/0",
      undefined,
    ]) {
      const r = assessE2eEnvironment({ DATABASE_URL: OK_DB, REDIS_URL });
      expect(r.ok).toBe(false);
      expect(r.problems.join(" ")).toMatch(/REDIS_URL/);
    }
  });

  it("reports both problems at once", () => {
    const r = assessE2eEnvironment({
      DATABASE_URL: "postgresql://u:p@h/texawave_erp",
      REDIS_URL: "redis://h",
    });
    expect(r.problems).toHaveLength(2);
  });

  it("is exempt in CI (CI=true)", () => {
    expect(
      assessE2eEnvironment({
        CI: "true",
        DATABASE_URL: "postgresql://u:p@h/texawave_erp",
      }).ok,
    ).toBe(true);
  });

  it("NODE_ENV=test is NOT an exemption — Vitest sets it on every developer machine", () => {
    // Regression: the first version of this guard trusted NODE_ENV=test and so
    // let a local run through to the shared development database.
    const shared = {
      DATABASE_URL: "postgresql://u:p@h/texawave_erp",
      REDIS_URL: "redis://h",
    };
    for (const NODE_ENV of ["test", "development", "production", undefined]) {
      expect(assessE2eEnvironment({ ...shared, NODE_ENV } as never).ok).toBe(
        false,
      );
    }
  });

  it('CI must be exactly "true" — other values do not exempt', () => {
    const shared = {
      DATABASE_URL: "postgresql://u:p@h/texawave_erp",
      REDIS_URL: "redis://h",
    };
    for (const CI of ["1", "yes", "false", "", undefined]) {
      expect(assessE2eEnvironment({ ...shared, CI }).ok).toBe(false);
    }
  });

  it("only the exact override phrase bypasses it — not 'true' or '1'", () => {
    const shared = {
      DATABASE_URL: "postgresql://u:p@h/texawave_erp",
      REDIS_URL: "redis://h",
    };
    expect(
      assessE2eEnvironment({ ...shared, ALLOW_E2E_ON_SHARED_DB: "true" }).ok,
    ).toBe(false);
    expect(
      assessE2eEnvironment({ ...shared, ALLOW_E2E_ON_SHARED_DB: "1" }).ok,
    ).toBe(false);
    expect(
      assessE2eEnvironment({
        ...shared,
        ALLOW_E2E_ON_SHARED_DB: OVERRIDE_PHRASE,
      }).ok,
    ).toBe(true);
  });
});

describe("explain", () => {
  it("tells the developer exactly what to run", () => {
    const text = explain(['DATABASE_URL points at "texawave_erp"']);
    expect(text).toContain("texawave_erp_test");
    expect(text).toContain("redis://localhost:6379/5");
    expect(text).toContain("CI (CI=true) is exempt");
  });
});
