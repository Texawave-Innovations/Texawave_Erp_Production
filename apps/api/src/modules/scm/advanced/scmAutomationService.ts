// Workflow automation on top of the exception engine and replenishment service. It only ever
// persists alerts and recommendations (never POs, shipments, returns or financial documents) and
// is idempotent: every record has a deterministic key, re-running against the same data rewrites
// the same records, and a notification is sent at most once per occurrence.
//
// Write rules:
//  - records are merged field by field (`updateRecord`), never `set()` over, so the `auditLogs`
//    child written by `logRecordAudit` survives every reconcile;
//  - only records whose content changed are written, all in parallel;
//  - a failure on one record is collected and never aborts the rest;
//  - notifications go out only after the record write succeeded, and only from the tab whose
//    `notifiedAt` claim transaction commits (so two open tabs never both notify).
import {
  database,
  getAllRecords,
  ref,
  runTransaction,
  updateRecord,
} from "@/services/firebase";
import { notifyAdminFeed } from "@/services/notifications";
import { logRecordAudit } from "@/services/auditLog";
import { errorMessage } from "../shared/format";
import { ADVANCED_PATHS } from "./advancedPaths";
import {
  EXCEPTION_TYPE_LABEL,
  NOTIFICATION_TYPE_BY_SOURCE,
} from "./advancedHelpers";
import type {
  PersistedScmException,
  ReplenishmentRecommendation,
  ScmException,
} from "./advancedTypes";

export interface ReconcileResult {
  created: number;
  resolved: number;
  updated: number;
  /** One message per record whose write, audit or notification failed. */
  errors: string[];
}

type Fields = Record<string, unknown>;

interface PendingWrite {
  id: string;
  fields: Fields;
  /** Runs only after the record write succeeded. */
  after?: () => Promise<void>;
}

/** Optional exception fields that must be cleared (null) when a fresh evaluation no longer has them. */
const OPTIONAL_EXCEPTION_FIELDS = [
  "sourceNumber",
  "warehouseId",
  "warehouseName",
  "vendorId",
  "vendorName",
  "createdAt",
] as const;

const needsNotification = (exc: ScmException) =>
  exc.severity === "Critical" || exc.severity === "High";

/** Atomically claims the right to send a notification for a record: sets `field` to now only if
 * it is empty. Returns true for exactly one caller per occurrence. */
async function claimNotification(
  basePath: string,
  id: string,
  field: string,
): Promise<boolean> {
  const result = await runTransaction(
    ref(database, `${basePath}/${id}/${field}`),
    (current: number | null) => (current ? undefined : Date.now()),
  );
  return result.committed;
}

/** Writes every record in parallel; returns one error message per failed record. */
async function applyWrites(
  basePath: string,
  writes: PendingWrite[],
): Promise<string[]> {
  const results = await Promise.allSettled(
    writes.map(async (w) => {
      await updateRecord(basePath, w.id, w.fields);
      if (w.after) await w.after();
    }),
  );
  return results.flatMap((r, i) =>
    r.status === "rejected"
      ? [`${writes[i].id}: ${errorMessage(r.reason, "write failed")}`]
      : [],
  );
}

function exceptionContent(
  exc: ScmException,
  prior: PersistedScmException | undefined,
): Fields {
  const fields: Fields = { ...exc };
  for (const key of OPTIONAL_EXCEPTION_FIELDS) {
    if (exc[key] === undefined && prior?.[key] !== undefined)
      fields[key] = null;
  }
  return fields;
}

function contentChanged(
  exc: ScmException,
  prior: PersistedScmException,
): boolean {
  return (
    prior.severity !== exc.severity ||
    prior.title !== exc.title ||
    prior.description !== exc.description ||
    OPTIONAL_EXCEPTION_FIELDS.some(
      (k) => (prior[k] ?? null) !== (exc[k] ?? null),
    )
  );
}

/** Persists the freshly evaluated exception set: opens new/reappeared exceptions (notifying
 * Critical/High ones once), refreshes changed ones and resolves those no longer detected.
 * Throws only if the existing records can't be read — then nothing is written. */
