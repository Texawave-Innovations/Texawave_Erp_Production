// Central Firebase Realtime Database path constants for Phase 11 — Advanced SCM.
// This is the only new authoritative data this phase introduces: a persisted, deduplicated
// record of exceptions raised by `exceptionEngine.ts` and replenishment recommendations from
// `replenishmentService.ts`, reconciled by `scmAutomationService.ts`. Every other Advanced SCM
// page (Control Tower, Action Center, Inventory/Supplier Intelligence) reads and derives from
// the existing Phase 1-10 collections (via `useScmReportsData()`) and never invents a
// competing copy of inventory, procurement, logistics, returns or quality data.
import { firebaseKey } from "../inventory/inventoryPaths";

export const ADVANCED_PATHS = {
  exceptions: "scm/advanced/exceptions",
  replenishment: "scm/advanced/replenishment",
} as const;

/** Deterministic exception record id — `${type}:${sourceId}` — so re-evaluating the same
 * underlying condition always resolves to the same Firebase key. This is what makes the
 * automation reconcile idempotent (spec: "Never create duplicate alerts/actions on repeated
 * evaluation"): writing to the same key twice updates one record, it never appends a second. */
export function exceptionKey(type: string, sourceId: string): string {
  return firebaseKey(`${type}__${sourceId}`);
}

/** Deterministic replenishment recommendation id — one row per product+warehouse, same
 * convention as `inventoryPaths.ts`'s `balanceKey` so it lines up with the stock balance it's
 * derived from. */
export function replenishmentKey(
  productCode: string,
  warehouseId: string,
): string {
  return firebaseKey(`${productCode}__${warehouseId}`);
}
