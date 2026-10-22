/** Controlled forward/exception lifecycle, ported from legacy
 * `VALID_TRANSITIONS`. There is deliberately no backward move (e.g.
 * DELIVERED -> DISPATCHED); shipments are created directly at READY_TO_SHIP
 * because eligibility is validated at creation. */
export const VALID_SHIPMENT_TRANSITIONS: Record<string, string[]> = {
  READY_TO_SHIP: ["CARRIER_ASSIGNED", "CANCELLED"],
  CARRIER_ASSIGNED: ["CARRIER_ASSIGNED", "LABEL_CREATED", "CANCELLED"],
  LABEL_CREATED: ["DISPATCHED", "CANCELLED"],
  DISPATCHED: ["IN_TRANSIT", "DELIVERY_EXCEPTION"],
  IN_TRANSIT: ["OUT_FOR_DELIVERY", "DELIVERY_EXCEPTION"],
  OUT_FOR_DELIVERY: ["DELIVERED", "FAILED_DELIVERY", "DELIVERY_EXCEPTION"],
  DELIVERY_EXCEPTION: [
    "IN_TRANSIT",
    "OUT_FOR_DELIVERY",
    "FAILED_DELIVERY",
    "DELIVERED",
  ],
  FAILED_DELIVERY: ["OUT_FOR_DELIVERY", "IN_TRANSIT"],
  DELIVERED: [],
  CANCELLED: [],
};

export function canTransition(from: string, to: string): boolean {
  return (VALID_SHIPMENT_TRANSITIONS[from] ?? []).includes(to);
}

export const CANCELLABLE_SHIPMENT_STATUSES = [
  "READY_TO_SHIP",
  "CARRIER_ASSIGNED",
  "LABEL_CREATED",
] as const;

/** Statuses in which goods have left with the carrier. */
export const DISPATCHED_STATUSES = [
  "DISPATCHED",
  "IN_TRANSIT",
  "OUT_FOR_DELIVERY",
  "DELIVERED",
  "DELIVERY_EXCEPTION",
  "FAILED_DELIVERY",
] as const;

export interface PackageSnapshot {
  packingId: number;
  packNumber: string;
  packageNumber: string;
  packageType: string | null;
  weight: number | null;
  length: number | null;
  width: number | null;
  height: number | null;
  items: {
    productId: number;
    productCode: string;
    productName: string;
    quantity: number;
  }[];
}

/** Quantity per product across the given shipments' package snapshots. */
export function packagedQtyByProduct(
  shipments: PackageSnapshot[][],
): Map<number, number> {
  const qty = new Map<number, number>();
  for (const packages of shipments) {
    for (const pkg of packages) {
      for (const it of pkg.items) {
        qty.set(it.productId, (qty.get(it.productId) ?? 0) + it.quantity);
      }
    }
  }
  return qty;
}
