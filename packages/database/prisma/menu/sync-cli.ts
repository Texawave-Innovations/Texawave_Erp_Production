// Entry point for `pnpm --filter @texawave-erp/database menu:sync`.
//
//   --check     validate the catalogue only; needs no database (safe in CI)
//   --dry-run   connect, print what WOULD change, write nothing
//   (default)   apply the catalogue additively — see sync.ts for the guarantees
//
// Exit code 0 = success, 1 = invalid catalogue or a failure. Run it after
// `permissions:sync` in every environment (menu items can reference
// permissions, so the permission catalogue must already be in place).
//
// Unlike permissions (one global catalogue), MenuItem is per-organization,
// so this applies the same catalogue to every active organization. This app
// is single-org in practice (Docs/ARCHITECTURE.md, CLAUDE.md) — the loop
// exists so a second organization is never silently left without the
// current menu tree, not because multi-org is an active use case today.
import "dotenv/config";
import { PrismaClient } from "../../generated/prisma/client.js";
import { MENU_CATALOG } from "./catalog.js";
import { syncMenuItems, type MenuSyncReport } from "./sync.js";
import {
  MenuCatalogValidationError,
  assertValidMenuCatalog,
} from "./validate.js";

// Arbitrary constant, distinct from permissions' lock key: serialises
// concurrent runs (two deploy nodes starting together) per organization.
const ADVISORY_LOCK_KEY = 7_303_302;

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

function print(organizationSlug: string, report: MenuSyncReport): void {
  const line = (label: string, codes: string[]) =>
    console.log(
      `  ${label.padEnd(13)} ${codes.length}${codes.length ? `  ${codes.join(", ")}` : ""}`,
    );
  console.log(
    `[${organizationSlug}] ${report.dryRun ? "Dry run — nothing written:" : "Applied:"}`,
  );
  line("created", report.created);
  line("updated", report.updated);
  console.log(`  ${"unchanged".padEnd(13)} ${report.unchanged.length}`);
  if (report.keptInactive.length) {
    line("kept inactive", report.keptInactive);
  }
  if (report.orphans.length) {
    console.log(
      `  NOTE: ${report.orphans.length} menu item(s) for this organization are not in the catalogue ` +
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
      `Unknown argument(s): ${unknown.join(" ")}\nUsage: menu:sync [--check | --dry-run]`,
    );
    process.exitCode = 1;
    return;
  }

  assertValidMenuCatalog(MENU_CATALOG);
  console.log(`Catalogue valid: ${MENU_CATALOG.length} menu items.`);
  if (args.has("--check")) return;

  console.log(`Target database: ${describeTarget(process.env.DATABASE_URL)}`);
  const prisma = new PrismaClient();
  try {
    const organizations = await prisma.organization.findMany({
      where: { isActive: true, deletedAt: null },
      select: { id: true, slug: true },
    });
    for (const org of organizations) {
      const report = await prisma.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(${ADVISORY_LOCK_KEY} + ${org.id})`;
        return syncMenuItems(tx, org.id, { dryRun: args.has("--dry-run") });
      });
      print(org.slug, report);
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  if (error instanceof MenuCatalogValidationError) {
    console.error(error.message);
  } else {
    console.error(error);
  }
  process.exitCode = 1;
});
