// Lifecycle shared by customer and vendor returns: status transitions, cancellation, the
// over-return quantity reservation and ledger-id bookkeeping.
import {
  database,
  getAllRecords,
  getRecordById,
  ref,
  runTransaction,
  set,
} from "@/services/firebase";
import { logRecordAudit } from "@/services/auditLog";
import { notifyAdminFeed } from "@/services/notifications";
import { transitionStatus } from "@/modules/scm/shared/statusTransition";
import { formatStatusLabel } from "@/modules/scm/shared/format";
import { INVENTORY_PATHS, settingsKey } from "../inventory/inventoryPaths";
import { RETURNS_PATHS } from "./returnsPaths";
import {
  hasPostedInventory,
  previouslyReturnedByLine,
  returnScopeKey,
  returnStatusesLeadingTo,
} from "./returnHelpers";
import type { InventorySettings, ScmReturn, ScmReturnStatus } from "@/types";

/** Reads the return from the server — services never act on a copy the page loaded earlier. */
export async function getFreshReturn(returnId: string): Promise<ScmReturn> {
  const ret = (await getRecordById(
    RETURNS_PATHS.returns,
    returnId,
  )) as ScmReturn | null;
  if (!ret) throw new Error("Return not found. Refresh and try again.");
  return { ...ret, items: ret.items || [] };
}

export function requireStatus(ret: ScmReturn, status: ScmReturnStatus): void {
  if (ret.status !== status) {
    throw new Error(
      `Return is ${formatStatusLabel(ret.status)}, not ${formatStatusLabel(status)}. Refresh and try again.`,
    );
  }
}

/** Atomic status change (server-side `from` check) followed by an audit entry. */
export async function transitionReturn(
  ret: Pick<ScmReturn, "id" | "returnType">,
  to: ScmReturnStatus,
  extra: Record<string, unknown>,
  performedBy: string,
  action: string,
  details: string,
): Promise<void> {
  const from = returnStatusesLeadingTo(ret.returnType, to);
  await transitionStatus<ScmReturnStatus>(
    RETURNS_PATHS.returns,
    ret.id,
    from,
    to,
    extra,
  );
  await logRecordAudit(
    RETURNS_PATHS.returns,
    ret.id,
    action,
    performedBy,
    details,
  );
}

/** Atomically appends ledger entry ids to the return (the cancellation guard reads these). */
export async function appendReturnLedgerIds(
  returnId: string,
  ids: Array<string | undefined>,
): Promise<void> {
  const clean = ids.filter((id): id is string => !!id);
  if (clean.length === 0) return;
  await runTransaction(
    ref(database, `${RETURNS_PATHS.returns}/${returnId}/ledgerEntryIds`),
    (current: string[] | null) => {
      const existing = current || [];
      return [...existing, ...clean.filter((id) => !existing.includes(id))];
    },
  );
}

/** Cost price for a product (InventorySettings.costPrice) — returns are valued at cost, never at
 *  selling price. Undefined when no cost has been set. */
export async function getCostPrice(
  productCode: string,
): Promise<number | undefined> {
  const settings = (await getRecordById(
    INVENTORY_PATHS.settings,
    settingsKey(productCode),
  )) as InventorySettings | null;
  return settings?.costPrice;
}

// ---------------------------------------------------------------------------
// Over-return guard. Each open return line holds a reservation on its source line
// (`quantityReservations/<scope>/<lineId>`) until the return is cancelled or rejected. Eligibility
// is computed inside the reservation transaction from (saved lines without a reservation) +
// (every reservation), so two concurrent submissions can never both pass on a stale scan.
// ---------------------------------------------------------------------------

export interface ReturnLineReservation {
  scopeKey: string;
  lineId: string;
  quantity: number;
  /** Source quantity (fulfilled/received) for this scope. */
  sourceQuantity: number;
  /** Requested qty per line id already saved on other open returns (from a fresh scan). */
  savedLines: Map<string, number>;
  productCode: string;
}

