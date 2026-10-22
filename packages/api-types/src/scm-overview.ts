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
