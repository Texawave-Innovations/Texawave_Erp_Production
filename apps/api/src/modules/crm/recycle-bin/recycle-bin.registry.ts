import type { OrgScope } from "../../../common/tenancy/org-scope.js";
import type { RecycleBinEntityType } from "./dto/recycle-bin.dto.js";

/** One soft-deleted record as shown in the Recycle Bin list. */
export interface RecycleBinItem {
  entityType: RecycleBinEntityType;
  entityTypeLabel: string;
  id: number;
  label: string;
  subtitle: string | null;
  deletedAt: Date;
  deletedBy: number | null;
  /** Deleter's display name (filled in by the service for the visible page). */
  deletedByName?: string | null;
  /** Scalar-field snapshot of the soft-deleted row (legacy "Record Details"). */
  data: Record<string, unknown>;
  /** Cascade children deleted with this record (restored together). */
  relatedCount?: number;
}

/** Adapter over one owning module's repository (its additive
 * `findDeleted` / `restoreDeleted` / `purgeDeleted` methods). */
export interface RecycleBinHandler {
  entityType: RecycleBinEntityType;
  entityTypeLabel: string;
  list(scope: OrgScope): Promise<RecycleBinItem[]>;
  /** null = not in the bin. */
  restore(scope: OrgScope, id: number, actorId: number): Promise<unknown>;
  /** null = not in the bin. */
  purge(scope: OrgScope, id: number): Promise<unknown>;
}

interface Deletable {
  id: number;
  deletedAt: Date | null;
  updatedBy?: number | null;
}

const SNAPSHOT_SKIP = new Set([
  "organizationId",
  "deletedAt",
  "createdBy",
  "updatedBy",
  "teamId",
]);

/** Plain JSON-safe scalar snapshot of a row: dates as ISO strings, decimals
 * as strings, relations dropped, nested JSON kept as-is. */
function snapshotOf(row: object): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    if (SNAPSHOT_SKIP.has(k) || v === undefined) continue;
    if (v instanceof Date) out[k] = v.toISOString();
    else if (v !== null && typeof v === "object") {
      const asString = v as { toFixed?: unknown; toString(): string };
      if (typeof asString.toFixed === "function") out[k] = asString.toString();
      else if (!Array.isArray(v) && "id" in v) continue;
      else out[k] = v;
    } else out[k] = v;
  }
  return out;
}

export function toItem<T extends Deletable>(
  entityType: RecycleBinEntityType,
  entityTypeLabel: string,
  row: T,
  label: string,
  subtitle: string | null = null,
): RecycleBinItem {
  return {
    entityType,
    entityTypeLabel,
    id: row.id,
    label: label || `${entityTypeLabel} #${row.id}`,
    subtitle,
    deletedAt: row.deletedAt ?? new Date(0),
    deletedBy: row.updatedBy ?? null,
    data: snapshotOf(row),
  };
}