/** Reserves `quantity` for a new return line; returns the previously returned quantity. */
export async function reserveReturnLine(
  r: ReturnLineReservation,
): Promise<number> {
  let error: string | null = null;
  let previouslyReturned = 0;
  await runTransaction(
    ref(database, `${RETURNS_PATHS.quantityReservations}/${r.scopeKey}`),
    (current: Record<string, number> | null) => {
      error = null;
      const reservations = current || {};
      let prior = 0;
      for (const [lineId, q] of Object.entries(reservations))
        if (lineId !== r.lineId) prior += q || 0;
      for (const [lineId, q] of r.savedLines)
        if (!(lineId in reservations)) prior += q;
      previouslyReturned = prior;
      const eligible = r.sourceQuantity - prior;
      if (r.quantity > eligible) {
        error = `Cannot return ${r.quantity} of ${r.productCode} — only ${Math.max(0, eligible)} eligible (source ${r.sourceQuantity}, already returned ${prior}).`;
        return; // abort
      }
      return { ...reservations, [r.lineId]: r.quantity };
    },
  );
  if (error) throw new Error(error);
  return previouslyReturned;
}

export async function releaseReturnLines(
  entries: Array<{ scopeKey: string; lineId: string }>,
): Promise<void> {
  await Promise.all(
    entries.map((e) =>
      set(
        ref(
          database,
          `${RETURNS_PATHS.quantityReservations}/${e.scopeKey}/${e.lineId}`,
        ),
        null,
      ),
    ),
  );
}

async function releaseReturnReservations(ret: ScmReturn): Promise<void> {
  await releaseReturnLines(
    ret.items.map((it) => ({
      scopeKey: returnScopeKey(ret, it),
      lineId: it.id,
    })),
  );
}

/** Saved open-return quantities for a source line — must not swallow read failures, or an
 *  error would look like "nothing returned yet". */
export async function loadSavedReturnLines(
  match: Parameters<typeof previouslyReturnedByLine>[1],
): Promise<Map<string, number>> {
  const all = (await getAllRecords(RETURNS_PATHS.returns)) as ScmReturn[];
  return previouslyReturnedByLine(all, match);
}

/** Creates the return record, releasing the line reservations if the write fails. */
export async function createWithReservations(
  reservations: Array<{ scopeKey: string; lineId: string }>,
  create: () => Promise<string | null>,
): Promise<string> {
  try {
    const id = await create();
    if (!id) throw new Error("Failed to create return.");
    return id;
  } catch (err) {
    await releaseReturnLines(reservations);
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Submit / approve / reject / cancel
// ---------------------------------------------------------------------------

export async function submitReturn(
  ret: ScmReturn,
  performedBy: string,
): Promise<void> {
  await transitionReturn(
    ret,
    "PENDING_APPROVAL",
    {},
    performedBy,
    "Return submitted",
    ret.returnNumber,
  );
  await notifyAdminFeed(
    "Return approval required",
    `${ret.returnNumber} is awaiting approval.`,
    "returns",
  );
}

export async function approveReturn(
  ret: ScmReturn,
  performedBy: string,
): Promise<void> {
  await transitionReturn(
    ret,
    "APPROVED",
    { approvedBy: performedBy, approvedDate: Date.now() },
    performedBy,
    "Return approved",
    ret.returnNumber,
  );
  await notifyAdminFeed(
    "Return approved",
    `${ret.returnNumber} has been approved.`,
    "returns",
  );
}

export async function rejectReturn(
  ret: ScmReturn,
  reason: string,
  performedBy: string,
): Promise<void> {
  if (!reason.trim()) throw new Error("A rejection reason is required.");
  await transitionReturn(
    ret,
    "REJECTED",
    { rejectionReason: reason.trim() },
    performedBy,
    "Return rejected",
    reason.trim(),
  );
  await releaseReturnReservations(await getFreshReturn(ret.id));
  await notifyAdminFeed(
    "Return rejected",
    `${ret.returnNumber}: ${reason.trim()}`,
    "returns",
  );
}

/** Blocked once any inventory has been posted (re-checked from fresh data) — a reversal is a
 *  separate controlled transaction. */
export async function cancelReturn(
  retId: string,
  reason: string,
  performedBy: string,
): Promise<void> {
  const fresh = await getFreshReturn(retId);
  if (hasPostedInventory(fresh)) {
    throw new Error(
      "This return has already posted inventory movements and cannot be cancelled — a reversal must be a separate controlled transaction.",
    );
  }
  const why = reason.trim() || "Cancelled by user";
  await transitionReturn(
    fresh,
    "CANCELLED",
    {
      cancelledBy: performedBy,
      cancelledAt: Date.now(),
      cancellationReason: why,
    },
    performedBy,
    "Return cancelled",
    why,
  );
  await releaseReturnReservations(fresh);
}
