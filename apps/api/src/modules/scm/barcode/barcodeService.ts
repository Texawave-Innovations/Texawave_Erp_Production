// Phase 12 — shared data loader for the barcode/scanning workspace. Builds on top of the SCM
// Master Data layer (`masterData/useScmMasterData.ts`) for the genuine master entities — Products,
// Warehouses, Locations, Batches, Serials — instead of re-fetching them, per the Phase 12b
// architecture ("SCM BARCODE ENGINE" sits on top of "SCM MASTER DATA", never a parallel source of
// truth). It additionally loads the transactional/document collections a scan can also resolve
// against (per-SKU settings, stock balances, POs, GRNs, sales orders, shipments, returns) — these
// aren't "master data" in the Phase 12b sense, they're SCM transaction documents, so they stay
// local to this hook rather than living in the shared master-data cache.
import { useCallback, useEffect, useState } from "react";
import { getAllRecords } from "@/services/firebase";
import { INVENTORY_PATHS } from "../inventory/inventoryPaths";
import type { SellableProduct } from "../inventory/productCatalog";
import { PROCUREMENT_PATHS } from "../procurement/procurementPaths";
import { WAREHOUSE_PATHS } from "../warehouse/warehousePaths";
import { LOGISTICS_PATHS } from "../logistics/logisticsPaths";
import { RETURNS_PATHS } from "../returns/returnsPaths";
import { QUALITY_PATHS } from "../quality/qualityPaths";
import { useScmMasterData } from "../masterData/useScmMasterData";
import type {
  GoodsReceipt,
  InventorySettings,
  OrderAcknowledgement,
  PurchaseRequisition,
  Rfq,
  ScmPurchaseOrder,
  ScmQualityInspection,
  ScmQualityQuarantineRecord,
  ScmReturn,
  ScmShipment,
  SerialNumberRecord,
  StockBalance,
  StockBatch,
  Vendor,
  Warehouse,
  WarehouseLocation,
  WarehousePacking,
  WarehousePicking,
} from "@/types";
import type { ScanHistoryEntry } from "./barcodeTypes";

export interface BarcodeMasterData {
  loading: boolean;
  products: SellableProduct[];
  vendors: Vendor[];
  settings: InventorySettings[];
  warehouses: Warehouse[];
  locations: WarehouseLocation[];
  balances: StockBalance[];
  batches: StockBatch[];
  serials: SerialNumberRecord[];
  requisitions: PurchaseRequisition[];
  rfqs: Rfq[];
  purchaseOrders: ScmPurchaseOrder[];
  grns: GoodsReceipt[];
  salesOrders: OrderAcknowledgement[];
  pickings: WarehousePicking[];
  packings: WarehousePacking[];
  shipments: ScmShipment[];
  returns: ScmReturn[];
  qcInspections: ScmQualityInspection[];
  quarantine: ScmQualityQuarantineRecord[];
  reload: () => Promise<void>;
}

/** Combined data a scan can resolve against — the shared master-data cache plus this domain's
 * own transactional collections, loaded once by the barcode dashboard (and by any page that
 * mounts the global scanner) instead of each Quick Action re-querying Firebase independently. */
