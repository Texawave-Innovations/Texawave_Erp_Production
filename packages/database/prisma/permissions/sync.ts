import type { PrismaClient } from "../../generated/prisma/client.js";
import {
  PERMISSION_CATALOG,
  RETIRED_PERMISSIONS,
  type PermissionDef,
  type RetiredPermission,
} from "./catalog.js";
import { assertValidCatalog } from "./validate.js";

export interface SyncOptions {
  catalog?: readonly PermissionDef[];
  retired?: readonly RetiredPermission[];
  /** Compute and return the plan without writing anything. */
  dryRun?: boolean;
}

export interface SyncReport {
  dryRun: boolean;
  /** In the catalogue, missing from the database → inserted. */
  created: string[];
  /** Description text differed → refreshed. */
  updated: string[];
  /** Listed in RETIRED_PERMISSIONS and still active → deactivated. */
  deactivated: string[];
  unchanged: string[];
  /** In the catalogue but `is_active = false` in the database. Left alone:
   * an administrator may have disabled it on purpose. */
  keptInactive: string[];
  /** In the database, in neither the catalogue nor the retired list (created
   * by hand, or by another branch). Reported, never touched. */
  orphans: string[];
}

/**
 * Makes the `permissions` table match the catalogue — additively and
 * idempotently, so it is safe to run on every deploy, in any environment, any
 * number of times:
 *
 *  - It inserts missing rows and refreshes description text. That is all it
 *    does to a catalogue permission.
 *  - It NEVER deletes a row and NEVER touches `roles`, `role_permissions` or
 *    `user_roles` — who holds a permission stays an administrator decision
 *    (settings/roles).
 *  - It NEVER re-activates a disabled permission (an admin may have disabled
 *    it deliberately); it reports it under `keptInactive`.
 *  - It deactivates only codes explicitly listed as retired.
 *  - Rows it does not recognise are reported (`orphans`), not removed.
 *
 * Pass a transaction client (`prisma.$transaction(tx => syncPermissions(tx))`)
 * so a failure part-way leaves nothing half-applied. The catalogue is
 * validated first; an invalid catalogue throws before any read or write.
 */
export async function syncPermissions(
  client: Pick<PrismaClient, "permission">,
  options: SyncOptions = {},
): Promise<SyncReport> {
  const catalog = options.catalog ?? PERMISSION_CATALOG;
  const retired = options.retired ?? RETIRED_PERMISSIONS;
  const dryRun = options.dryRun ?? false;
  assertValidCatalog(catalog, retired);

  const existing = new Map(
    (
      await client.permission.findMany({
        select: { code: true, description: true, isActive: true },
      })
    ).map((row) => [row.code, row]),
  );

  const report: SyncReport = {
    dryRun,
    created: [],
    updated: [],
    deactivated: [],
    unchanged: [],
    keptInactive: [],
    orphans: [],
  };

  for (const def of catalog) {
    const row = existing.get(def.code);
    if (!row) {
      report.created.push(def.code);
      if (!dryRun) {
        await client.permission.create({
          data: { code: def.code, description: def.description },
        });
      }
      continue;
    }
    if (row.description !== def.description) {
      report.updated.push(def.code);
      if (!dryRun) {
        await client.permission.update({
          where: { code: def.code },
          data: { description: def.description },
        });
      }
    } else {
      report.unchanged.push(def.code);
    }
    if (!row.isActive) report.keptInactive.push(def.code);
  }

  for (const { code } of retired) {
    const row = existing.get(code);
    if (row?.isActive) {
      report.deactivated.push(code);
      if (!dryRun) {
        await client.permission.update({
          where: { code },
          data: { isActive: false },
        });
      }
    }
  }

  const known = new Set([
    ...catalog.map((d) => d.code),
    ...retired.map((r) => r.code),
  ]);
  report.orphans = [...existing.keys()].filter((code) => !known.has(code));

  return report;
}
