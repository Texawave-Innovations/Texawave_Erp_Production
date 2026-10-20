// Phase 12 — SCM Barcode & QR Scanning. Type definitions only; this domain owns no new
// Firebase collection for master data — it identifies and looks up records that already
// live under `sales/products`, `scm/inventory/*`, `scm/warehouses`, `scm/locations`,
// `scm/procurement/*`, `scm/logistics/*`, `scm/returns/*` and `scm/quality/*`. Scan history
// is session-local only (see `barcodeService.ts`), per the Phase 12 spec.

/** Barcode symbologies supported by the reusable generator components. */
export type BarcodeFormat = "CODE128" | "EAN13" | "QR";

/** Every kind of SCM record a scanned/typed code can resolve to. */
export type ScmScanResultType =
  | "PRODUCT"
  | "SUPPLIER"
  | "WAREHOUSE"
  | "LOCATION"
  | "BATCH"
  | "SERIAL"
  | "PURCHASE_REQUISITION"
  | "RFQ"
  | "PURCHASE_ORDER"
  | "GRN"
  | "SALES_ORDER"
  | "PICK_LIST"
  | "PACKAGE"
  | "SHIPMENT"
  | "RETURN"
  | "QC_INSPECTION"
  | "QUARANTINE"
  | "UNKNOWN";

/** A single labeled field shown in a resolved scan result card. */
export interface ScmScanField {
  label: string;
  value: string;
}

/** The outcome of resolving one scanned/typed code against the loaded SCM master data. */
export interface ScmScanResult {
  type: ScmScanResultType;
  /** The exact code that was scanned/entered. */
  code: string;
  /** Short heading for the result card, e.g. the product name or location code. */
  title: string;
  /** One-line context, e.g. "SKU DELL-INS-001 · Dell Inspiron 15". */
  subtitle?: string;
  /** Structured detail rows rendered in the result card. */
  fields: ScmScanField[];
  /** In-app route to open the full record, when one exists. */
  viewPath?: string;
  /** Label for the "View" action, defaults to "View". */
  viewLabel?: string;
  /** Present when the same code matched more than one record type/record — the caller should
   * offer a disambiguation list instead of showing `this` result directly. */
  alternatives?: ScmScanResult[];
}

/** Which SCM workflow a scan happened from. Recorded on every scan-history entry (the "Source
 * Module" column) and used as a UI hint (icon/placeholder text) by whatever opened the scanner —
 * resolution logic itself differs per caller (the global scanner runs the full multi-entity
 * resolver; an embedded "Scan Product" button in GRN/Picking/Packing/Quality instead validates
 * directly against that page's own in-progress document, per the Phase 12 "scan only
 * identifies/validates" rule), not because this type selects a resolution algorithm. */
export type ScannerContext =
  | "GLOBAL"
  | "PRODUCT"
  | "SUPPLIER"
  | "INVENTORY"
  | "LOCATION"
  | "PROCUREMENT"
  | "GRN"
  | "PICKING"
  | "PACKING"
  | "SHIPMENT"
  | "RETURN"
  | "QUALITY";

export const SCANNER_CONTEXT_LABEL: Record<ScannerContext, string> = {
  GLOBAL: "Global Scanner",
  PRODUCT: "Product",
  SUPPLIER: "Supplier",
  INVENTORY: "Inventory",
  LOCATION: "Warehouse",
  PROCUREMENT: "Procurement",
  GRN: "GRN",
  PICKING: "Picking",
  PACKING: "Packing",
  SHIPMENT: "Shipment",
  RETURN: "Returns",
  QUALITY: "Quality",
};

export interface ScanHistoryEntry {
  id: string;
  time: number;
  code: string;
  type: ScmScanResultType;
  label: string;
  viewPath?: string;
  /** Which SCM workflow this scan happened from — "Found" is implied by `type !== 'UNKNOWN'`. */
  source?: ScannerContext;
}
