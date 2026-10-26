// HANDWRITTEN — mirrors apps/api/src/modules/scm/overview. Migrated from the
// LEGACY TexaWave_ERP_old/src/modules/scm/{overview,masterData,barcode,
// advanced,ai} (read-only cross-cutting views; the assistant is the legacy
// Copilot's deterministic intent classifier over live data, with deep links —
// not a hosted LLM, exactly like the legacy one). See packages/api-types/README.md.

export interface SupplyChainStage {
  stage: string;
  count: number;
  path: string;
}

/** Headline figures behind the Supply Chain Flow and its KPI tiles. */
export interface ScmFlowMetrics {
  activeSuppliers: number;
  openRequisitions: number;
  openInspections: number;
  openPurchaseOrders: number;
  unitsAvailable: number;
  stockRows: number;
  inventoryValue: number;
  costedRows: number;
  lowStockItems: number;
  openSalesOrders: number;
  posAwaitingReceipt: number;
  openShipments: number;
}

export interface ScmOverview {
  metrics: ScmFlowMetrics;
  stages: SupplyChainStage[];
}

export interface MasterDataHit {
  type: string;
  id: number;
  label: string;
  sublabel: string | null;
  path: string;
}

export type ExceptionSeverity = "HIGH" | "MEDIUM" | "LOW";

export interface ControlTowerException {
  severity: ExceptionSeverity;
  type: string;
  title: string;
  detail: string;
  path: string;
}

export interface ReplenishmentRow {
  productId: number;
  productCode: string;
  productName: string;
  warehouseId: number;
  warehouse: string;
  available: number;
  reorderLevel: number;
  target: number;
  recommendedQty: number;
  estimatedCost: number;
}

export interface AssistantNavAction {
  label: string;
  path: string;
}

export interface AssistantAnswer {
  intent: string;
  answer: string;
  navActions: AssistantNavAction[];
}

/** Every kind of SCM record a scanned or typed code can resolve to. */
export const SCM_SCAN_TYPES = [
  "PRODUCT",
  "SUPPLIER",
  "WAREHOUSE",
  "LOCATION",
  "BATCH",
  "SERIAL",
  "PURCHASE_REQUISITION",
  "RFQ",
  "PURCHASE_ORDER",
  "GRN",
  "SALES_ORDER",
  "PICK_LIST",
  "PACKAGE",
  "SHIPMENT",
  "RETURN",
  "QC_INSPECTION",
  "QUARANTINE",
  "UNKNOWN",
] as const;
export type ScmScanType = (typeof SCM_SCAN_TYPES)[number];

export interface ScanField {
  label: string;
  value: string;
}

/** One resolved scan: key facts, a link to the full record, follow-up
 * actions and — when the same code matched several records — every match. */
export interface ScanResult {
  type: ScmScanType;
  code: string;
  title: string;
  subtitle?: string | undefined;
  fields: ScanField[];
  viewPath?: string | undefined;
  viewLabel?: string | undefined;
  actions?: { label: string; path: string }[] | undefined;
  alternatives?: ScanResult[] | undefined;
}

export interface BarcodeProductBin {
  locationId: number | null;
  path: string;
  quantity: number | null;
  exact: boolean;
}

/** A row of the Barcode Utilities product table. */
export interface BarcodeProductRow {
  id: number;
  productCode: string;
  name: string;
  category: string | null;
  barcode: string | null;
  barcodeValue: string;
  barcodeCreatedAt: string | null;
  bins: BarcodeProductBin[];
  expiry: {
    source: "BATCH" | "PRODUCT" | "NOT_APPLICABLE" | "NOT_SET";
    date: string | null;
    status: "EXPIRED" | "EXPIRING_SOON" | "VALID" | null;
    text: string;
    batches: { batchNumber: string; expiryDate: string }[];
  };
  lastUpdated: string;
}
