// Central Firebase Realtime Database path constants for the SCM Returns Management domain
// (Phase 8), mirroring the convention set by `logistics/logisticsPaths.ts`,
// `orders/orderPaths.ts` and `procurement/procurementPaths.ts`. One canonical `scm/returns/returns`
// collection holds both Customer and Vendor returns (discriminated by `returnType`) per the
// Phase 8 spec — inspections and dispositions are separate collections referencing `returnId`.
export const RETURNS_PATHS = {
  returns: "scm/returns/returns",
  inspections: "scm/returns/inspections",
  dispositions: "scm/returns/dispositions",
  /** Per source line (`returnScopeKey`) → { lineId: quantity } held by every open return. */
  quantityReservations: "scm/returns/quantityReservations",
} as const;