export async function reconcileExceptions(
  fresh: ScmException[],
  actor: string,
): Promise<ReconcileResult> {
  const path = ADVANCED_PATHS.exceptions;
  const existing = (await getAllRecords(path)) as PersistedScmException[];
  const existingById = new Map(existing.map((e) => [e.id, e]));
  const freshIds = new Set(fresh.map((e) => e.id));
  const now = Date.now();
  const writes: PendingWrite[] = [];
  let created = 0,
    resolved = 0,
    updated = 0;

  const notify = (exc: ScmException) => async () => {
    if (
      !needsNotification(exc) ||
      !(await claimNotification(path, exc.id, "notifiedAt"))
    )
      return;
    await notifyAdminFeed(
      `${EXCEPTION_TYPE_LABEL[exc.type]}: ${exc.title}`,
      exc.description,
      NOTIFICATION_TYPE_BY_SOURCE[exc.source],
    );
  };

  for (const exc of fresh) {
    const prior = existingById.get(exc.id);
    if (!prior || prior.status === "RESOLVED") {
      const action = prior ? "Exception reopened" : "Exception raised";
      created += 1;
      writes.push({
        id: exc.id,
        fields: {
          ...exceptionContent(exc, prior),
          status: "OPEN",
          firstDetectedAt: now,
          lastSeenAt: now,
          resolvedAt: null,
          // Records resolved before `notifiedAt` was cleared on resolve still carry the old claim.
          ...(prior?.notifiedAt != null ? { notifiedAt: null } : {}),
        },
        after: async () => {
          await logRecordAudit(
            path,
            exc.id,
            action,
            actor,
            `${exc.type} — ${exc.title}`,
          );
          await notify(exc)();
        },
      });
    } else if (contentChanged(exc, prior)) {
      updated += 1;
      writes.push({
        id: exc.id,
        fields: { ...exceptionContent(exc, prior), lastSeenAt: now },
      });
    }
  }

  for (const prior of existing) {
    if (prior.status !== "OPEN" || freshIds.has(prior.id)) continue;
    resolved += 1;
    writes.push({
      id: prior.id,
      // Clearing `notifiedAt` lets a later reappearance claim a fresh notification.
      fields: { status: "RESOLVED", resolvedAt: now, notifiedAt: null },
      after: () =>
        logRecordAudit(
          path,
          prior.id,
          "Exception resolved",
          actor,
          prior.title,
        ),
    });
  }

  const errors = await applyWrites(path, writes);
  return { created, resolved, updated, errors };
}

type PersistedRecommendation = ReplenishmentRecommendation & {
  updatedAt?: number;
  reorderNotifiedAt?: number | null;
};

const RECOMMENDATION_FIELDS: ReadonlyArray<keyof ReplenishmentRecommendation> =
  [
    "productCode",
    "productName",
    "warehouseId",
    "warehouseName",
    "availableStock",
    "onHand",
    "reorderLevel",
    "avgDailyConsumption",
    "daysOfCover",
    "suggestedReorderQty",
    "status",
    "reason",
  ];

function recommendationChanged(
  rec: ReplenishmentRecommendation,
  prior: PersistedRecommendation,
): boolean {
  return RECOMMENDATION_FIELDS.some(
    (k) => (prior[k] ?? null) !== (rec[k] ?? null),
  );
}

/** Persists replenishment recommendations (one row per product+warehouse), writing only rows
 * that changed. Notifies/audits once when a row becomes "Reorder Now"; never creates a PO. */
export async function reconcileReplenishment(
  fresh: ReplenishmentRecommendation[],
  actor: string,
): Promise<ReconcileResult> {
  const path = ADVANCED_PATHS.replenishment;
  const existing = (await getAllRecords(path)) as PersistedRecommendation[];
  const existingById = new Map(existing.map((r) => [r.id, r]));
  const writes: PendingWrite[] = [];
  let created = 0,
    updated = 0;

  for (const rec of fresh) {
    const prior = existingById.get(rec.id);
    if (prior && !recommendationChanged(rec, prior)) continue;
    if (prior) updated += 1;
    else created += 1;

    const becameReorder =
      rec.status === "Reorder Now" && prior?.status !== "Reorder Now";
    const leftReorder =
      rec.status !== "Reorder Now" && prior?.status === "Reorder Now";
    const fields: Fields = { ...rec };
    if (leftReorder) fields.reorderNotifiedAt = null;

    writes.push({
      id: rec.id,
      fields,
      after: becameReorder
        ? async () => {
            if (!(await claimNotification(path, rec.id, "reorderNotifiedAt")))
              return;
            await notifyAdminFeed(
              "Reorder Recommended",
              `${rec.productName} at ${rec.warehouseName} — ${rec.reason}`,
              "inventory",
            );
            await logRecordAudit(
              path,
              rec.id,
              "Reorder recommended",
              actor,
              `${rec.productCode} @ ${rec.warehouseName} — ${rec.reason}`,
            );
          }
        : undefined,
    });
  }

  const errors = await applyWrites(path, writes);
  return { created, resolved: 0, updated, errors };
}
