/** Statuses in which reserved stock is being worked on (picked/packed). */
export const IN_PROGRESS_STATUSES = [
  "RESERVED",
  "PICKING",
  "PACKING",
  "READY_TO_SHIP",
] as const;

/** Statuses before any stock is reserved. */
export const PRE_RESERVE_STATUSES = [
  "PENDING",
  "PARTIALLY_AVAILABLE",
  "AVAILABLE",
] as const;

export const CLOSED_REQUISITION_STATUSES = ["REJECTED", "CANCELLED"] as const;

export type ProgressStatus =
  "RESERVED" | "PICKING" | "PACKING" | "READY_TO_SHIP";

/** Rolls an in-progress fulfillment forward from its live (non-cancelled)
 * pick and pack documents. */
export function nextProgressStatus(
  picks: { status: string }[],
  packs: { status: string }[],
): ProgressStatus {
  if (picks.length === 0) return "RESERVED";
  if (packs.length === 0) return "PICKING";
  const allPicked = picks.every((p) => p.status === "COMPLETED");
  const allPacked = packs.every((p) => p.status === "PACKED");
  return allPicked && allPacked ? "READY_TO_SHIP" : "PACKING";
}

/** Per-product quantity that can be issued: what was both picked AND packed. */
export function issuableByProduct(
  picks: { items: { productId: number; pickedQuantity: number }[] }[],
  packs: { packages: { items: { productId: number; quantity: number }[] }[] }[],
): Map<number, number> {
  const picked = new Map<number, number>();
  for (const p of picks) {
    for (const it of p.items) {
      picked.set(
        it.productId,
        (picked.get(it.productId) ?? 0) + it.pickedQuantity,
      );
    }
  }
  const packed = new Map<number, number>();
  for (const p of packs) {
    for (const pkg of p.packages) {
      for (const it of pkg.items) {
        packed.set(it.productId, (packed.get(it.productId) ?? 0) + it.quantity);
      }
    }
  }
  const out = new Map<number, number>();
  for (const [id, qty] of picked)
    out.set(id, Math.min(qty, packed.get(id) ?? 0));
  return out;
}
