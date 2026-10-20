// Central Firebase Realtime Database path constants for the SCM Inventory domain
// (Phase 3). Keeping every path in one place makes it obvious this is the only
// place stock data is meant to live — nothing in this domain writes a bare
// "stock" number onto sales/products.
export const INVENTORY_PATHS = {
  warehouses: "scm/warehouses",
  locations: "scm/locations",
  ledger: "scm/inventory/stockLedger",
  balances: "scm/inventory/stockBalances",
  settings: "scm/inventory/settings",
  reservations: "scm/inventory/reservations",
  transfers: "scm/inventory/transfers",
  adjustments: "scm/inventory/adjustments",
  batches: "scm/inventory/batches",
  serials: "scm/inventory/serials",
  postingClaims: "scm/inventory/postingClaims",
} as const;

/** Replaces the characters Firebase RTDB forbids in keys (`. # $ / [ ]`) with `_`. */
export function firebaseKey(raw: string): string {
  return raw.replace(/[.#$/[\]]/g, "_");
}

/** Derived stock-balance key: one row per product per warehouse. */
export function balanceKey(productCode: string, warehouseId: string): string {
  return firebaseKey(`${productCode}__${warehouseId}`);
}

/** Derived batch key: one row per physical lot (same batch number, product and warehouse),
 * however many receipts/entries contribute quantity to it. */
export function batchKey(
  batchNumber: string,
  productCode: string,
  warehouseId: string,
): string {
  return firebaseKey(`${batchNumber}__${productCode}__${warehouseId}`);
}

/** Firebase-safe key for a productCode used as a settings record id. */
export function settingsKey(productCode: string): string {
  return firebaseKey(productCode);
}
