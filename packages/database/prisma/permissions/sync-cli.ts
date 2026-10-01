// Entry point for `pnpm --filter @texawave-erp/database permissions:sync`.
//
//   --check     validate the catalogue only; needs no database (safe in CI)
//   --dry-run   connect, print what WOULD change, write nothing
//   (default)   apply the catalogue additively — see sync.ts for the guarantees
//
// Exit code 0 = success, 1 = invalid catalogue or a failure. Run it after
// `prisma migrate deploy` in every environment.
import "dotenv/config";
import { PrismaClient } from "../../generated/prisma/client.js";
import { PERMISSION_CATALOG, RETIRED_PERMISSIONS } from "./catalog.js";
import { syncPermissions, type SyncReport } from "./sync.js";
import { CatalogValidationError, assertValidCatalog } from "./validate.js";

// Arbitrary constant: serialises concurrent runs (two deploy nodes starting
// together) so they can't collide on the unique `permissions.code`.
const ADVISORY_LOCK_KEY = 7_303_301;

/** `user:pass@host:5432/db` → `host:5432/db` — never print credentials. */
function describeTarget(url: string | undefined): string {
  if (!url) return "(DATABASE_URL is not set)";
  try {
    const parsed = new URL(url);
    return `${parsed.host}${parsed.pathname}`;
  } catch {
    return "(unparseable DATABASE_URL)";
  }
}

function print(report: SyncReport): void {
  const line = (label: string, codes: string[]) =>
    console.log(
      `  ${label.padEnd(13)} ${codes.length}${codes.length ? `  ${codes.join(", ")}` : ""}`,
    );
  console.log(report.dryRun ? "Dry run — nothing written:" : "Applied:");
  line("created", report.created);
  line("updated", report.updated);
  line("deactivated", report.deactivated);
  console.log(`  ${"unchanged".padEnd(13)} ${report.unchanged.length}`);
  if (report.keptInactive.length) {
    line("kept inactive", report.keptInactive);
  }
  if (report.orphans.length) {
    console.log(
      `  NOTE: ${report.orphans.length} permission(s) in the database are not in the catalogue ` +
        `(left untouched): ${report.orphans.join(", ")}`,
    );
  }
}

async function main(): Promise<void> {
  const args = new Set(process.argv.slice(2));
  const unknown = [...args].filter(
    (a) => !["--check", "--dry-run"].includes(a),
  );
  if (unknown.length) {
    console.error(
      `Unknown argument(s): ${unknown.join(" ")}\nUsage: permissions:sync [--check | --dry-run]`,
    );
    process.exitCode = 1;
    return;
  }

  assertValidCatalog(PERMISSION_CATALOG, RETIRED_PERMISSIONS);
  console.log(
    `Catalogue valid: ${PERMISSION_CATALOG.length} permissions, ${RETIRED_PERMISSIONS.length} retired.`,
  );
  if (args.has("--check")) return;

  console.log(`Target database: ${describeTarget(process.env.DATABASE_URL)}`);
  const prisma = new PrismaClient();
  try {
    const report = await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(${ADVISORY_LOCK_KEY})`;
      return syncPermissions(tx, { dryRun: args.has("--dry-run") });
    });
    print(report);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  if (error instanceof CatalogValidationError) {
    console.error(error.message);
  } else {
    console.error(error);
  }
  process.exitCode = 1;
});
