import { existsSync, readFileSync } from "node:fs";

/**
 * Refuses to run the API e2e suite against a database or Redis that looks
 * shared. The suites create organizations, users, employees and audit rows —
 * some of which are permanent BY DESIGN (audit_logs and status history are
 * append-only, so a test organization that produced them can never be deleted)
 * — and they use Redis keys derived from numeric user ids, which collide with
 * real users' cache entries. Run them on a disposable database and their own
 * Redis DB index:
 *
 *   DATABASE_URL=postgresql://…/texawave_erp_test?schema=public \
 *   REDIS_URL=redis://localhost:6379/5  pnpm --filter api test:e2e
 *
 * CI (GitHub Actions sets CI=true) runs on an ephemeral service container and
 * is exempt. NOTE: NODE_ENV is deliberately NOT used for the exemption —
 * Vitest sets NODE_ENV=test on every developer machine too, so that check
 * would let the suite run against a real database (it did, once).
 * There is deliberately no flag that flushes anything; nothing here deletes.
 */
export interface E2eEnvironment {
  /** Set to "true" by GitHub Actions (and most CI systems), never by Vitest. */
  CI?: string | undefined;
  DATABASE_URL?: string | undefined;
  REDIS_URL?: string | undefined;
  ALLOW_E2E_ON_SHARED_DB?: string | undefined;
}

export interface Assessment {
  ok: boolean;
  problems: string[];
}

const DISPOSABLE_DB_NAME = /(^|[_-])(test|e2e)([_-]|$)/i;
export const OVERRIDE_PHRASE = "yes-i-understand-this-writes-permanent-rows";

export function databaseName(url: string | undefined): string | undefined {
  if (!url) return undefined;
  try {
    return (
      decodeURIComponent(new URL(url).pathname.replace(/^\//, "")) || undefined
    );
  } catch {
    return undefined;
  }
}

export function redisDbIndex(url: string | undefined): number {
  if (!url) return 0;
  try {
    const path = new URL(url).pathname.replace(/^\//, "");
    return path === "" ? 0 : Number(path);
  } catch {
    return 0;
  }
}

export function assessE2eEnvironment(env: E2eEnvironment): Assessment {
  if (env.CI === "true") return { ok: true, problems: [] };
  if (env.ALLOW_E2E_ON_SHARED_DB === OVERRIDE_PHRASE)
    return { ok: true, problems: [] };

  const problems: string[] = [];
  const db = databaseName(env.DATABASE_URL);
  if (!db || !DISPOSABLE_DB_NAME.test(db)) {
    problems.push(
      `DATABASE_URL points at ${db ? `"${db}"` : "no database"}, which does not look disposable ` +
        `(its name must contain "test" or "e2e", e.g. texawave_erp_test).`,
    );
  }
  const index = redisDbIndex(env.REDIS_URL);
  if (!Number.isInteger(index) || index < 1) {
    problems.push(
      `REDIS_URL uses Redis DB ${Number.isInteger(index) ? index : "?"}; use a dedicated non-zero index ` +
        `such as redis://localhost:6379/5 so test cache keys cannot collide with real users'.`,
    );
  }
  return { ok: problems.length === 0, problems };
}

/** Minimal `KEY=value` reader for apps/api/.env — only used to see what the app
 * WOULD connect to when the variables are not set in the shell. */
export function readDotenv(path: string): Record<string, string> {
  if (!existsSync(path)) return {};
  const out: Record<string, string> = {};
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line);
    if (!m || line.trimStart().startsWith("#")) continue;
    out[m[1] as string] = (m[2] as string).replace(/^["']|["']$/g, "");
  }
  return out;
}

export function explain(problems: string[]): string {
  return [
    "Refusing to run the e2e suite against what looks like a shared database/Redis:",
    ...problems.map((p) => `  - ${p}`),
    "",
    "These tests create permanent rows (audit and status history are append-only) and",
    "Redis keys keyed by user id. Point them at a disposable database and their own Redis DB:",
    "",
    "  DATABASE_URL=postgresql://USER:PASS@localhost:5432/texawave_erp_test?schema=public \\",
    "  REDIS_URL=redis://localhost:6379/5 pnpm --filter api test:e2e",
    "",
    "(create it once, then apply migrations:  createdb texawave_erp_test  &&",
    "  DATABASE_URL=… pnpm --filter @texawave-erp/database exec prisma migrate deploy)",
    "See apps/api/test/README.md. CI (CI=true) is exempt.",
  ].join("\n");
}