export function useBarcodeMasterData(): BarcodeMasterData {
  const master = useScmMasterData();
  const [txLoading, setTxLoading] = useState(true);
  const [settings, setSettings] = useState<InventorySettings[]>([]);
  const [balances, setBalances] = useState<StockBalance[]>([]);
  const [requisitions, setRequisitions] = useState<PurchaseRequisition[]>([]);
  const [rfqs, setRfqs] = useState<Rfq[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<ScmPurchaseOrder[]>([]);
  const [grns, setGrns] = useState<GoodsReceipt[]>([]);
  const [salesOrders, setSalesOrders] = useState<OrderAcknowledgement[]>([]);
  const [pickings, setPickings] = useState<WarehousePicking[]>([]);
  const [packings, setPackings] = useState<WarehousePacking[]>([]);
  const [shipments, setShipments] = useState<ScmShipment[]>([]);
  const [returns, setReturns] = useState<ScmReturn[]>([]);
  const [qcInspections, setQcInspections] = useState<ScmQualityInspection[]>(
    [],
  );
  const [quarantine, setQuarantine] = useState<ScmQualityQuarantineRecord[]>(
    [],
  );

  const loadTransactional = useCallback(async () => {
    setTxLoading(true);
    try {
      const [s, b, req, rfq, po, g, so, pk, pack, sh, r, qc, q] =
        await Promise.all([
          getAllRecords(INVENTORY_PATHS.settings).catch(() => []) as Promise<
            InventorySettings[]
          >,
          getAllRecords(INVENTORY_PATHS.balances).catch(() => []) as Promise<
            StockBalance[]
          >,
          getAllRecords(PROCUREMENT_PATHS.requisitions).catch(
            () => [],
          ) as Promise<PurchaseRequisition[]>,
          getAllRecords(PROCUREMENT_PATHS.rfqs).catch(() => []) as Promise<
            Rfq[]
          >,
          getAllRecords(PROCUREMENT_PATHS.purchaseOrders).catch(
            () => [],
          ) as Promise<ScmPurchaseOrder[]>,
          getAllRecords(PROCUREMENT_PATHS.grns).catch(() => []) as Promise<
            GoodsReceipt[]
          >,
          getAllRecords("sales/orderAcknowledgements").catch(
            () => [],
          ) as Promise<OrderAcknowledgement[]>,
          getAllRecords(WAREHOUSE_PATHS.pickings).catch(() => []) as Promise<
            WarehousePicking[]
          >,
          getAllRecords(WAREHOUSE_PATHS.packings).catch(() => []) as Promise<
            WarehousePacking[]
          >,
          getAllRecords(LOGISTICS_PATHS.shipments).catch(() => []) as Promise<
            ScmShipment[]
          >,
          getAllRecords(RETURNS_PATHS.returns).catch(() => []) as Promise<
            ScmReturn[]
          >,
          getAllRecords(QUALITY_PATHS.inspections).catch(() => []) as Promise<
            ScmQualityInspection[]
          >,
          getAllRecords(QUALITY_PATHS.quarantine).catch(() => []) as Promise<
            ScmQualityQuarantineRecord[]
          >,
        ]);
      setSettings(s);
      setBalances(b);
      setRequisitions(req);
      setRfqs(rfq);
      setPurchaseOrders(po);
      setGrns(g);
      setSalesOrders(so);
      setPickings(pk);
      setPackings(pack);
      setShipments(sh);
      setReturns(r);
      setQcInspections(qc);
      setQuarantine(q);
    } finally {
      setTxLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTransactional();
  }, [loadTransactional]);

  const reload = useCallback(async () => {
    await Promise.all([master.reload(), loadTransactional()]);
  }, [master, loadTransactional]);

  return {
    loading: master.loading || txLoading,
    products: master.data.products,
    vendors: master.data.vendors,
    warehouses: master.data.warehouses,
    locations: master.data.locations,
    batches: master.data.batches,
    serials: master.data.serials,
    settings,
    balances,
    requisitions,
    rfqs,
    purchaseOrders,
    grns,
    salesOrders,
    pickings,
    packings,
    shipments,
    returns,
    qcInspections,
    quarantine,
    reload,
  };
}

// ---------------------------------------------------------------------------
// Scan history — session-local only (sessionStorage), per the Phase 12 spec: "Do not store
// scan history in Firebase unless there is already an existing audit/activity mechanism
// specifically appropriate for this. Prefer local/session state for the first version."
// ---------------------------------------------------------------------------
const HISTORY_KEY = "scm.barcode.scanHistory.v1";
const HISTORY_LIMIT = 50;

export function getScanHistory(): ScanHistoryEntry[] {
  try {
    const raw = sessionStorage.getItem(HISTORY_KEY);
    return raw ? (JSON.parse(raw) as ScanHistoryEntry[]) : [];
  } catch {
    return [];
  }
}

export function addScanHistoryEntry(
  entry: Omit<ScanHistoryEntry, "id" | "time">,
): ScanHistoryEntry[] {
  const next: ScanHistoryEntry = {
    ...entry,
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    time: Date.now(),
  };
  const existing = getScanHistory();
  const updated = [next, ...existing].slice(0, HISTORY_LIMIT);
  try {
    sessionStorage.setItem(HISTORY_KEY, JSON.stringify(updated));
  } catch {
    /* storage unavailable — history just won't persist */
  }
  return updated;
}

export function clearScanHistory(): ScanHistoryEntry[] {
  try {
    sessionStorage.removeItem(HISTORY_KEY);
  } catch {
    /* ignore */
  }
  return [];
}
