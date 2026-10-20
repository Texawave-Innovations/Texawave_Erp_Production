// Shared formatting/tone helpers for every Advanced SCM page — mirrors the convention every
// other SCM domain uses (`*_STATUS_TONE` maps in each domain's `*Helpers.ts`), applied as
// Tailwind classes on the existing `Badge` component rather than a new badge abstraction.
import { daysBetween } from "../shared/format";
import type {
  ActionCategory,
  ExceptionSeverity,
  ExceptionSourceModule,
  ExceptionType,
  ScmActionItem,
  ScmException,
} from "./advancedTypes";

export const SEVERITY_TONE: Record<ExceptionSeverity, string> = {
  Critical: "text-red-700 border-red-300 bg-red-50",
  High: "text-orange-700 border-orange-300 bg-orange-50",
  Medium: "text-amber-700 border-amber-200 bg-amber-50",
  Low: "text-slate-600 border-slate-200 bg-slate-50",
};

export const SOURCE_MODULE_TONE: Record<ExceptionSourceModule, string> = {
  Inventory: "text-emerald-700 border-emerald-200 bg-emerald-50",
  Procurement: "text-blue-700 border-blue-200 bg-blue-50",
  Warehouse: "text-indigo-700 border-indigo-200 bg-indigo-50",
  Fulfillment: "text-purple-700 border-purple-200 bg-purple-50",
  Logistics: "text-sky-700 border-sky-200 bg-sky-50",
  Returns: "text-rose-700 border-rose-200 bg-rose-50",
  Quality: "text-amber-700 border-amber-200 bg-amber-50",
  Suppliers: "text-teal-700 border-teal-200 bg-teal-50",
};

export const EXCEPTION_TYPE_LABEL: Record<ExceptionType, string> = {
  LOW_STOCK: "Low Stock",
  OUT_OF_STOCK: "Out of Stock",
  PO_DELAY: "Delayed Purchase Order",
  GRN_PENDING: "Pending GRN",
  PENDING_PICKING: "Pending Picking",
  PENDING_PACKING: "Pending Packing",
  WAREHOUSE_CAPACITY: "Warehouse Capacity",
  SHIPMENT_DELAY: "Delayed Shipment",
  RETURN_PENDING: "Pending Return",
  QC_PENDING: "Pending Inspection",
  QC_HOLD: "QC Hold",
  QUARANTINE: "Quarantined Stock",
  BACKORDER: "Backorder",
  SUPPLIER_RISK: "Supplier Risk",
};

/** Maps an Advanced SCM source module onto the existing, shared `NotificationType` union in
 * `src/services/notifications.ts` (not re-exported there, so this stays a plain string-literal
 * map — the values match that union exactly). Warehouse/Fulfillment don't have a dedicated
 * category yet, so they fall back to the closest existing one rather than widening a
 * notification type owned by another part of the app. */
export const NOTIFICATION_TYPE_BY_SOURCE: Record<
  ExceptionSourceModule,
  "inventory" | "procurement" | "logistics" | "returns" | "quality"
> = {
  Inventory: "inventory",
  Procurement: "procurement",
  Warehouse: "inventory",
  Fulfillment: "logistics",
  Logistics: "logistics",
  Returns: "returns",
  Quality: "quality",
  Suppliers: "procurement",
};

export const ACTION_CATEGORY_BY_SOURCE: Record<
  ExceptionSourceModule,
  ActionCategory
> = {
  Inventory: "Inventory",
  Procurement: "Procurement",
  Warehouse: "Warehouse",
  Fulfillment: "Fulfillment",
  Logistics: "Logistics",
  Returns: "Returns",
  Quality: "Quality",
  Suppliers: "Procurement",
};

/** Actionable verb phrase per exception type, for the SCM Action Center. */
export const ACTION_LABEL_BY_TYPE: Record<ExceptionType, string> = {
  LOW_STOCK: "Resolve low-stock item",
  OUT_OF_STOCK: "Resolve out-of-stock item",
  PO_DELAY: "Review delayed PO",
  GRN_PENDING: "Finalize pending GRN",
  PENDING_PICKING: "Complete pending picking",
  PENDING_PACKING: "Complete pending packing",
  WAREHOUSE_CAPACITY: "Review warehouse capacity",
  SHIPMENT_DELAY: "Review delayed shipment",
  RETURN_PENDING: "Process pending return",
  QC_PENDING: "Complete pending inspection",
  QC_HOLD: "Review QC hold",
  QUARANTINE: "Review QC quarantine",
  BACKORDER: "Resolve backorder",
  SUPPLIER_RISK: "Review supplier issue",
};

/** Projects the exception engine's output into Action Center rows — a thin, derived view, not
 * a second source of truth (every field traces back to the `ScmException` it came from). */
export function buildActionItems(exceptions: ScmException[]): ScmActionItem[] {
  return exceptions.map((e) => ({
    id: e.id,
    category: ACTION_CATEGORY_BY_SOURCE[e.source],
    action: ACTION_LABEL_BY_TYPE[e.type],
    priority: e.severity,
    source: e.title,
    ageDays: daysSince(e.createdAt),
    relatedDocument: e.sourceNumber || e.sourceId,
    navigationPath: e.navigationPath,
  }));
}

/** Whole calendar days from `ts` to `now` (0 for today or the future), `null` without a timestamp. */
export function daysSince(
  ts: number | undefined,
  now = Date.now(),
): number | null {
  if (ts == null || !Number.isFinite(ts)) return null;
  return Math.max(0, daysBetween(new Date(ts), new Date(now)));
}

export function formatAge(ts: number | undefined, now = Date.now()): string {
  const days = daysSince(ts, now);
  if (days == null) return "N/A";
  if (days === 0) return "Today";
  return `${days} day${days === 1 ? "" : "s"} ago`;
}
