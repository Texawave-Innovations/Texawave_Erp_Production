// Shared types for Phase 11 — Advanced SCM. Nothing here duplicates a Phase 1-10 business
// entity; every type is either a derived, read-only intelligence shape or the persisted
// exception/recommendation record written by `scmAutomationService.ts`.

export type ExceptionSeverity = "Critical" | "High" | "Medium" | "Low";

export const SEVERITY_ORDER: Record<ExceptionSeverity, number> = {
  Critical: 0,
  High: 1,
  Medium: 2,
  Low: 3,
};

/** Deterministic rule types evaluated by `exceptionEngine.ts`. Every rule reads existing
 * Phase 1-10 data only — none of this is predicted or AI-generated. */
export type ExceptionType =
  | "LOW_STOCK"
  | "OUT_OF_STOCK"
  | "PO_DELAY"
  | "GRN_PENDING"
  | "PENDING_PICKING"
  | "PENDING_PACKING"
  | "WAREHOUSE_CAPACITY"
  | "SHIPMENT_DELAY"
  | "RETURN_PENDING"
  | "QC_PENDING"
  | "QC_HOLD"
  | "QUARANTINE"
  | "BACKORDER"
  | "SUPPLIER_RISK";

export type ExceptionSourceModule =
  | "Inventory"
  | "Procurement"
  | "Warehouse"
  | "Fulfillment"
  | "Logistics"
  | "Returns"
  | "Quality"
  | "Suppliers";

export type ExceptionStatus = "OPEN" | "RESOLVED";

/** In-memory shape produced fresh on every evaluation by `exceptionEngine.ts`. */
export interface ScmException {
  /** Deterministic — `exceptionKey(type, sourceId)` — see `advancedPaths.ts`. */
  id: string;
  type: ExceptionType;
  severity: ExceptionSeverity;
  title: string;
  description: string;
  source: ExceptionSourceModule;
  sourceId: string;
  sourceNumber?: string;
  warehouseId?: string;
  warehouseName?: string;
  vendorId?: string;
  vendorName?: string;
  /** Millisecond timestamp of the underlying document/condition, when the source record
   * carries one (e.g. a PO's expected delivery date). Never fabricated — omitted when no
   * source timestamp exists. */
  createdAt?: number;
  navigationPath: string;
}

/** Persisted record — `ScmException` plus the reconcile bookkeeping fields
 * `scmAutomationService.ts` needs to know an exception's lifecycle across evaluations. */
export interface PersistedScmException extends ScmException {
  status: ExceptionStatus;
  firstDetectedAt: number;
  lastSeenAt: number;
  /** `null` once the exception has been reopened. */
  resolvedAt?: number | null;
  /** Set by the notify claim transaction; cleared when the exception resolves. */
  notifiedAt?: number | null;
}

export type ReplenishmentStatus =
  "Reorder Now" | "Monitor" | "Overstock" | "No Recommendation";

export interface ReplenishmentRecommendation {
  /** Deterministic — `replenishmentKey(productCode, warehouseId)`. */
  id: string;
  productCode: string;
  productName: string;
  warehouseId: string;
  warehouseName: string;
  availableStock: number;
  onHand: number;
  reorderLevel: number | null;
  /** Units/day over the lookback window — `null` when there isn't enough ledger history to
   * compute a trustworthy average (never guessed). */
  avgDailyConsumption: number | null;
  /** `availableStock / avgDailyConsumption` — `null` whenever `avgDailyConsumption` is `null`
   * or zero. */
  daysOfCover: number | null;
  /** Only populated when `status === 'Reorder Now'` and `avgDailyConsumption` is known. */
  suggestedReorderQty: number | null;
  status: ReplenishmentStatus;
  /** Plain-language explanation of exactly why this status was produced — every
   * recommendation must show this per the Phase 11 spec. */
  reason: string;
}

export type ActionCategory =
  | "Procurement"
  | "Inventory"
  | "Warehouse"
  | "Fulfillment"
  | "Logistics"
  | "Returns"
  | "Quality";

/** One row in the SCM Action Center — a thin projection of a `ScmException`, grouped by the
 * operational category a user would act on it in, rather than the technical rule that raised
 * it. Built entirely from `ScmException[]`, never a second source of truth. */
export interface ScmActionItem {
  id: string;
  category: ActionCategory;
  action: string;
  priority: ExceptionSeverity;
  source: string;
  /** Age of the underlying condition in days, when the source record carries a timestamp. */
  ageDays: number | null;
  relatedDocument: string;
  navigationPath: string;
}
