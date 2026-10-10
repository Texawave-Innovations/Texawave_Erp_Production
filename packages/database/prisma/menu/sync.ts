import type { PrismaClient } from "../../generated/prisma/client.js";
import { MENU_CATALOG, type MenuItemDef } from "./catalog.js";
import { assertValidMenuCatalog } from "./validate.js";

export interface MenuSyncOptions {
  catalog?: readonly MenuItemDef[];
  /** Compute and return the plan without writing anything. */
  dryRun?: boolean;
}

export interface MenuSyncReport {
  dryRun: boolean;
  /** In the catalogue, missing from this organization → inserted. */
  created: string[];
  /** label/path/order/permission/parent differed → refreshed. */
  updated: string[];
  unchanged: string[];
  /** In the catalogue but `is_active = false` for this organization. Left
   * alone: an administrator may have disabled it on purpose. */
  keptInactive: string[];
  /** Active rows for this organization that are in neither the catalogue
   * nor soft-deleted (created by hand, or by another branch). Reported,
   * never touched. */
  orphans: string[];
}

type MenuItemClient = Pick<PrismaClient, "menuItem">;

/**
 * Makes one organization's `menu_items` match the catalogue — additively and
 * idempotently, so it is safe to run on every deploy, in any environment,
 * any number of times. Mirrors `syncPermissions` (prisma/permissions/sync.ts)
 * exactly, with one structural difference: `MenuItem` is per-organization
 * and hierarchical (`parentId`), so the catalogue references a parent by its
 * stable `code` and this function resolves that to the organization's actual
 * numeric id, in topological order (a parent is always created/found before
 * its children are resolved).
 *
 *  - It inserts missing rows and refreshes label/path/order/permission/parent.
 *    That is all it does to a catalogue item.
 *  - It NEVER deletes a row and NEVER soft-deletes one — an item that drops
 *    out of the catalogue becomes an orphan, reported, not removed.
 *  - It NEVER re-activates a disabled item (an admin may have disabled it
 *    deliberately); it reports it under `keptInactive`.
 *  - The catalogue is validated first (including that every `permission`
 *    string matches something in PERMISSION_CATALOG); an invalid catalogue
 *    throws before any read or write.
 *
 * Pass a transaction client so a failure part-way leaves nothing half-applied.
 */
export async function syncMenuItems(
  client: MenuItemClient,
  organizationId: number,
  options: MenuSyncOptions = {},
): Promise<MenuSyncReport> {
  const catalog = options.catalog ?? MENU_CATALOG;
  const dryRun = options.dryRun ?? false;
  assertValidMenuCatalog(catalog);

  const existingRows = await client.menuItem.findMany({
    where: { organizationId, deletedAt: null },
    select: {
      id: true,
      code: true,
      label: true,
      path: true,
      order: true,
      parentId: true,
      permission: true,
      isActive: true,
    },
  });
  const existingByCode = new Map(existingRows.map((row) => [row.code, row]));
  const defByCode = new Map(catalog.map((d) => [d.code, d]));

  const report: MenuSyncReport = {
    dryRun,
    created: [],
    updated: [],
    unchanged: [],
    keptInactive: [],
    orphans: [],
  };

  const idByCode = new Map<string, number>(
    existingRows.map((row) => [row.code, row.id]),
  );

  async function resolve(def: MenuItemDef): Promise<void> {
    const parentId =
      def.parentCode === null ? null : (idByCode.get(def.parentCode) ?? null);
    const row = existingByCode.get(def.code);
    const path = def.path ?? null;

    if (!row) {
      report.created.push(def.code);
      if (!dryRun) {
        const created = await client.menuItem.create({
          data: {
            organizationId,
            code: def.code,
            label: def.label,
            path,
            order: def.order,
            parentId,
            permission: def.permission,
          },
        });
        idByCode.set(def.code, created.id);
      } else {
        // Dry run never writes, so a brand-new row has no real id for a
        // child further down this pass to resolve against — a placeholder
        // is enough to let the dry-run plan still report that child.
        idByCode.set(def.code, -1);
      }
      return;
    }

    const changed =
      row.label !== def.label ||
      row.path !== path ||
      row.order !== def.order ||
      row.permission !== def.permission ||
      row.parentId !== parentId;

    if (changed) {
      report.updated.push(def.code);
      if (!dryRun) {
        await client.menuItem.update({
          where: { id: row.id },
          data: {
            label: def.label,
            path,
            order: def.order,
            parentId,
            permission: def.permission,
          },
        });
      }
    } else {
      report.unchanged.push(def.code);
    }
    if (!row.isActive) report.keptInactive.push(def.code);
  }

  // Multi-pass topological resolution: each pass resolves whatever is ready
  // (a root, or a child whose parent was resolved in an earlier pass), until
  // nothing is left. validate.ts already rejects unknown parentCodes and
  // cycles, so this always terminates.
  const remaining = new Set(catalog.map((d) => d.code));
  while (remaining.size > 0) {
    const ready = [...remaining].filter((code) => {
      const def = defByCode.get(code)!;
      return def.parentCode === null || idByCode.has(def.parentCode);
    });
    for (const code of ready) {
      await resolve(defByCode.get(code)!);
      remaining.delete(code);
    }
  }

  const known = new Set(catalog.map((d) => d.code));
  report.orphans = existingRows
    .map((row) => row.code)
    .filter((code) => !known.has(code));

  return report;
}
