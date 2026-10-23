// SCM demo data seed.
//
// Plays a ~4-month supply-chain story through the real SCM services (the same functions the pages
// call), so every stock balance, ledger entry, reservation and status is exactly what the UI would
// have produced — nothing is written as a bare number. The services stamp `Date.now()`, so the seed
// keeps a real-time → simulated-time timeline while it runs (`SimClock`) and, once finished,
// rewrites every timestamp it produced onto that timeline. That is what gives the reports, the
// replenishment averages and the fast/slow/dead-stock analysis real history to work with.
//
// Every record the seed creates is listed in `scm/demoSeed/registry`, which is what
// `removeDemoSeed` deletes afterwards.
import { update, remove } from "firebase/database";
import {
  createRecord,
  database,
  get,
  getRecordById,
  getRecordsWhere,
  ref,
  set,
  updateRecord,
} from "@/services/firebase";
import { logRecordAudit } from "@/services/auditLog";
import { notifyAdminFeed } from "@/services/notifications";
import { reserveDocumentNumber } from "@/utils/numberGenerator";
import {
  INVENTORY_PATHS,
  batchKey,
  firebaseKey,
  settingsKey,
} from "../inventory/inventoryPaths";
import { postLedgerEntry, postOnce } from "../inventory/stockLedgerService";
import { getSellableProducts } from "../inventory/productCatalog";
import { PROCUREMENT_PATHS } from "../procurement/procurementPaths";
import { documentTotals, lineTotal } from "../procurement/procurementHelpers";
import {
  approvePurchaseOrder,
  closePurchaseOrder,
  createPurchaseOrder,
} from "../procurement/purchaseOrderService";
import { createAndPostGrn, type GrnLineInput } from "../procurement/grnService";
import {
  getOpenRfq,
  refreshRfqResponseStatus,
  selectQuotation,
} from "../procurement/quotationService";
import { WAREHOUSE_PATHS } from "../warehouse/warehousePaths";
import { relocateTrackedStock } from "../warehouse/warehouseHelpers";
import { ORDER_PATHS } from "../orders/orderPaths";
import {
  createFulfillment,
  createPickForFulfillment,
  createShortageRequisition,
  finalizeFulfillment,
  linkPackingToFulfillment,
  reserveFulfillmentStock,
  syncFulfillmentProgress,
} from "../orders/orderFulfillmentService";
import { LOGISTICS_PATHS } from "../logistics/logisticsPaths";
import {
  assignCarrier,
  createCarrier,
  createShipment,
  createShipmentLabel,
  dispatchShipment,
  markShipmentDelivered,
  recordDeliveryException,
  resolveDeliveryException,
  updateShipmentStatus,
} from "../logistics/logisticsService";
import { RETURNS_PATHS } from "../returns/returnsPaths";
import { approveReturn, submitReturn } from "../returns/returnsMasterService";
import {
  completeCustomerReturnInspection,
  createCustomerReturn,
  markCustomerReturnInTransit,
  moveCustomerReturnToDisposition,
  receiveCustomerReturn,
  startCustomerReturnInspection,
} from "../returns/customerReturnService";
import {
  completeCustomerReturn,
  setCustomerReturnItemDisposition,
} from "../returns/customerReturnDispositionService";
import {
  completeVendorReturn,
  createVendorReturn,
  markVendorReturnReadyToShip,
  markVendorReturnReceived,
  shipVendorReturn,
} from "../returns/vendorReturnService";
import { QUALITY_PATHS } from "../quality/qualityPaths";
import {
  completeInspection,
  createInspection,
  recordItemResult,
  startInspection,
  type CreateInspectionItemInput,
  type RecordItemResultInput,
} from "../quality/inspectionService";
import { createDefect, createTemplate } from "../quality/qualityMasterService";
import {
  rejectQuarantine,
  reviewQuarantine,
} from "../quality/quarantineService";
import { claimSupplierCode } from "../suppliers/supplierHelpers";
import {
  transitionStatus,
  transitionWithSideEffect,
} from "../shared/statusTransition";
import { SCM_CROSS_MODULE_PATHS } from "../shared/crossModulePaths";
import { toLocalDateKey } from "../shared/format";
import { ADVANCED_PATHS } from "../advanced/advancedPaths";
import type {
  AdjustmentStatus,
  GoodsReceipt,
  LogisticsCarrier,
  OrderAcknowledgement,
  OrderFulfillment,
  PackStatus,
  PickStatus,
  PutawayStatus,
  QuotationComparison,
  RequisitionStatus,
  Rfq,
  RfqStatus,
  ScmPOStatus,
  ScmPurchaseOrder,
  ScmQualityInspection,
  ScmQualityQuarantineRecord,
  ScmQualityTemplate,
  ScmReturn,
  ScmShipment,
  ShipmentServiceType,
  StockAdjustment,
  StockTransfer,
  SupplierQuotation,
  TransferStatus,
  WarehouseMovementStatus,
  WarehousePacking,
  WarehousePicking,
  ScmQualityCheckpointResult,
  DeliveryExceptionCode,
  ShipmentException,
} from "@/types";
import {
  CARRIERS,
  CUSTOMERS,
  DEFECTS,
  LOCATION_LAYOUT,
  PERSONA,
  PRODUCTS,
  TEMPLATES,
  VENDORS,
  WAREHOUSES,
  type CustomerKey,
  type ProductKey,
  type VendorKey,
  type WarehouseKey,
} from "./demoSeedData";

export const DEMO_SEED_PATH = "scm/demoSeed";

export interface DemoSeedMeta {
  seededAt: number;
  seededBy: string;
  recordCount: number;
  registry: string[];
}

export type SeedLogger = (message: string) => void;

const DAY = 24 * 60 * 60 * 1000;

const HSN: Record<ProductKey, string> = {
  bearing: "8482",
  valve: "8481",
  motor: "8501",
  cable: "8544",
  housing: "7616",
  gloves: "4015",
  seal: "4016",
  pump: "8413",
};

/** Shipping weight per unit (kg), used to size packages. */
const UNIT_WEIGHT_KG: Record<ProductKey, number> = {
  bearing: 0.25,
  valve: 1.8,
  motor: 28,
  cable: 0.12,
  housing: 2.4,
  gloves: 1,
  seal: 0.3,
  pump: 14,
};

const PRODUCT_KEY_BY_CODE = new Map<string, ProductKey>(
  (Object.keys(PRODUCTS) as ProductKey[]).map((k) => [PRODUCTS[k].code, k]),
);

// ---------------------------------------------------------------------------
// Simulated clock
// ---------------------------------------------------------------------------

/** Records, for each step of the story, the real time it started and the simulated time it stands
 *  for. Any timestamp written during the run maps onto the simulated timeline by the step it
 *  falls in, so ordering (and the gaps between steps) comes out exactly as scripted. */
class SimClock {
  readonly realStart = Date.now();
  private realEnd = Number.POSITIVE_INFINITY;
  private readonly base = Date.now();
  private readonly segments: Array<{ real: number; sim: number }> = [];

  async at(daysAgo: number, hour = 10, minute = 0): Promise<void> {
    await new Promise((r) => setTimeout(r, 5)); // keep segment boundaries strictly apart
    const target = new Date(this.base - daysAgo * DAY);
    target.setHours(hour, minute, 0, 0);
    const real = Date.now();
    let sim = Math.min(target.getTime(), this.base - 60 * 60 * 1000);
    const last = this.segments[this.segments.length - 1];
    if (last) {
      const lastSimNow = last.sim + (real - last.real);
      if (sim <= lastSimNow) sim = lastSimNow + 60 * 1000;
    }
    this.segments.push({ real, sim });
  }

  private currentSim(): number {
    const last = this.segments[this.segments.length - 1];
    return last ? last.sim + (Date.now() - last.real) : this.base;
  }

  /** `YYYY-MM-DD` of the current simulated day. */
  today(): string {
    return toLocalDateKey(new Date(this.currentSim()));
  }

  /** `YYYY-MM-DD` `days` after the current simulated day (negative = before it). */
  inDays(days: number): string {
    return toLocalDateKey(new Date(this.currentSim() + days * DAY));
  }

  finish(): void {
    this.realEnd = Date.now();
  }

  inWindow(value: unknown): value is number {
    return (
      typeof value === "number" &&
      value >= this.realStart &&
      value <= this.realEnd
    );
  }

  map(t: number): number {
    for (let i = this.segments.length - 1; i >= 0; i--) {
      if (this.segments[i].real <= t)
        return this.segments[i].sim + (t - this.segments[i].real);
    }
    return t;
  }

  get todayKey(): string {
    return toLocalDateKey(new Date(this.base));
  }
}

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

async function fresh<T>(path: string, id: string): Promise<T> {
  const rec = await getRecordById(path, id);
  if (!rec) throw new Error(`Seed: ${path}/${id} not found`);
  return rec as T;
}

function product(key: ProductKey) {
  return PRODUCTS[key];
}

interface Ctx {
  clock: SimClock;
  log: SeedLogger;
  warehouseId: Record<WarehouseKey, string>;
  /** `${warehouse}:${zone}-${rack}-${shelf}-${bin}` → location id */
  binId: Map<string, string>;
  vendorId: Record<VendorKey, string>;
  customerId: Record<CustomerKey, string>;
  carrierByCode: Map<string, LogisticsCarrier>;
  templateByCode: Map<string, ScmQualityTemplate>;
  soSeq: number;
}

function bin(ctx: Ctx, wh: WarehouseKey, path: string): string {
  const id = ctx.binId.get(`${wh}:${path}`);
  if (!id) throw new Error(`Seed: unknown bin ${wh}:${path}`);
  return id;
}

// ---------------------------------------------------------------------------
// Master data
// ---------------------------------------------------------------------------

async function assertNoConflicts(): Promise<void> {
  const existing = await get(ref(database, DEMO_SEED_PATH));
  if (existing.exists())
    throw new Error(
      "Demo data is already seeded. Remove it first to seed again.",
    );

  const [products, warehouses, vendors, customers] = await Promise.all([
    getSellableProducts(),
    get(ref(database, INVENTORY_PATHS.warehouses)),
    get(ref(database, SCM_CROSS_MODULE_PATHS.vendors)),
    get(ref(database, "sales/customers")),
  ]);
  const productCodes = new Set(products.map((p) => p.productCode));
  const productClash = Object.values(PRODUCTS).find((p) =>
    productCodes.has(p.code),
  );
  if (productClash)
    throw new Error(
      `Product code ${productClash.code} already exists in the product master.`,
    );

  const whCodes = new Set(
    Object.values(
      (warehouses.val() || {}) as Record<string, { code?: string }>,
    ).map((w) => (w.code || "").toUpperCase()),
  );
  const whClash = Object.values(WAREHOUSES).find((w) => whCodes.has(w.code));
  if (whClash)
    throw new Error(`Warehouse code ${whClash.code} already exists.`);

  const vendorCodes = new Set(
    Object.values(
      (vendors.val() || {}) as Record<string, { vendorCode?: string }>,
    ).map((v) => (v.vendorCode || "").toUpperCase()),
  );
  const vendorClash = Object.values(VENDORS).find((v) =>
    vendorCodes.has(v.code),
  );
  if (vendorClash)
    throw new Error(`Supplier code ${vendorClash.code} already exists.`);

  const customerCodes = new Set(
    Object.values(
      (customers.val() || {}) as Record<string, { customerCode?: string }>,
    ).map((c) => (c.customerCode || "").toUpperCase()),
  );
  const customerClash = Object.values(CUSTOMERS).find((c) =>
    customerCodes.has(c.code),
  );
  if (customerClash)
    throw new Error(`Customer code ${customerClash.code} already exists.`);
}

async function seedWarehouses(ctx: Ctx): Promise<void> {
  const by = PERSONA.inventory;
  for (const key of Object.keys(WAREHOUSES) as WarehouseKey[]) {
    const w = WAREHOUSES[key];
    const id = await createRecord(INVENTORY_PATHS.warehouses, {
      code: w.code,
      name: w.name,
      type: w.type,
      address: w.address,
      city: w.city,
      state: w.state,
      country: "India",
      postalCode: w.postalCode,
      managerName: w.managerName,
      status: "Active",
      contactPerson: w.managerName,
      phone: w.phone,
      capacity: w.capacity,
      capacityUnit: "SQFT",
      operatingHours: "Mon–Sat, 08:00–20:00",
      createdBy: by,
    });
    if (!id) throw new Error("Seed: failed to create warehouse");
    await logRecordAudit(
      INVENTORY_PATHS.warehouses,
      id,
      "Warehouse created",
      by,
      `${w.code} — ${w.name}`,
    );
    ctx.warehouseId[key] = id;

    for (const zone of LOCATION_LAYOUT[key]) {
      const zoneId = await createLocation(
        key,
        w.code,
        "ZONE",
        undefined,
        [zone.zone],
        zone.zoneName,
        undefined,
        by,
      );
      for (const rack of zone.racks) {
        const rackId = await createLocation(
          key,
          w.code,
          "RACK",
          zoneId,
          [zone.zone, rack.rack],
          undefined,
          undefined,
          by,
        );
        for (const shelf of rack.shelves) {
          const shelfId = await createLocation(
            key,
            w.code,
            "SHELF",
            rackId,
            [zone.zone, rack.rack, shelf.shelf],
            undefined,
            undefined,
            by,
          );
          for (const b of shelf.bins) {
            const binId = await createLocation(
              key,
              w.code,
              "BIN",
              shelfId,
              [zone.zone, rack.rack, shelf.shelf, b.bin],
              b.name,
              b.capacity,
              by,
            );
            ctx.binId.set(
              `${key}:${zone.zone}-${rack.rack}-${shelf.shelf}-${b.bin}`,
              binId,
            );
          }
        }
      }
    }
  }

  async function createLocation(
    wh: WarehouseKey,
    whCode: string,
    type: "ZONE" | "RACK" | "SHELF" | "BIN",
    parentId: string | undefined,
    chain: string[],
    name: string | undefined,
    capacity: number | undefined,
    performedBy: string,
  ): Promise<string> {
    const locationCode = [whCode, ...chain].join("-").toUpperCase();
    const id = await createRecord(INVENTORY_PATHS.locations, {
      warehouseId: ctx.warehouseId[wh],
      parentLocationId: parentId,
      locationType: type,
      locationCode,
      zone: chain[0],
      rack: chain[1],
      shelf: chain[2],
      binCode: chain[chain.length - 1],
      locationName: name,
      capacity,
      capacityUnit: capacity ? "units" : undefined,
      status: "Active",
      createdBy: performedBy,
      createdAt: Date.now(),
    });
    if (!id) throw new Error("Seed: failed to create location");
    await logRecordAudit(
      INVENTORY_PATHS.locations,
      id,
      "Location created",
      performedBy,
      `${type} ${locationCode}`,
    );
    return id;
  }
}

async function seedProducts(): Promise<void> {
  const by = PERSONA.inventory;
  for (const key of Object.keys(PRODUCTS) as ProductKey[]) {
    const p: (typeof PRODUCTS)[ProductKey] = PRODUCTS[key];
    await createRecord(SCM_CROSS_MODULE_PATHS.products, {
      name: p.name,
      productImages: null,
      items: [
        {
          productCode: p.code,
          hsn: HSN[key],
          unitPrice: p.sellPrice,
          stockQty: 0,
          unit: p.uom,
          category: p.category,
          type: null,
          group: null,
          images: null,
          drawings: null,
          size: {
            height: null,
            width: null,
            length: null,
            weight: null,
            heightUnit: null,
            widthUnit: null,
            lengthUnit: null,
            weightUnit: null,
          },
        },
      ],
      updatedAt: Date.now(),
    });
    const tracking = p as { batchTracked?: boolean; serialTracked?: boolean };
    await updateRecord(INVENTORY_PATHS.settings, settingsKey(p.code), {
      id: settingsKey(p.code),
      productCode: p.code,
      reorderLevel: p.reorderLevel,
      minimumStock: p.minimumStock,
      maximumStock: p.maximumStock,
      costPrice: p.costPrice,
      batchTracked: !!tracking.batchTracked,
      serialTracked: !!tracking.serialTracked,
      updatedBy: by,
    });
  }
}

async function seedVendors(ctx: Ctx): Promise<void> {
  for (const key of Object.keys(VENDORS) as VendorKey[]) {
    const v = VENDORS[key];
    if (!(await claimSupplierCode(v.code)))
      throw new Error(`Supplier code ${v.code} is already claimed.`);
    const id = await createRecord(SCM_CROSS_MODULE_PATHS.vendors, {
      vendorCode: v.code,
      companyName: v.companyName,
      type: v.type,
      status: v.status,
      gst: v.gst,
      pan: v.pan,
      contactPerson: v.contactPerson,
      phone: v.phone,
      email: v.email,
      addresses: [
        {
          id: "addr-1",
          type: "billing",
          label: "Primary",
          street: v.street,
          city: v.city,
          state: v.state,
          pincode: v.pincode,
          country: "India",
          isDefault: true,
        },
      ],
      paymentTerms: v.paymentTerms,
      creditLimit: v.creditLimit,
      currency: "INR",
      leadTimeDays: v.leadTimeDays,
      rating: v.rating || null,
      notes: v.notes,
    });
    if (!id) throw new Error("Seed: failed to create supplier");
    await logRecordAudit(
      SCM_CROSS_MODULE_PATHS.vendors,
      id,
      "Supplier created",
      PERSONA.procurement,
      `Created by ${PERSONA.procurement}`,
    );
    ctx.vendorId[key] = id;
  }
}

async function seedCustomers(ctx: Ctx): Promise<void> {
  for (const key of Object.keys(CUSTOMERS) as CustomerKey[]) {
    const c = CUSTOMERS[key];
    const address = (type: "billing" | "shipping", id: string) => ({
      id,
      type,
      label: type === "billing" ? "Head Office" : "Plant",
      street: c.street,
      area: "",
      city: c.city,
      state: c.state,
      pincode: c.pincode,
      country: "India",
      isDefault: true,
    });
    const id = await createRecord("sales/customers", {
      customerCode: c.code,
      companyName: c.companyName,
      contactPerson: c.contactPerson,
      email: c.email,
      phone: c.phone,
      gst: c.gst,
      pan: c.pan,
      addresses: [address("billing", "addr-1"), address("shipping", "addr-2")],
      updatedAt: Date.now(),
    });
    if (!id) throw new Error("Seed: failed to create customer");
    ctx.customerId[key] = id;
  }
}

async function seedLogisticsAndQualityMasters(ctx: Ctx): Promise<void> {
  for (const c of CARRIERS) {
    const id = await createCarrier(
      {
        carrierCode: c.code,
        carrierName: c.name,
        serviceTypes: c.serviceTypes,
        contact: c.contact,
        phone: c.phone,
        email: c.email,
        notes: c.notes,
      },
      PERSONA.logistics,
    );
    ctx.carrierByCode.set(
      c.code,
      await fresh<LogisticsCarrier>(LOGISTICS_PATHS.carriers, id),
    );
  }
  for (const d of DEFECTS) {
    await createDefect(
      {
        defectCode: d.code,
        name: d.name,
        description: d.description,
        category: d.category,
        severity: d.severity,
      },
      PERSONA.quality,
    );
  }
  for (const t of TEMPLATES) {
    const id = await createTemplate(
      {
        templateCode: t.code,
        name: t.name,
        description: t.description,
        inspectionType: t.inspectionType,
        checkpoints: t.checkpoints,
      },
      PERSONA.quality,
    );
    ctx.templateByCode.set(
      t.code,
      await fresh<ScmQualityTemplate>(QUALITY_PATHS.templates, id),
    );
  }
}

async function postOpeningBalance(
  ctx: Ctx,
  key: ProductKey,
  wh: WarehouseKey,
  qty: number,
): Promise<void> {
  const p = product(key);
  await postLedgerEntry({
    productCode: p.code,
    productName: p.name,
    warehouseId: ctx.warehouseId[wh],
    transactionType: "OPENING_BALANCE",
    referenceType: "OPENING_BALANCE",
    quantityIn: qty,
    unitCost: p.costPrice,
    notes: "Opening stock at go-live",
    createdBy: PERSONA.inventory,
  });
}

// ---------------------------------------------------------------------------
// Procurement
// ---------------------------------------------------------------------------

interface Line {
  p: ProductKey;
  qty: number;
}

async function createRequisition(
  ctx: Ctx,
  opts: {
    wh: WarehouseKey;
    lines: Array<Line & { estCost?: number }>;
    priority: "Low" | "Normal" | "High" | "Urgent";
    department: string;
    purpose: string;
    requiredInDays: number;
    by: string;
  },
): Promise<{ id: string; number: string }> {
  const items = opts.lines.map((l) => {
    const p = product(l.p);
    const estimatedUnitCost = l.estCost ?? p.costPrice;
    return {
      productCode: p.code,
      productName: p.name,
      uom: p.uom,
      quantity: l.qty,
      estimatedUnitCost,
      estimatedTotal: Math.round(l.qty * estimatedUnitCost * 100) / 100,
    };
  });
  const subtotal = items.reduce((s, it) => s + it.estimatedTotal, 0);
  const number = await reserveDocumentNumber("purchaseRequisition");
  const id = await createRecord(PROCUREMENT_PATHS.requisitions, {
    department: opts.department,
    requestDate: ctx.clock.today(),
    requiredDate: ctx.clock.inDays(opts.requiredInDays),
    priority: opts.priority,
    warehouseId: ctx.warehouseId[opts.wh],
    purpose: opts.purpose,
    items,
    subtotal,
    tax: 0,
    total: subtotal,
    requisitionNumber: number,
    requestedBy: opts.by,
    status: "DRAFT" as RequisitionStatus,
    createdBy: opts.by,
  });
  if (!id) throw new Error("Seed: failed to create requisition");
  await logRecordAudit(
    PROCUREMENT_PATHS.requisitions,
    id,
    "Requisition created",
    opts.by,
    number,
  );
  return { id, number };
}

async function submitRequisition(
  id: string,
  number: string,
  by: string,
): Promise<void> {
  await transitionStatus<RequisitionStatus>(
    PROCUREMENT_PATHS.requisitions,
    id,
    ["DRAFT"],
    "SUBMITTED",
  );
  await logRecordAudit(
    PROCUREMENT_PATHS.requisitions,
    id,
    "Requisition submitted",
    by,
    number,
  );
  await notifyAdminFeed(
    "Purchase Requisition Submitted",
    `${number} by ${by} is awaiting approval`,
    "procurement",
  );
}

async function approveRequisition(
  id: string,
  number: string,
  by: string,
): Promise<void> {
  await transitionStatus<RequisitionStatus>(
    PROCUREMENT_PATHS.requisitions,
    id,
    ["SUBMITTED", "UNDER_REVIEW"],
    "APPROVED",
    { approvedBy: by, approvedAt: Date.now() },
  );
  await logRecordAudit(
    PROCUREMENT_PATHS.requisitions,
    id,
    "Requisition approved",
    by,
    number,
  );
  await notifyAdminFeed(
    "Purchase Requisition Approved",
    `${number} approved by ${by} — ready for RFQ`,
    "procurement",
  );
}

async function createAndIssueRfq(
  ctx: Ctx,
  opts: {
    requisition: { id: string; number: string };
    vendors: VendorKey[];
    wh: WarehouseKey;
    lines: Line[];
    dueInDays: number;
    paymentTerms: string;
    deliveryTerms: string;
    notes?: string;
    by: string;
  },
): Promise<string> {
  await transitionStatus<RequisitionStatus>(
    PROCUREMENT_PATHS.requisitions,
    opts.requisition.id,
    ["APPROVED"],
    "CONVERTED",
  );
  const rfqNumber = await reserveDocumentNumber("rfq");
  const supplierIds = opts.vendors.map((v) => ctx.vendorId[v]);
  const supplierNamesSnapshot = Object.fromEntries(
    opts.vendors.map((v) => [ctx.vendorId[v], VENDORS[v].companyName]),
  );
  const id = await createRecord(PROCUREMENT_PATHS.rfqs, {
    rfqNumber,
    sourceRequisitionId: opts.requisition.id,
    sourceRequisitionNumber: opts.requisition.number,
    supplierIds,
    supplierNamesSnapshot,
    issueDate: ctx.clock.today(),
    responseDueDate: ctx.clock.inDays(opts.dueInDays),
    warehouseId: ctx.warehouseId[opts.wh],
    deliveryLocation: WAREHOUSES[opts.wh].name,
    currency: "INR",
    paymentTerms: opts.paymentTerms,
    deliveryTerms: opts.deliveryTerms,
    notes: opts.notes,
    items: opts.lines.map((l) => ({
      productCode: product(l.p).code,
      productName: product(l.p).name,
      uom: product(l.p).uom,
      quantity: l.qty,
    })),
    status: "DRAFT" as RfqStatus,
    createdBy: opts.by,
    createdAt: Date.now(),
  });
  if (!id) throw new Error("Seed: failed to create RFQ");
  await logRecordAudit(
    PROCUREMENT_PATHS.rfqs,
    id,
    "RFQ created",
    opts.by,
    rfqNumber,
  );
  await logRecordAudit(
    PROCUREMENT_PATHS.requisitions,
    opts.requisition.id,
    "Requisition converted to RFQ",
    opts.by,
    rfqNumber,
  );
  await transitionStatus<RfqStatus>(
    PROCUREMENT_PATHS.rfqs,
    id,
    ["DRAFT"],
    "RESPONSES_PENDING",
  );
  await logRecordAudit(
    PROCUREMENT_PATHS.rfqs,
    id,
    "RFQ issued to suppliers",
    opts.by,
    `${rfqNumber}: ${supplierIds.length} supplier(s)`,
  );
  return id;
}

interface PricedLine extends Line {
  unitPrice: number;
  discount?: number;
  taxRate?: number;
  deliveryInDays?: number;
}

function pricedItems(ctx: Ctx, lines: PricedLine[]) {
  return lines.map((l) => {
    const p = product(l.p);
    const discount = l.discount || 0;
    const taxRate = l.taxRate ?? 18;
    const { taxAmount, total } = lineTotal(
      l.qty,
      l.unitPrice,
      discount,
      taxRate,
    );
    return {
      productCode: p.code,
      productName: p.name,
      uom: p.uom,
      quantity: l.qty,
      unitPrice: l.unitPrice,
      discount,
      taxRate,
      taxAmount,
      total,
      promisedDeliveryDate:
        l.deliveryInDays != null
          ? ctx.clock.inDays(l.deliveryInDays)
          : undefined,
    };
  });
}

async function recordQuotation(
  ctx: Ctx,
  opts: {
    rfqId: string;
    vendor: VendorKey;
    supplierRef: string;
    lines: PricedLine[];
    freight: number;
    discount: number;
    validForDays: number;
    paymentTerms: string;
    deliveryTerms: string;
    notes?: string;
    by: string;
  },
): Promise<string> {
  const rfq = await getOpenRfq(opts.rfqId);
  const items = pricedItems(ctx, opts.lines);
  const {
    subtotal,
    taxAmount: tax,
    total,
  } = documentTotals(items, opts.freight, opts.discount);
  const vendor = VENDORS[opts.vendor];
  const quotationNumber = await reserveDocumentNumber("supplierQuotation");
  const id = await createRecord(PROCUREMENT_PATHS.quotations, {
    quotationNumber,
    supplierQuotationNumber: opts.supplierRef,
    rfqId: rfq.id,
    rfqNumber: rfq.rfqNumber,
    vendorId: ctx.vendorId[opts.vendor],
    vendorNameSnapshot: vendor.companyName,
    vendorGSTINSnapshot: vendor.gst,
    quotationDate: ctx.clock.today(),
    validUntil: ctx.clock.inDays(opts.validForDays),
    currency: "INR",
    paymentTerms: opts.paymentTerms,
    deliveryTerms: opts.deliveryTerms,
    freight: opts.freight,
    discount: opts.discount,
    tax,
    subtotal,
    total,
    notes: opts.notes,
    items,
    status: "RECEIVED",
    createdBy: opts.by,
    createdAt: Date.now(),
  } satisfies Omit<SupplierQuotation, "id">);
  if (!id) throw new Error("Seed: failed to create quotation");
  await logRecordAudit(
    PROCUREMENT_PATHS.quotations,
    id,
    "Supplier quotation recorded",
    opts.by,
    `${quotationNumber} from ${vendor.companyName}`,
  );
  await refreshRfqResponseStatus(rfq);
  return id;
}

async function compareAndSelect(
  rfqId: string,
  selectedId: string,
  remarks: string,
  by: string,
): Promise<SupplierQuotation> {
  const rfq = await fresh<Rfq>(PROCUREMENT_PATHS.rfqs, rfqId);
  const quotations = await getRecordsWhere<SupplierQuotation>(
    PROCUREMENT_PATHS.quotations,
    "rfqId",
    rfqId,
  );
  await selectQuotation(selectedId, quotations);
  const id = await createRecord(PROCUREMENT_PATHS.comparisons, {
    rfqId,
    rfqNumber: rfq.rfqNumber,
    quotationIds: quotations.map((q) => q.id),
    selectedQuotationIds: [selectedId],
    selectedBy: by,
    selectedAt: Date.now(),
    remarks,
    status: "DECIDED",
    createdBy: by,
    createdAt: Date.now(),
  } satisfies Omit<QuotationComparison, "id">);
  if (id)
    await logRecordAudit(
      PROCUREMENT_PATHS.comparisons,
      id,
      "Quotation comparison recorded",
      by,
      `${rfq.rfqNumber}: ${quotations.length} quotation(s) compared`,
    );
  await logRecordAudit(
    PROCUREMENT_PATHS.quotations,
    selectedId,
    "Quotation selected",
    by,
    remarks,
  );
  return fresh<SupplierQuotation>(PROCUREMENT_PATHS.quotations, selectedId);
}

async function createPo(
  ctx: Ctx,
  opts: {
    vendor: VendorKey;
    wh: WarehouseKey;
    lines?: PricedLine[];
    quotation?: SupplierQuotation;
    freight?: number;
    discount?: number;
    expectedInDays: number;
    paymentTerms: string;
    notes?: string;
    by: string;
  },
): Promise<{ id: string; poNumber: string }> {
  const vendor = VENDORS[opts.vendor];
  const items = opts.quotation
    ? opts.quotation.items.map((it) => ({
        productCode: it.productCode,
        productName: it.productName,
        uom: it.uom,
        quantity: it.quantity,
        receivedQuantity: 0,
        unitPrice: it.unitPrice,
        discount: it.discount,
        taxRate: it.taxRate,
        taxAmount: it.taxAmount,
        total: it.total,
      }))
    : pricedItems(ctx, opts.lines || []).map((it) => ({
        productCode: it.productCode,
        productName: it.productName,
        uom: it.uom,
        quantity: it.quantity,
        receivedQuantity: 0,
        unitPrice: it.unitPrice,
        discount: it.discount,
        taxRate: it.taxRate,
        taxAmount: it.taxAmount,
        total: it.total,
      }));
  const freight = opts.quotation ? opts.quotation.freight : opts.freight || 0;
  const discount = opts.quotation
    ? opts.quotation.discount
    : opts.discount || 0;
  const { subtotal, taxAmount, total } = documentTotals(
    items,
    freight,
    discount,
  );
  const result = await createPurchaseOrder({
    vendorId: ctx.vendorId[opts.vendor],
    vendorNameSnapshot: vendor.companyName,
    vendorGSTINSnapshot: vendor.gst,
    sourceQuotationId: opts.quotation?.id,
    sourceQuotationNumber: opts.quotation?.quotationNumber,
    sourceRfqId: opts.quotation?.rfqId,
    sourceRfqNumber: opts.quotation?.rfqNumber,
    poDate: ctx.clock.today(),
    expectedDeliveryDate: ctx.clock.inDays(opts.expectedInDays),
    warehouseId: ctx.warehouseId[opts.wh],
    deliveryLocation: WAREHOUSES[opts.wh].name,
    paymentTerms: opts.paymentTerms,
    currency: "INR",
    items,
    freight,
    discount,
    subtotal,
    taxAmount,
    total,
    notes: opts.notes,
    createdBy: opts.by,
  });
  await logRecordAudit(
    PROCUREMENT_PATHS.purchaseOrders,
    result.id,
    "Purchase order created",
    opts.by,
    `${result.poNumber} — ${vendor.companyName}`,
  );
  await transitionStatus<ScmPOStatus>(
    PROCUREMENT_PATHS.purchaseOrders,
    result.id,
    ["DRAFT"],
    "PENDING_APPROVAL",
  );
  await logRecordAudit(
    PROCUREMENT_PATHS.purchaseOrders,
    result.id,
    "PO submitted for approval",
    opts.by,
    result.poNumber,
  );
  await notifyAdminFeed(
    "Purchase Order Awaiting Approval",
    `${result.poNumber} (${vendor.companyName}) submitted by ${opts.by}`,
    "procurement",
  );
  return result;
}

async function approveAndSendPo(
  po: { id: string; poNumber: string },
  vendor: VendorKey,
  send = true,
): Promise<void> {
  const by = PERSONA.approver;
  await approvePurchaseOrder(po.id, by);
  await logRecordAudit(
    PROCUREMENT_PATHS.purchaseOrders,
    po.id,
    "PO approved",
    by,
    po.poNumber,
  );
  await notifyAdminFeed(
    "Purchase Order Approved",
    `${po.poNumber} (${VENDORS[vendor].companyName}) approved by ${by}`,
    "procurement",
  );
  if (!send) return;
  await transitionStatus<ScmPOStatus>(
    PROCUREMENT_PATHS.purchaseOrders,
    po.id,
    ["APPROVED"],
    "SENT",
  );
  await logRecordAudit(
    PROCUREMENT_PATHS.purchaseOrders,
    po.id,
    "PO sent to supplier",
    PERSONA.procurement,
    po.poNumber,
  );
}

async function receiveGrn(
  ctx: Ctx,
  poId: string,
  lines: Array<{
    index: number;
    receive: number;
    reject?: number;
    batch?: string;
    serials?: string[];
  }>,
  notes: string,
): Promise<GoodsReceipt> {
  const po = await fresh<ScmPurchaseOrder>(
    PROCUREMENT_PATHS.purchaseOrders,
    poId,
  );
  const grnLines: GrnLineInput[] = lines.map((l) => {
    const it = po.items[l.index];
    return {
      poLineIndex: l.index,
      productCode: it.productCode,
      productName: it.productName,
      uom: it.uom,
      orderedQuantity: it.quantity,
      previouslyReceivedQuantity: it.receivedQuantity || 0,
      receivingQuantity: l.receive,
      rejectedQuantity: l.reject || 0,
      batchNumber: l.batch || "",
      serialNumbers: l.serials || [],
      unitCost: it.unitPrice,
      notes: "",
    };
  });
  const { grnNumber } = await createAndPostGrn({
    po,
    lines: grnLines,
    receiptDate: ctx.clock.today(),
    notes,
    performedBy: PERSONA.warehouse,
  });
  const grns = await getRecordsWhere<GoodsReceipt>(
    PROCUREMENT_PATHS.grns,
    "purchaseOrderId",
    poId,
  );
  const grn = grns.find((g) => g.grnNumber === grnNumber);
  if (!grn) throw new Error(`Seed: GRN ${grnNumber} not found after posting`);
  return grn;
}

/** Put-away (mirrors ScmPutaway): create PENDING, optionally complete (relocating batch/serial stock). */
async function putaway(
  grn: GoodsReceipt,
  rows: Array<{ productCode: string; qty: number; binId: string }>,
  complete: boolean,
): Promise<string> {
  const by = PERSONA.warehouse;
  const putawayNumber = await reserveDocumentNumber("putaway");
  const items = rows.map((r) => {
    const line = grn.items.find((it) => it.productCode === r.productCode);
    return {
      productCode: r.productCode,
      productName: line?.productName || r.productCode,
      batchNumber: line?.batchNumber,
      serialNumbers: line?.serialNumbers,
      quantity: r.qty,
      destinationLocationId: r.binId,
    };
  });
  const id = await createRecord(WAREHOUSE_PATHS.putaways, {
    putawayNumber,
    grnId: grn.id,
    grnNumber: grn.grnNumber,
    warehouseId: grn.warehouseId,
    items,
    status: "PENDING" as PutawayStatus,
    assignedBy: by,
    createdBy: by,
    createdAt: Date.now(),
  });
  if (!id) throw new Error("Seed: failed to create putaway");
  await logRecordAudit(
    WAREHOUSE_PATHS.putaways,
    id,
    "Putaway created",
    by,
    `${putawayNumber} against ${grn.grnNumber}`,
  );
  await notifyAdminFeed(
    "Putaway Pending",
    `${putawayNumber} raised against ${grn.grnNumber} — ${items.length} item(s) awaiting putaway.`,
    "inventory",
  );
  if (!complete) return id;

  await transitionStatus<PutawayStatus>(
    WAREHOUSE_PATHS.putaways,
    id,
    ["PENDING", "IN_PROGRESS"],
    "COMPLETED",
    { completedBy: by, completedAt: Date.now() },
  );
  const notes: string[] = [];
  for (const item of items) {
    notes.push(
      ...(await relocateTrackedStock({
        productCode: item.productCode,
        warehouseId: grn.warehouseId,
        quantity: item.quantity,
        toLocationId: item.destinationLocationId,
        batchNumber: item.batchNumber,
        serialNumbers: item.serialNumbers,
      })),
    );
  }
  await logRecordAudit(
    WAREHOUSE_PATHS.putaways,
    id,
    "Putaway completed",
    by,
    [putawayNumber, ...notes].join(" "),
  );
  await notifyAdminFeed(
    "Putaway Completed",
    `${putawayNumber} completed — stock assigned to bin location(s).`,
    "inventory",
  );
  return id;
}

// ---------------------------------------------------------------------------
// Inventory operations (mirror ScmTransfers / ScmAdjustments / ScmWarehouseMovements)
// ---------------------------------------------------------------------------

async function requestTransfer(
  ctx: Ctx,
  key: ProductKey,
  from: WarehouseKey,
  to: WarehouseKey,
  qty: number,
  notes: string,
): Promise<StockTransfer> {
  const by = PERSONA.inventory;
  const p = product(key);
  const transferNumber = await reserveDocumentNumber("stockTransfer");
  const id = await createRecord(INVENTORY_PATHS.transfers, {
    transferNumber,
    productCode: p.code,
    productName: p.name,
    sourceWarehouseId: ctx.warehouseId[from],
    destinationWarehouseId: ctx.warehouseId[to],
    quantity: qty,
    status: "REQUESTED" as TransferStatus,
    requestedBy: by,
    notes,
  });
  if (!id) throw new Error("Seed: failed to create transfer");
  await logRecordAudit(
    INVENTORY_PATHS.transfers,
    id,
    "Transfer requested",
    by,
    `${transferNumber}: ${qty} × ${p.code}`,
  );
  return fresh<StockTransfer>(INVENTORY_PATHS.transfers, id);
}

async function approveTransfer(t: StockTransfer): Promise<void> {
  const by = PERSONA.approver;
  await transitionStatus<TransferStatus>(
    INVENTORY_PATHS.transfers,
    t.id,
    ["REQUESTED"],
    "APPROVED",
    { approvedBy: by, approvedAt: Date.now() },
  );
  await logRecordAudit(
    INVENTORY_PATHS.transfers,
    t.id,
    "Transfer approved",
    by,
    t.transferNumber,
  );
}

async function dispatchTransfer(t: StockTransfer): Promise<void> {
  const by = PERSONA.warehouse;
  await transitionWithSideEffect<TransferStatus>(
    INVENTORY_PATHS.transfers,
    t.id,
    ["APPROVED"],
    "IN_TRANSIT",
    async () => {
      await postOnce("TRANSFER_OUT", t.id, () =>
        postLedgerEntry({
          productCode: t.productCode,
          productName: t.productName,
          warehouseId: t.sourceWarehouseId,
          transactionType: "TRANSFER_OUT",
          referenceType: "TRANSFER",
          referenceId: t.id,
          referenceNumber: t.transferNumber,
          quantityOut: t.quantity,
          createdBy: by,
        }),
      );
    },
    { dispatchedBy: by, dispatchedAt: Date.now() },
  );
  await logRecordAudit(
    INVENTORY_PATHS.transfers,
    t.id,
    "Transfer dispatched",
    by,
    `${t.transferNumber}: TRANSFER_OUT posted`,
  );
}

async function receiveTransfer(t: StockTransfer): Promise<void> {
  const by = PERSONA.warehouse;
  await transitionWithSideEffect<TransferStatus>(
    INVENTORY_PATHS.transfers,
    t.id,
    ["IN_TRANSIT"],
    "RECEIVED",
    async () => {
      await postOnce("TRANSFER_IN", t.id, () =>
        postLedgerEntry({
          productCode: t.productCode,
          productName: t.productName,
          warehouseId: t.destinationWarehouseId,
          transactionType: "TRANSFER_IN",
          referenceType: "TRANSFER",
          referenceId: t.id,
          referenceNumber: t.transferNumber,
          quantityIn: t.quantity,
          createdBy: by,
        }),
      );
    },
    { receivedBy: by, receivedAt: Date.now() },
  );
  await logRecordAudit(
    INVENTORY_PATHS.transfers,
    t.id,
    "Transfer received",
    by,
    `${t.transferNumber}: TRANSFER_IN posted`,
  );
}

async function requestAdjustment(
  ctx: Ctx,
  key: ProductKey,
  wh: WarehouseKey,
  direction: "IN" | "OUT",
  qty: number,
  reason: StockAdjustment["reason"],
  notes: string,
): Promise<StockAdjustment> {
  const by = PERSONA.inventory;
  const p = product(key);
  const adjustmentNumber = await reserveDocumentNumber("stockAdjustment");
  const id = await createRecord(INVENTORY_PATHS.adjustments, {
    adjustmentNumber,
    productCode: p.code,
    productName: p.name,
    warehouseId: ctx.warehouseId[wh],
    quantity: qty,
    direction,
    reason,
    notes,
    status: "PENDING" as AdjustmentStatus,
    requestedBy: by,
  });
  if (!id) throw new Error("Seed: failed to create adjustment");
  await logRecordAudit(
    INVENTORY_PATHS.adjustments,
    id,
    "Adjustment requested",
    by,
    `${adjustmentNumber}: ${direction} ${qty} × ${p.code} (${reason})`,
  );
  return fresh<StockAdjustment>(INVENTORY_PATHS.adjustments, id);
}

async function approveAdjustment(a: StockAdjustment): Promise<void> {
  const by = PERSONA.approver;
  await transitionWithSideEffect<AdjustmentStatus>(
    INVENTORY_PATHS.adjustments,
    a.id,
    ["PENDING"],
    "APPROVED",
    async () => {
      await postOnce("ADJUSTMENT", a.id, () =>
        postLedgerEntry({
          productCode: a.productCode,
          productName: a.productName,
          warehouseId: a.warehouseId,
          transactionType:
            a.direction === "IN" ? "ADJUSTMENT_IN" : "ADJUSTMENT_OUT",
          referenceType: "ADJUSTMENT",
          referenceId: a.id,
          referenceNumber: a.adjustmentNumber,
          quantityIn: a.direction === "IN" ? a.quantity : undefined,
          quantityOut: a.direction === "OUT" ? a.quantity : undefined,
          notes: a.reason,
          createdBy: by,
        }),
      );
    },
    { approvedBy: by, approvedAt: Date.now() },
  );
  await logRecordAudit(
    INVENTORY_PATHS.adjustments,
    a.id,
    "Adjustment approved",
    by,
    `${a.adjustmentNumber}: ledger entry posted`,
  );
}

async function binToBinMovement(
  ctx: Ctx,
  key: ProductKey,
  wh: WarehouseKey,
  fromBin: string,
  toBin: string,
  qty: number,
  notes: string,
): Promise<void> {
  const p = product(key);
  const movementNumber = await reserveDocumentNumber("warehouseMovement");
  const id = await createRecord(WAREHOUSE_PATHS.movements, {
    movementNumber,
    movementType: "BIN_TO_BIN",
    warehouseId: ctx.warehouseId[wh],
    sourceLocationId: fromBin,
    destinationLocationId: toBin,
    items: [{ productCode: p.code, productName: p.name, quantity: qty }],
    status: "REQUESTED" as WarehouseMovementStatus,
    requestedBy: PERSONA.warehouse,
    createdAt: Date.now(),
    notes,
  });
  if (!id) throw new Error("Seed: failed to create movement");
  await logRecordAudit(
    WAREHOUSE_PATHS.movements,
    id,
    "Movement requested",
    PERSONA.warehouse,
    `${movementNumber}: ${qty} × ${p.code}`,
  );
  await transitionStatus<WarehouseMovementStatus>(
    WAREHOUSE_PATHS.movements,
    id,
    ["REQUESTED"],
    "APPROVED",
    { approvedBy: PERSONA.approver },
  );
  await logRecordAudit(
    WAREHOUSE_PATHS.movements,
    id,
    "Movement approved",
    PERSONA.approver,
    movementNumber,
  );
  await transitionStatus<WarehouseMovementStatus>(
    WAREHOUSE_PATHS.movements,
    id,
    ["APPROVED", "IN_PROGRESS"],
    "COMPLETED",
    { completedBy: PERSONA.warehouse, completedAt: Date.now() },
  );
  await logRecordAudit(
    WAREHOUSE_PATHS.movements,
    id,
    "Movement completed",
    PERSONA.warehouse,
    movementNumber,
  );
}

// ---------------------------------------------------------------------------
// Sales orders, fulfillment, logistics
// ---------------------------------------------------------------------------

async function createSalesOrder(
  ctx: Ctx,
  customer: CustomerKey,
  lines: Line[],
  opts: { requiredInDays: number; customerPo: string; deliveryMode?: string },
): Promise<OrderAcknowledgement> {
  const c = CUSTOMERS[customer];
  const address = `${c.street}, ${c.city}, ${c.state} - ${c.pincode}`;
  const lineItems = lines.map((l, i) => {
    const p = product(l.p);
    return {
      sNo: i + 1,
      itemCode: p.code,
      itemDescription: p.name,
      uom: p.uom,
      salesQty: l.qty,
      rate: p.sellPrice,
      amount: l.qty * p.sellPrice,
      requiredDate: ctx.clock.inDays(opts.requiredInDays),
    };
  });
  const grandTotal = lineItems.reduce((s, li) => s + li.amount, 0);
  ctx.soSeq += 1;
  const soNumber = `SO-26-${String(70100 + ctx.soSeq)}`;
  const id = await createRecord(SCM_CROSS_MODULE_PATHS.salesOrders, {
    soNumber,
    soDate: ctx.clock.today(),
    customerId: ctx.customerId[customer],
    customerCode: c.code,
    customerName: c.companyName,
    shipToAddress: address,
    billToAddress: address,
    customerPONo: opts.customerPo,
    customerPODate: ctx.clock.inDays(-1),
    gstNoBillTo: c.gst,
    gstNoShipTo: c.gst,
    deliveryTerms: "Door delivery",
    paymentTerms: "Net 30",
    deliveryMode: opts.deliveryMode || "Road",
    lineItems,
    total: grandTotal,
    grandTotal,
    status: "Approved",
    approvalStatus: "Approved",
    preparedBy: PERSONA.sales,
    approvedBy: PERSONA.approver,
    salespersonName: PERSONA.sales,
    invoicedStatus: "Not Invoiced",
    shippedStatus: "Not Shipped",
  });
  if (!id) throw new Error("Seed: failed to create sales order");
  ctx.log(`  Sales order ${soNumber} — ${c.companyName}`);
  return fresh<OrderAcknowledgement>(SCM_CROSS_MODULE_PATHS.salesOrders, id);
}

async function startFulfillment(
  ctx: Ctx,
  so: OrderAcknowledgement,
  wh: WarehouseKey,
): Promise<string> {
  const id = await createFulfillment(
    so.id,
    ctx.warehouseId[wh],
    PERSONA.warehouse,
  );
  await reserveFulfillmentStock(id, PERSONA.warehouse);
  return id;
}

/** Pick list created, started and fully picked (mirrors ScmWarehousePicking). */
async function pickAll(fulfillmentId: string): Promise<WarehousePicking> {
  const by = PERSONA.warehouse;
  const pickId = await createPickForFulfillment(fulfillmentId, by);
  const pick = await fresh<WarehousePicking>(WAREHOUSE_PATHS.pickings, pickId);
  await transitionStatus<PickStatus>(
    WAREHOUSE_PATHS.pickings,
    pickId,
    ["PENDING", "ASSIGNED"],
    "IN_PROGRESS",
    { startedAt: Date.now(), pickerName: by },
  );
  await logRecordAudit(
    WAREHOUSE_PATHS.pickings,
    pickId,
    "Picking started",
    by,
    pick.pickNumber,
  );
  const items = pick.items.map((it) => ({
    ...it,
    pickedQuantity: it.requestedQuantity,
  }));
  await transitionStatus<PickStatus>(
    WAREHOUSE_PATHS.pickings,
    pickId,
    ["IN_PROGRESS", "PARTIALLY_PICKED"],
    "COMPLETED",
    { items, completedAt: Date.now() },
  );
  await logRecordAudit(
    WAREHOUSE_PATHS.pickings,
    pickId,
    "Pick quantities recorded",
    by,
    `${pick.pickNumber}: COMPLETED`,
  );
  await notifyAdminFeed(
    "Picking Completed",
    `${pick.pickNumber} fully picked for ${pick.salesOrderNumber}. Ready for packing.`,
    "inventory",
  );
  await syncFulfillmentProgress(fulfillmentId);
  return fresh<WarehousePicking>(WAREHOUSE_PATHS.pickings, pickId);
}

/** One package per product line (mirrors ScmWarehousePacking's create → PACKED). */
async function packAll(pick: WarehousePicking): Promise<string> {
  const by = PERSONA.warehouse;
  const packNumber = await reserveDocumentNumber("pack");
  const packages = pick.items
    .filter((it) => it.pickedQuantity > 0)
    .map((it, i) => {
      const key = PRODUCT_KEY_BY_CODE.get(it.productCode);
      const weight =
        Math.round(it.pickedQuantity * (key ? UNIT_WEIGHT_KG[key] : 1) * 10) /
        10;
      const bulky = weight > 60;
      return {
        packageNumber: `PKG-${i + 1}`,
        packageType: key === "cable" ? "Drum" : bulky ? "Pallet" : "Carton",
        weight,
        length: bulky ? 120 : 60,
        width: bulky ? 100 : 40,
        height: bulky ? 90 : 40,
        items: [
          {
            productCode: it.productCode,
            productName: it.productName,
            quantity: it.pickedQuantity,
          },
        ],
      };
    });
  const id = await createRecord(WAREHOUSE_PATHS.packings, {
    packNumber,
    pickId: pick.id,
    pickNumber: pick.pickNumber,
    salesOrderId: pick.salesOrderId,
    salesOrderNumber: pick.salesOrderNumber,
    fulfillmentId: pick.fulfillmentId,
    warehouseId: pick.warehouseId,
    packages,
    status: "PACKED" as PackStatus,
    packerName: by,
    createdBy: by,
    createdAt: Date.now(),
    completedAt: Date.now(),
  } satisfies Omit<WarehousePacking, "id">);
  if (!id) throw new Error("Seed: failed to create packing");
  await logRecordAudit(
    WAREHOUSE_PATHS.packings,
    id,
    "Packing created",
    by,
    `${packNumber} for ${pick.pickNumber}`,
  );
  await notifyAdminFeed(
    "Packing Completed",
    `${packNumber} packed for ${pick.salesOrderNumber} — ${packages.length} package(s).`,
    "inventory",
  );
  if (pick.fulfillmentId)
    await linkPackingToFulfillment(pick.fulfillmentId, id, true, by);
  return id;
}

/** Pick → pack → SALES_ISSUE → shipment at READY_TO_SHIP. Returns the shipment id. */
async function pickPackIssueAndCreateShipment(
  fulfillmentId: string,
  so: OrderAcknowledgement,
): Promise<string> {
  const pick = await pickAll(fulfillmentId);
  const packId = await packAll(pick);
  await finalizeFulfillment(fulfillmentId, PERSONA.warehouse);
  const f = await fresh<OrderFulfillment>(
    ORDER_PATHS.fulfillments,
    fulfillmentId,
  );
  return createShipment(
    { ...f, stockIssueLedgerEntryIds: f.stockIssueLedgerEntryIds || [] },
    so,
    [packId],
    PERSONA.logistics,
  );
}

async function dispatchWithCarrier(
  ctx: Ctx,
  shipmentId: string,
  carrierCode: string,
  service: ShipmentServiceType,
  deliverInDays: number,
  trackingNumber: string,
): Promise<void> {
  const by = PERSONA.logistics;
  const carrier = ctx.carrierByCode.get(carrierCode);
  if (!carrier) throw new Error(`Seed: carrier ${carrierCode} missing`);
  await assignCarrier(
    await fresh<ScmShipment>(LOGISTICS_PATHS.shipments, shipmentId),
    {
      carrier,
      serviceType: service,
      expectedDeliveryDate: ctx.clock.inDays(deliverInDays),
    },
    by,
  );
  await createShipmentLabel(
    await fresh<ScmShipment>(LOGISTICS_PATHS.shipments, shipmentId),
    trackingNumber,
    carrier,
    by,
  );
  await dispatchShipment(
    await fresh<ScmShipment>(LOGISTICS_PATHS.shipments, shipmentId),
    by,
  );
}

async function moveShipment(
  shipmentId: string,
  next: "IN_TRANSIT" | "OUT_FOR_DELIVERY",
  location: string,
  description: string,
): Promise<void> {
  await updateShipmentStatus(
    await fresh<ScmShipment>(LOGISTICS_PATHS.shipments, shipmentId),
    next,
    PERSONA.logistics,
    { location, description },
  );
}

async function deliver(
  shipmentId: string,
  recipientName: string,
  notes = "Delivered in good condition",
): Promise<void> {
  await markShipmentDelivered(
    await fresh<ScmShipment>(LOGISTICS_PATHS.shipments, shipmentId),
    { recipientName, deliveryNotes: notes },
    PERSONA.logistics,
  );
}

async function shipmentNumber(id: string): Promise<string> {
  return (await fresh<ScmShipment>(LOGISTICS_PATHS.shipments, id))
    .shipmentNumber;
}

// ---------------------------------------------------------------------------
// Quality
// ---------------------------------------------------------------------------

function checkpointResults(
  template: ScmQualityTemplate,
  failing: string[] = [],
  defectCode?: string,
): ScmQualityCheckpointResult[] {
  return template.checkpoints.map((c) => ({
    checkpointId: c.checkpointId,
    name: c.name,
    required: c.required,
    result: failing.includes(c.name) ? "FAIL" : "PASS",
    defectCode: failing.includes(c.name) ? defectCode : undefined,
    observedValue: c.expectedValue ? "Within tolerance" : undefined,
  }));
}

async function inspectAndComplete(
  inspectionId: string,
  results: Array<
    Omit<RecordItemResultInput, "checkpointResults"> & { failing?: string[] }
  >,
  template: ScmQualityTemplate,
): Promise<void> {
  const by = PERSONA.quality;
  const insp = await fresh<ScmQualityInspection>(
    QUALITY_PATHS.inspections,
    inspectionId,
  );
  await startInspection(insp, by, by);
  const started = await fresh<ScmQualityInspection>(
    QUALITY_PATHS.inspections,
    inspectionId,
  );
  for (const [idx, item] of (started.items || []).entries()) {
    const r = results[idx];
    const { failing, ...input } = r;
    await recordItemResult(
      inspectionId,
      item.id,
      {
        ...input,
        checkpointResults: checkpointResults(
          template,
          failing,
          input.defectCode,
        ),
      },
      by,
    );
  }
  await completeInspection(inspectionId, by);
}

async function incomingInspection(
  ctx: Ctx,
  grn: GoodsReceipt,
  vendor: VendorKey,
  priority: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL",
  notes: string,
): Promise<string> {
  const template = ctx.templateByCode.get("TPL-INC-GEN");
  const items: CreateInspectionItemInput[] = grn.items
    .map((it, idx) => ({
      productCode: it.productCode,
      productNameSnapshot: it.productName,
      sourceLineId: `${grn.id}:${idx}`,
      batchId: it.batchNumber
        ? batchKey(it.batchNumber, it.productCode, grn.warehouseId)
        : undefined,
      batchNumber: it.batchNumber,
      serialNumbers: it.serialNumbers,
      orderedQuantity: it.orderedQuantity,
      sourceQuantity: it.acceptedQuantity,
      unitCost: it.unitCost,
      warehouseId: grn.warehouseId,
    }))
    .filter((it) => it.sourceQuantity > 0);
  return createInspection(
    {
      inspectionType: "INCOMING",
      sourceType: "GRN",
      sourceId: grn.id,
      sourceNumber: grn.grnNumber,
      templateId: template?.id,
      supplierId: ctx.vendorId[vendor],
      supplierNameSnapshot: VENDORS[vendor].companyName,
      warehouseId: grn.warehouseId,
      warehouseNameSnapshot: WAREHOUSES.chennai.name,
      priority,
      notes,
      items,
    },
    PERSONA.quality,
  );
}

async function quarantineForInspection(
  inspectionId: string,
): Promise<ScmQualityQuarantineRecord> {
  const records = await getRecordsWhere<ScmQualityQuarantineRecord>(
    QUALITY_PATHS.quarantine,
    "inspectionId",
    inspectionId,
  );
  if (records.length === 0)
    throw new Error("Seed: quarantine record not created");
  return records[0];
}

// ---------------------------------------------------------------------------
// The story
// ---------------------------------------------------------------------------

async function playScenario(ctx: Ctx): Promise<void> {
  const { clock, log } = ctx;
  const C = WAREHOUSES.chennai.name;

  // ---- Day -118: go-live — masters and opening stock ------------------------------------------
  await clock.at(118, 9);
  log("Creating warehouses, bin locations, products and stock settings…");
  await seedWarehouses(ctx);
  await seedProducts();
  log("Creating suppliers, customers, carriers, QC defects and templates…");
  await seedVendors(ctx);
  await seedCustomers(ctx);
  await seedLogisticsAndQualityMasters(ctx);
  await clock.at(118, 15);
  log("Posting opening balances…");
  await postOpeningBalance(ctx, "bearing", "chennai", 400);
  await postOpeningBalance(ctx, "bearing", "bengaluru", 150);
  await postOpeningBalance(ctx, "valve", "chennai", 60);
  await postOpeningBalance(ctx, "housing", "chennai", 380);
  await postOpeningBalance(ctx, "gloves", "chennai", 200);
  await postOpeningBalance(ctx, "seal", "chennai", 45);
  await postOpeningBalance(ctx, "pump", "chennai", 3);

  // ---- Procurement cycle 1: copper cable, full PR → RFQ → comparison → PO ----------------------
  log(
    "Procurement cycle 1: copper cable (PR → RFQ → 2 quotations → comparison → PO)…",
  );
  await clock.at(100, 11);
  const pr1 = await createRequisition(ctx, {
    wh: "chennai",
    lines: [{ p: "cable", qty: 2000, estCost: 44 }],
    priority: "High",
    department: "Maintenance",
    purpose: "Rewiring of Line 3 and stock for customer orders",
    requiredInDays: 14,
    by: PERSONA.procurement,
  });
  await submitRequisition(pr1.id, pr1.number, PERSONA.procurement);
  await clock.at(99, 12);
  await approveRequisition(pr1.id, pr1.number, PERSONA.approver);
  await clock.at(98, 10);
  const rfq1 = await createAndIssueRfq(ctx, {
    requisition: pr1,
    vendors: ["southern", "metro"],
    wh: "chennai",
    lines: [{ p: "cable", qty: 2000 }],
    dueInDays: 4,
    paymentTerms: "Net 30",
    deliveryTerms: "Door delivery, Chennai",
    notes: "ISI-marked FRLS cable only",
    by: PERSONA.procurement,
  });
  await clock.at(95, 15);
  const q1 = await recordQuotation(ctx, {
    rfqId: rfq1,
    vendor: "southern",
    supplierRef: "SCW/Q/2605/118",
    lines: [{ p: "cable", qty: 2000, unitPrice: 41.5, deliveryInDays: 8 }],
    freight: 0,
    discount: 0,
    validForDays: 30,
    paymentTerms: "Net 30",
    deliveryTerms: "Free delivery",
    by: PERSONA.procurement,
  });
  await clock.at(94, 11);
  await recordQuotation(ctx, {
    rfqId: rfq1,
    vendor: "metro",
    supplierRef: "MIS-QT-4471",
    lines: [{ p: "cable", qty: 2000, unitPrice: 44, deliveryInDays: 12 }],
    freight: 1500,
    discount: 0,
    validForDays: 21,
    paymentTerms: "Net 30",
    deliveryTerms: "Ex-works + freight",
    by: PERSONA.procurement,
  });
  await clock.at(93, 12);
  const q1Selected = await compareAndSelect(
    rfq1,
    q1,
    "Lowest landed cost and faster delivery; ISI certificate verified.",
    PERSONA.approver,
  );
  const po1 = await createPo(ctx, {
    vendor: "southern",
    wh: "chennai",
    quotation: q1Selected,
    expectedInDays: 7,
    paymentTerms: "Net 30",
    by: PERSONA.procurement,
  });
  await clock.at(92, 10);
  await approveAndSendPo(po1, "southern");

  // ---- Sales order 1 ---------------------------------------------------------------------------
  log("Sales cycle: orders → reserve → pick → pack → issue → ship → deliver…");
  await clock.at(91, 11);
  const so1 = await createSalesOrder(
    ctx,
    "balaji",
    [
      { p: "bearing", qty: 120 },
      { p: "valve", qty: 8 },
    ],
    { requiredInDays: 7, customerPo: "SBE/PO/26-27/0412" },
  );
  const f1 = await startFulfillment(ctx, so1, "chennai");
  await clock.at(90, 14);
  const sh1 = await pickPackIssueAndCreateShipment(f1, so1);
  await clock.at(89, 11);
  await dispatchWithCarrier(
    ctx,
    sh1,
    "DELHIVERY",
    "STANDARD",
    3,
    "DLV5540021873",
  );
  await clock.at(88, 9);
  await moveShipment(
    sh1,
    "IN_TRANSIT",
    "Chennai Hub",
    "Arrived at Chennai sort centre",
  );
  await clock.at(87, 9);
  await moveShipment(
    sh1,
    "OUT_FOR_DELIVERY",
    "Guindy, Chennai",
    "Out for delivery",
  );
  await clock.at(87, 15);
  await deliver(sh1, "Venkatesh Rao");

  // ---- Cable receipt, incoming QC fails partially → quarantine → write-off ----------------------
  await clock.at(86, 11);
  log("Receiving cable (GRN), incoming QC with partial failure, quarantine…");
  const grn1 = await receiveGrn(
    ctx,
    po1.id,
    [{ index: 0, receive: 2000, reject: 50, batch: "SCW-2605-A" }],
    "50 m rejected at dock — drum outer layer crushed.",
  );
  await clock.at(85, 10);
  const qc1 = await incomingInspection(
    ctx,
    grn1,
    "southern",
    "HIGH",
    "Random sampling of 3 drums per lot",
  );
  const incTemplate = ctx.templateByCode.get(
    "TPL-INC-GEN",
  ) as ScmQualityTemplate;
  await inspectAndComplete(
    qc1,
    [
      {
        inspectedQuantity: 1950,
        acceptedQuantity: 1800,
        rejectedQuantity: 150,
        condition: "DEFECTIVE",
        defectCode: "INS-CRACK",
        defectDescription: "Insulation cracks on one 150 m coil",
        disposition: "QUARANTINE",
        notes:
          "Coil #3 shows insulation cracking at 12 points. Held for supplier review.",
        failing: ["Visual inspection"],
      },
    ],
    incTemplate,
  );
  await clock.at(84, 10);
  await putaway(
    grn1,
    [
      {
        productCode: PRODUCTS.cable.code,
        qty: 1800,
        binId: bin(ctx, "chennai", "Z02-R01-S01-B01"),
      },
    ],
    true,
  );
  await clock.at(82, 12);
  const qr1 = await quarantineForInspection(qc1);
  await reviewQuarantine(qr1, PERSONA.quality);
  await clock.at(80, 16);
  await rejectQuarantine(
    await fresh<ScmQualityQuarantineRecord>(QUALITY_PATHS.quarantine, qr1.id),
    "Supplier accepted the claim; coil scrapped and debit note raised.",
    PERSONA.quality,
  );
  await closePurchaseOrder(po1.id); // the 50 m rejected at the dock is short-closed, not re-supplied
  await logRecordAudit(
    PROCUREMENT_PATHS.purchaseOrders,
    po1.id,
    "PO short-closed",
    PERSONA.procurement,
    `${po1.poNumber}: 50 m rejected at receipt deducted from invoice`,
  );

  // ---- Sales order 2 + its customer return (full lifecycle) -------------------------------------
  await clock.at(79, 10);
  const so2 = await createSalesOrder(
    ctx,
    "apex",
    [
      { p: "housing", qty: 80 },
      { p: "bearing", qty: 60 },
    ],
    { requiredInDays: 7, customerPo: "AAC/2627/PO/1187" },
  );
  const f2 = await startFulfillment(ctx, so2, "chennai");
  await clock.at(78, 15);
  const sh2 = await pickPackIssueAndCreateShipment(f2, so2);

  // ---- Vendor return to Southern Cables ----------------------------------------------------------
  await clock.at(78, 17);
  log("Vendor return to Southern Cables…");
  const vr1 = await createVendorReturn(
    {
      grnId: grn1.id,
      reasonCode: "QUALITY_ISSUE",
      reasonDescription:
        "Additional 100 m with insulation damage found during put-away",
      items: [{ grnLineIndex: 0, requestedQuantity: 100 }],
      notes: "Replacement requested against PO",
    },
    PERSONA.quality,
  );
  await submitReturn(
    await fresh<ScmReturn>(RETURNS_PATHS.returns, vr1),
    PERSONA.quality,
  );
  await clock.at(77, 11);
  await approveReturn(
    await fresh<ScmReturn>(RETURNS_PATHS.returns, vr1),
    PERSONA.approver,
  );
  await markVendorReturnReadyToShip(
    await fresh<ScmReturn>(RETURNS_PATHS.returns, vr1),
    PERSONA.warehouse,
  );
  await clock.at(77, 16);
  await dispatchWithCarrier(
    ctx,
    sh2,
    "BLUEDART",
    "EXPRESS",
    3,
    "BD80431175520",
  );
  await clock.at(76, 10);
  await shipVendorReturn(
    vr1,
    {
      carrier: "VRL Logistics",
      trackingNumber: "VRL-LR-558120",
      notes: "Return to Hosur plant",
    },
    PERSONA.warehouse,
  );
  await clock.at(76, 14);
  await moveShipment(sh2, "IN_TRANSIT", "Pune Hub", "In transit to Pune");
  await clock.at(74, 10);
  await moveShipment(
    sh2,
    "OUT_FOR_DELIVERY",
    "Bhosari, Pune",
    "Out for delivery",
  );
  await clock.at(74, 16);
  await deliver(sh2, "Neha Deshpande", "Delivered — 1 carton reported crushed");
  await clock.at(73, 11);
  await markVendorReturnReceived(
    await fresh<ScmReturn>(RETURNS_PATHS.returns, vr1),
    PERSONA.procurement,
  );
  await clock.at(72, 11);
  await completeVendorReturn(
    await fresh<ScmReturn>(RETURNS_PATHS.returns, vr1),
    PERSONA.procurement,
  );

  // ---- Procurement cycle 2: bearings, direct PO, received in two lots --------------------------
  log(
    "Procurement cycle 2: bearings (direct PO, two partial receipts, put-away)…",
  );
  await clock.at(71, 10);
  const po2 = await createPo(ctx, {
    vendor: "precision",
    wh: "chennai",
    lines: [{ p: "bearing", qty: 1000, unitPrice: 178 }],
    expectedInDays: 14,
    paymentTerms: "Net 30",
    notes: "Annual rate contract RC-PBI-2026",
    by: PERSONA.procurement,
  });
  await clock.at(70, 11);
  await approveAndSendPo(po2, "precision");

  const shipped2 = await fresh<ScmShipment>(LOGISTICS_PATHS.shipments, sh2);
  await clock.at(70, 15);
  log(
    "Customer return 1: damaged housings (request → approve → receive → inspect → disposition)…",
  );
  const cr1 = await createCustomerReturn(
    {
      fulfillmentId: f2,
      shipmentId: sh2,
      shipmentNumberSnapshot: shipped2.shipmentNumber,
      reasonCode: "DELIVERY_DAMAGE",
      reasonDescription: "One carton crushed in transit — 10 housings returned",
      items: [{ productCode: PRODUCTS.housing.code, requestedQuantity: 10 }],
    },
    PERSONA.sales,
  );
  await submitReturn(
    await fresh<ScmReturn>(RETURNS_PATHS.returns, cr1),
    PERSONA.sales,
  );
  await clock.at(69, 11);
  await approveReturn(
    await fresh<ScmReturn>(RETURNS_PATHS.returns, cr1),
    PERSONA.approver,
  );
  await markCustomerReturnInTransit(
    await fresh<ScmReturn>(RETURNS_PATHS.returns, cr1),
    { carrier: "Blue Dart Express", trackingNumber: "BD80431190044" },
    PERSONA.logistics,
  );

  await clock.at(67, 10);
  const so3 = await createSalesOrder(
    ctx,
    "deccan",
    [
      { p: "pump", qty: 3 },
      { p: "cable", qty: 400 },
    ],
    { requiredInDays: 10, customerPo: "DPM/PUR/7731" },
  );
  const f3 = await startFulfillment(ctx, so3, "chennai");
  await clock.at(66, 11);
  await receiveCustomerReturn(
    cr1,
    { receivedQuantities: {} },
    PERSONA.warehouse,
  );
  await startCustomerReturnInspection(
    await fresh<ScmReturn>(RETURNS_PATHS.returns, cr1),
    PERSONA.quality,
  );
  await clock.at(66, 15);
  const sh3 = await pickPackIssueAndCreateShipment(f3, so3);
  await clock.at(65, 11);
  const cr1Item = (await fresh<ScmReturn>(RETURNS_PATHS.returns, cr1)).items[0];
  await completeCustomerReturnInspection(
    cr1,
    {
      itemResults: {
        [cr1Item.id]: {
          condition: "USED",
          acceptedQuantity: 7,
          rejectedQuantity: 3,
        },
      },
      notes:
        "7 units cosmetically fine after cleaning; 3 have cracked mounting lugs.",
    },
    PERSONA.quality,
  );
  await moveCustomerReturnToDisposition(
    await fresh<ScmReturn>(RETURNS_PATHS.returns, cr1),
    PERSONA.quality,
  );
  await dispatchWithCarrier(ctx, sh3, "VRL", "ECONOMY", 5, "VRL-LR-561907");
  await clock.at(64, 11);
  await setCustomerReturnItemDisposition(
    cr1,
    cr1Item.id,
    "RESTOCK",
    7,
    { notes: "Back to sellable stock" },
    PERSONA.quality,
  );
  await setCustomerReturnItemDisposition(
    cr1,
    cr1Item.id,
    "DAMAGED",
    3,
    { notes: "Cracked lugs — not repairable" },
    PERSONA.quality,
  );
  await completeCustomerReturn(cr1, PERSONA.quality);
  await moveShipment(sh3, "IN_TRANSIT", "Hyderabad Hub", "In transit");
  await clock.at(62, 10);
  await moveShipment(
    sh3,
    "OUT_FOR_DELIVERY",
    "Cherlapally, Hyderabad",
    "Out for delivery",
  );
  await clock.at(62, 16);
  await deliver(sh3, "Srinivas Reddy");

  await clock.at(60, 11);
  const grn2a = await receiveGrn(
    ctx,
    po2.id,
    [{ index: 0, receive: 600 }],
    "Lot 1 of 2 against the rate contract.",
  );
  await clock.at(59, 10);
  await putaway(
    grn2a,
    [
      {
        productCode: PRODUCTS.bearing.code,
        qty: 470,
        binId: bin(ctx, "chennai", "Z01-R01-S01-B01"),
      },
      {
        productCode: PRODUCTS.bearing.code,
        qty: 130,
        binId: bin(ctx, "chennai", "Z01-R01-S01-B02"),
      },
    ],
    true,
  );

  await clock.at(57, 10);
  const so4 = await createSalesOrder(
    ctx,
    "kaveri",
    [
      { p: "bearing", qty: 150 },
      { p: "seal", qty: 10 },
    ],
    { requiredInDays: 7, customerPo: "KAI/ST/2627/219" },
  );
  const f4 = await startFulfillment(ctx, so4, "chennai");
  await clock.at(56, 14);
  const sh4 = await pickPackIssueAndCreateShipment(f4, so4);
  await clock.at(55, 11);
  await dispatchWithCarrier(
    ctx,
    sh4,
    "DELHIVERY",
    "STANDARD",
    3,
    "DLV5540093310",
  );

  // ---- Inter-warehouse transfer ------------------------------------------------------------------
  log("Stock transfer Chennai → Bengaluru, bin-to-bin movement, adjustment…");
  await clock.at(54, 10);
  const t1 = await requestTransfer(
    ctx,
    "bearing",
    "chennai",
    "bengaluru",
    100,
    "Replenish Bengaluru for Sri Balaji orders",
  );
  await approveTransfer(t1);
  await clock.at(53, 12);
  await dispatchTransfer(
    await fresh<StockTransfer>(INVENTORY_PATHS.transfers, t1.id),
  );
  await moveShipment(sh4, "IN_TRANSIT", "Coimbatore Hub", "In transit");
  await clock.at(52, 10);
  await moveShipment(
    sh4,
    "OUT_FOR_DELIVERY",
    "Avinashi Road, Coimbatore",
    "Out for delivery",
  );
  await clock.at(52, 15);
  await deliver(sh4, "Murali Krishnan");
  await clock.at(51, 11);
  await receiveTransfer(
    await fresh<StockTransfer>(INVENTORY_PATHS.transfers, t1.id),
  );

  await clock.at(50, 11);
  const grn2b = await receiveGrn(
    ctx,
    po2.id,
    [{ index: 0, receive: 400 }],
    "Lot 2 of 2 — PO complete.",
  );
  await clock.at(49, 10);
  await putaway(
    grn2b,
    [
      {
        productCode: PRODUCTS.bearing.code,
        qty: 400,
        binId: bin(ctx, "chennai", "Z01-R01-S01-B02"),
      },
    ],
    true,
  );

  await clock.at(48, 10);
  const so5 = await createSalesOrder(
    ctx,
    "balaji",
    [{ p: "bearing", qty: 90 }],
    { requiredInDays: 4, customerPo: "SBE/PO/26-27/0540" },
  );
  const f5 = await startFulfillment(ctx, so5, "bengaluru");
  await clock.at(47, 14);
  const sh5 = await pickPackIssueAndCreateShipment(f5, so5);
  await dispatchWithCarrier(
    ctx,
    sh5,
    "BLUEDART",
    "EXPRESS",
    2,
    "BD80431255871",
  );
  await clock.at(46, 9);
  await moveShipment(sh5, "IN_TRANSIT", "Chennai Hub", "In transit");
  await clock.at(45, 10);
  await moveShipment(
    sh5,
    "OUT_FOR_DELIVERY",
    "Guindy, Chennai",
    "Out for delivery",
  );
  await clock.at(45, 14);
  await deliver(sh5, "Venkatesh Rao");
  await binToBinMovement(
    ctx,
    "bearing",
    "chennai",
    bin(ctx, "chennai", "Z01-R01-S01-B02"),
    bin(ctx, "chennai", "Z01-R01-S02-B03"),
    50,
    "Consolidating overflow bin",
  );

  // ---- Procurement cycle 3: valves + serial-tracked motors -------------------------------------
  log("Procurement cycle 3: valves + serial-tracked motors, incoming QC pass…");
  await clock.at(44, 10);
  const po3 = await createPo(ctx, {
    vendor: "hydrotech",
    wh: "chennai",
    lines: [
      { p: "valve", qty: 40, unitPrice: 2380 },
      { p: "motor", qty: 5, unitPrice: 9650 },
    ],
    freight: 2500,
    expectedInDays: 8,
    paymentTerms: "Net 45",
    by: PERSONA.procurement,
  });
  await clock.at(43, 11);
  await approveAndSendPo(po3, "hydrotech");

  await clock.at(41, 10);
  const so6 = await createSalesOrder(
    ctx,
    "apex",
    [
      { p: "housing", qty: 100 },
      { p: "cable", qty: 300 },
    ],
    { requiredInDays: 6, customerPo: "AAC/2627/PO/1302" },
  );
  const f6 = await startFulfillment(ctx, so6, "chennai");
  await clock.at(40, 11);
  const glovesAdj = await requestAdjustment(
    ctx,
    "gloves",
    "chennai",
    "OUT",
    5,
    "Physical Count Difference",
    "Quarterly cycle count — 5 boxes short",
  );
  await approveAdjustment(glovesAdj);
  await clock.at(40, 15);
  const sh6 = await pickPackIssueAndCreateShipment(f6, so6);
  await clock.at(39, 11);
  await dispatchWithCarrier(ctx, sh6, "VRL", "STANDARD", 4, "VRL-LR-570244");
  await clock.at(38, 9);
  await moveShipment(sh6, "IN_TRANSIT", "Pune Hub", "In transit");
  await clock.at(36, 10);
  await moveShipment(
    sh6,
    "OUT_FOR_DELIVERY",
    "Bhosari, Pune",
    "Out for delivery",
  );
  await clock.at(36, 15);
  await deliver(sh6, "Neha Deshpande");

  await clock.at(35, 11);
  const grn3 = await receiveGrn(
    ctx,
    po3.id,
    [
      { index: 0, receive: 40 },
      {
        index: 1,
        receive: 5,
        serials: [
          "MTR2H-2608-0001",
          "MTR2H-2608-0002",
          "MTR2H-2608-0003",
          "MTR2H-2608-0004",
          "MTR2H-2608-0005",
        ],
      },
    ],
    "Motors received with test certificates.",
  );
  await clock.at(35, 15);
  const qc2 = await incomingInspection(
    ctx,
    grn3,
    "hydrotech",
    "MEDIUM",
    "Motors: insulation resistance and no-load run test",
  );
  await inspectAndComplete(
    qc2,
    [
      {
        inspectedQuantity: 40,
        acceptedQuantity: 40,
        rejectedQuantity: 0,
        condition: "NEW",
        disposition: "ACCEPT",
      },
      {
        inspectedQuantity: 5,
        acceptedQuantity: 5,
        rejectedQuantity: 0,
        condition: "NEW",
        disposition: "ACCEPT",
        notes: "IR > 100 MΩ on all units",
      },
    ],
    incTemplate,
  );
  await clock.at(34, 10);
  await putaway(
    grn3,
    [
      {
        productCode: PRODUCTS.valve.code,
        qty: 40,
        binId: bin(ctx, "chennai", "Z01-R01-S02-B03"),
      },
      {
        productCode: PRODUCTS.motor.code,
        qty: 5,
        binId: bin(ctx, "chennai", "Z01-R01-S02-B04"),
      },
    ],
    true,
  );

  // ---- Procurement cycle 4: castings + seals — supplier is late ---------------------------------
  log("Procurement cycle 4: housings + seal kits from Metro (overdue)…");
  await clock.at(30, 11);
  const po4 = await createPo(ctx, {
    vendor: "metro",
    wh: "chennai",
    lines: [
      { p: "housing", qty: 500, unitPrice: 628 },
      { p: "seal", qty: 200, unitPrice: 92 },
    ],
    freight: 4000,
    expectedInDays: 18,
    paymentTerms: "Net 30",
    notes: "Urgent — housing stock running low",
    by: PERSONA.procurement,
  });
  await clock.at(29, 11);
  await approveAndSendPo(po4, "metro");

  await clock.at(27, 10);
  const so7 = await createSalesOrder(
    ctx,
    "kaveri",
    [
      { p: "bearing", qty: 200 },
      { p: "valve", qty: 5 },
    ],
    { requiredInDays: 5, customerPo: "KAI/ST/2627/288" },
  );
  const f7 = await startFulfillment(ctx, so7, "chennai");
  await clock.at(26, 14);
  const sh7 = await pickPackIssueAndCreateShipment(f7, so7);
  await dispatchWithCarrier(
    ctx,
    sh7,
    "DELHIVERY",
    "STANDARD",
    3,
    "DLV5540160045",
  );
  await clock.at(25, 9);
  await moveShipment(sh7, "IN_TRANSIT", "Coimbatore Hub", "In transit");
  await clock.at(24, 10);
  await moveShipment(
    sh7,
    "OUT_FOR_DELIVERY",
    "Avinashi Road, Coimbatore",
    "Out for delivery",
  );
  await clock.at(24, 16);
  await deliver(sh7, "Murali Krishnan");

  await clock.at(18, 10);
  const so8 = await createSalesOrder(
    ctx,
    "deccan",
    [
      { p: "bearing", qty: 100 },
      { p: "housing", qty: 40 },
    ],
    { requiredInDays: 5, customerPo: "DPM/PUR/7802" },
  );
  const f8 = await startFulfillment(ctx, so8, "chennai");
  await clock.at(17, 14);
  const sh8 = await pickPackIssueAndCreateShipment(f8, so8);
  await dispatchWithCarrier(
    ctx,
    sh8,
    "BLUEDART",
    "EXPRESS",
    2,
    "BD80431366102",
  );
  await clock.at(16, 9);
  await moveShipment(sh8, "IN_TRANSIT", "Hyderabad Hub", "In transit");
  await moveShipment(
    sh8,
    "OUT_FOR_DELIVERY",
    "Cherlapally, Hyderabad",
    "Out for delivery",
  );
  await clock.at(16, 13);
  const exceptionId = await recordDeliveryException(
    await fresh<ScmShipment>(LOGISTICS_PATHS.shipments, sh8),
    "CUSTOMER_UNAVAILABLE" as DeliveryExceptionCode,
    "Receiving dock closed — stock-taking in progress",
    PERSONA.logistics,
  );
  await clock.at(15, 10);
  await resolveDeliveryException(
    await fresh<ShipmentException>(LOGISTICS_PATHS.exceptions, exceptionId),
    "Customer confirmed next-day delivery slot 10:00–12:00",
    PERSONA.logistics,
  );
  await moveShipment(
    sh8,
    "OUT_FOR_DELIVERY",
    "Cherlapally, Hyderabad",
    "Re-attempt: out for delivery",
  );
  await clock.at(15, 12);
  await deliver(sh8, "Srinivas Reddy", "Delivered on second attempt");

  await clock.at(14, 10);
  const so9 = await createSalesOrder(
    ctx,
    "balaji",
    [
      { p: "bearing", qty: 150 },
      { p: "cable", qty: 200 },
    ],
    { requiredInDays: 5, customerPo: "SBE/PO/26-27/0655" },
  );
  const f9 = await startFulfillment(ctx, so9, "chennai");
  await clock.at(13, 14);
  const sh9 = await pickPackIssueAndCreateShipment(f9, so9);
  await dispatchWithCarrier(
    ctx,
    sh9,
    "DELHIVERY",
    "STANDARD",
    2,
    "DLV5540201198",
  );

  // ---- Inventory quality audit puts housings on hold ------------------------------------------
  log("Inventory QC audit puts 25 housings on hold (quarantine)…");
  await clock.at(12, 11);
  const invTemplate = ctx.templateByCode.get(
    "TPL-INV-AUD",
  ) as ScmQualityTemplate;
  const qc4 = await createInspection(
    {
      inspectionType: "INVENTORY",
      sourceType: "INVENTORY",
      sourceId: `${PRODUCTS.housing.code}__${ctx.warehouseId.chennai}`,
      sourceNumber: PRODUCTS.housing.code,
      templateId: invTemplate.id,
      warehouseId: ctx.warehouseId.chennai,
      warehouseNameSnapshot: C,
      priority: "HIGH",
      notes: "Customer complaint on porosity — audit of opening-stock lot",
      items: [
        {
          productCode: PRODUCTS.housing.code,
          productNameSnapshot: PRODUCTS.housing.name,
          sourceQuantity: 25,
          warehouseId: ctx.warehouseId.chennai,
          unitCost: PRODUCTS.housing.costPrice,
        },
      ],
    },
    PERSONA.quality,
  );
  await inspectAndComplete(
    qc4,
    [
      {
        inspectedQuantity: 25,
        acceptedQuantity: 0,
        rejectedQuantity: 0,
        manualHold: true,
        condition: "UNKNOWN",
        defectCode: "SURF-POR",
        defectDescription:
          "Suspected sub-surface porosity — awaiting X-ray report",
        disposition: "QUARANTINE",
        notes: "Held pending X-ray from the foundry lab.",
        failing: ["Surface porosity check"],
      },
    ],
    invTemplate,
  );
  await moveShipment(sh9, "IN_TRANSIT", "Chennai Hub", "In transit");
  await clock.at(12, 15);
  const po6 = await createPo(ctx, {
    vendor: "southern",
    wh: "chennai",
    lines: [{ p: "cable", qty: 1000, unitPrice: 41.5 }],
    expectedInDays: 8,
    paymentTerms: "Net 30",
    notes: "Replenishment at last quoted rate",
    by: PERSONA.procurement,
  });
  await approveAndSendPo(po6, "southern");
  await clock.at(11, 10);
  await moveShipment(
    sh9,
    "OUT_FOR_DELIVERY",
    "Guindy, Chennai",
    "Out for delivery",
  );
  await clock.at(11, 14);
  await deliver(sh9, "Venkatesh Rao");

  // ---- Work in flight — the live-demo starting points -------------------------------------------
  log(
    "Creating in-flight work for the live demo (pending approvals, open RFQ, backorder, etc.)…",
  );
  await clock.at(9, 10);
  const pr3 = await createRequisition(ctx, {
    wh: "chennai",
    lines: [
      { p: "seal", qty: 300 },
      { p: "gloves", qty: 20 },
    ],
    priority: "Normal",
    department: "Stores",
    purpose: "Monthly consumables top-up",
    requiredInDays: 10,
    by: PERSONA.inventory,
  });
  await submitRequisition(pr3.id, pr3.number, PERSONA.inventory);
  const cr2 = await createCustomerReturn(
    {
      fulfillmentId: f7,
      shipmentId: sh7,
      shipmentNumberSnapshot: await shipmentNumber(sh7),
      reasonCode: "DEFECTIVE",
      reasonDescription:
        "20 bearings noisy on spin test at customer incoming inspection",
      items: [{ productCode: PRODUCTS.bearing.code, requestedQuantity: 20 }],
    },
    PERSONA.sales,
  );
  await submitReturn(
    await fresh<ScmReturn>(RETURNS_PATHS.returns, cr2),
    PERSONA.sales,
  );

  await clock.at(8, 10);
  const so10 = await createSalesOrder(
    ctx,
    "apex",
    [
      { p: "housing", qty: 60 },
      { p: "valve", qty: 6 },
    ],
    { requiredInDays: 4, customerPo: "AAC/2627/PO/1415" },
  );
  const f10 = await startFulfillment(ctx, so10, "chennai");
  await approveReturn(
    await fresh<ScmReturn>(RETURNS_PATHS.returns, cr2),
    PERSONA.approver,
  );
  await markCustomerReturnInTransit(
    await fresh<ScmReturn>(RETURNS_PATHS.returns, cr2),
    { carrier: "Delhivery", trackingNumber: "DLV5540288731" },
    PERSONA.logistics,
  );
  const pr4 = await createRequisition(ctx, {
    wh: "chennai",
    lines: [{ p: "bearing", qty: 1500, estCost: 180 }],
    priority: "High",
    department: "Stores",
    purpose: "Q3 bearing demand — rate contract renewal",
    requiredInDays: 12,
    by: PERSONA.procurement,
  });
  await submitRequisition(pr4.id, pr4.number, PERSONA.procurement);
  await clock.at(7, 11);
  await approveRequisition(pr4.id, pr4.number, PERSONA.approver);
  const sh10 = await pickPackIssueAndCreateShipment(f10, so10);
  await clock.at(7, 15);
  const rfq3 = await createAndIssueRfq(ctx, {
    requisition: pr4,
    vendors: ["precision", "metro"],
    wh: "chennai",
    lines: [{ p: "bearing", qty: 1500 }],
    dueInDays: 4,
    paymentTerms: "Net 30",
    deliveryTerms: "Door delivery, Chennai",
    notes: "Quote for 12-month rate contract",
    by: PERSONA.procurement,
  });

  await clock.at(6, 10);
  await dispatchWithCarrier(ctx, sh10, "VRL", "STANDARD", 3, "VRL-LR-588410");
  await clock.at(6, 12);
  await receiveCustomerReturn(
    cr2,
    { receivedQuantities: {} },
    PERSONA.warehouse,
  );
  await startCustomerReturnInspection(
    await fresh<ScmReturn>(RETURNS_PATHS.returns, cr2),
    PERSONA.quality,
  );
  const cr2Ret = await fresh<ScmReturn>(RETURNS_PATHS.returns, cr2);
  const retTemplate = ctx.templateByCode.get(
    "TPL-RET-CUS",
  ) as ScmQualityTemplate;
  await createInspection(
    {
      inspectionType: "CUSTOMER_RETURN",
      sourceType: "RETURN",
      sourceId: cr2,
      sourceNumber: cr2Ret.returnNumber,
      templateId: retTemplate.id,
      customerId: cr2Ret.customerId,
      customerNameSnapshot: cr2Ret.customerNameSnapshot,
      warehouseId: cr2Ret.warehouseId,
      warehouseNameSnapshot: C,
      priority: "HIGH",
      notes: "Spin-test every returned bearing",
      items: cr2Ret.items.map((it) => ({
        productCode: it.productCode,
        productNameSnapshot: it.productNameSnapshot,
        sourceLineId: it.id,
        sourceQuantity: it.receivedReturnQuantity ?? it.requestedQuantity,
        warehouseId: it.warehouseId,
        unitCost: it.unitCost,
      })),
    },
    PERSONA.quality,
  );
  await clock.at(6, 15);
  const po5 = await createPo(ctx, {
    vendor: "hydrotech",
    wh: "chennai",
    lines: [
      { p: "valve", qty: 20, unitPrice: 2380 },
      { p: "seal", qty: 100, unitPrice: 90 },
    ],
    expectedInDays: 7,
    paymentTerms: "Net 45",
    by: PERSONA.procurement,
  });
  void po5; // left at PENDING_APPROVAL for the live demo
  const cr3 = await createCustomerReturn(
    {
      fulfillmentId: f9,
      shipmentId: sh9,
      shipmentNumberSnapshot: await shipmentNumber(sh9),
      reasonCode: "WRONG_QUANTITY",
      reasonDescription: "Customer ordered 175 m; 25 m excess delivered",
      items: [{ productCode: PRODUCTS.cable.code, requestedQuantity: 25 }],
    },
    PERSONA.sales,
  );
  await submitReturn(
    await fresh<ScmReturn>(RETURNS_PATHS.returns, cr3),
    PERSONA.sales,
  );
  await moveShipment(
    sh10,
    "IN_TRANSIT",
    "Pune Hub",
    "In transit — line-haul delayed by weather",
  );

  await clock.at(5, 10);
  const so11 = await createSalesOrder(
    ctx,
    "kaveri",
    [{ p: "bearing", qty: 80 }],
    { requiredInDays: 3, customerPo: "KAI/ST/2627/341" },
  );
  const f11 = await startFulfillment(ctx, so11, "chennai");
  await clock.at(5, 15);
  await pickPackIssueAndCreateShipment(f11, so11); // shipment waits at READY_TO_SHIP for a carrier

  await clock.at(4, 10);
  const grn4 = await receiveGrn(
    ctx,
    po6.id,
    [{ index: 0, receive: 1000, batch: "SCW-2609-B" }],
    "Replacement lot — inspect before put-away.",
  );
  await incomingInspection(
    ctx,
    grn4,
    "southern",
    "HIGH",
    "Tightened inspection after the INS-CRACK finding on SCW-2605-A",
  );
  await recordQuotation(ctx, {
    rfqId: rfq3,
    vendor: "precision",
    supplierRef: "PBI/RC/26-27/044",
    lines: [{ p: "bearing", qty: 1500, unitPrice: 176, deliveryInDays: 10 }],
    freight: 0,
    discount: 3000,
    validForDays: 30,
    paymentTerms: "Net 30",
    deliveryTerms: "Free delivery, staggered monthly",
    notes: "Rate held for 12 months",
    by: PERSONA.procurement,
  });
  const so12 = await createSalesOrder(
    ctx,
    "deccan",
    [
      { p: "housing", qty: 30 },
      { p: "seal", qty: 5 },
    ],
    { requiredInDays: 3, customerPo: "DPM/PUR/7866" },
  );
  const f12 = await startFulfillment(ctx, so12, "chennai");

  await clock.at(3, 10);
  await recordQuotation(ctx, {
    rfqId: rfq3,
    vendor: "metro",
    supplierRef: "MIS-QT-4610",
    lines: [{ p: "bearing", qty: 1500, unitPrice: 171, deliveryInDays: 16 }],
    freight: 6000,
    discount: 0,
    validForDays: 15,
    paymentTerms: "Net 30",
    deliveryTerms: "Ex-works + freight",
    by: PERSONA.procurement,
  });
  await putaway(
    grn4,
    [
      {
        productCode: PRODUCTS.cable.code,
        qty: 1000,
        binId: bin(ctx, "chennai", "Z02-R01-S01-B01"),
      },
    ],
    false,
  );
  await createPickForFulfillment(f12, PERSONA.warehouse); // pick list left PENDING
  const so13 = await createSalesOrder(ctx, "deccan", [{ p: "pump", qty: 6 }], {
    requiredInDays: 10,
    customerPo: "DPM/PUR/7870",
  });
  const f13 = await createFulfillment(
    so13.id,
    ctx.warehouseId.chennai,
    PERSONA.warehouse,
  ); // pumps are out of stock → backorder
  await createShortageRequisition(f13, PERSONA.warehouse);

  await clock.at(2, 10);
  await createSalesOrder(
    ctx,
    "balaji",
    [
      { p: "bearing", qty: 120 },
      { p: "seal", qty: 8 },
    ],
    { requiredInDays: 5, customerPo: "SBE/PO/26-27/0701" },
  );
  await requestTransfer(
    ctx,
    "housing",
    "chennai",
    "bengaluru",
    40,
    "Stock Bengaluru for Apex Pune orders",
  );
  await requestAdjustment(
    ctx,
    "seal",
    "chennai",
    "IN",
    3,
    "Found Stock",
    "Found 3 kits in the maintenance crib during audit",
  );
  const vr2 = await createVendorReturn(
    {
      grnId: grn2a.id,
      reasonCode: "DEFECTIVE",
      reasonDescription: "Bearings with rough rotation traced to lot 1",
      items: [{ grnLineIndex: 0, requestedQuantity: 30 }],
    },
    PERSONA.quality,
  );
  await submitReturn(
    await fresh<ScmReturn>(RETURNS_PATHS.returns, vr2),
    PERSONA.quality,
  );
}

// ---------------------------------------------------------------------------
// Registry, time remap, cleanup
// ---------------------------------------------------------------------------

/** Every collection the seed writes to. */
const SEEDED_COLLECTIONS: string[] = [
  ...Object.values(INVENTORY_PATHS),
  ...Object.values(PROCUREMENT_PATHS),
  ...Object.values(WAREHOUSE_PATHS),
  ...Object.values(ORDER_PATHS),
  ...Object.values(LOGISTICS_PATHS),
  RETURNS_PATHS.returns,
  RETURNS_PATHS.inspections,
  RETURNS_PATHS.dispositions,
  ...Object.values(QUALITY_PATHS),
  SCM_CROSS_MODULE_PATHS.salesOrders,
  SCM_CROSS_MODULE_PATHS.products,
  SCM_CROSS_MODULE_PATHS.vendors,
  "sales/customers",
  "notifications/adminFeed",
];

const DEMO_PRODUCT_CODES = new Set(Object.values(PRODUCTS).map((p) => p.code));
const DEMO_BY_CODE_COLLECTIONS = new Set<string>([
  INVENTORY_PATHS.balances,
  INVENTORY_PATHS.settings,
  INVENTORY_PATHS.batches,
  INVENTORY_PATHS.serials,
]);

/** Date-string fields the services fill with "today"; re-derived from the matching timestamp. */
const DATE_FIELD_SOURCE: Record<string, string> = {
  shipmentDate: "dispatchedAt",
  actualDeliveryDate: "deliveredAt",
  requestDate: "createdAt",
};

function isSeeded(
  path: string,
  rec: Record<string, unknown>,
  clock: SimClock,
): boolean {
  if (DEMO_BY_CODE_COLLECTIONS.has(path))
    return DEMO_PRODUCT_CODES.has(String(rec.productCode));
  if (path === INVENTORY_PATHS.postingClaims) return clock.inWindow(rec.at);
  return clock.inWindow(rec.createdAt);
}

function collectTimestampUpdates(
  value: unknown,
  pathPrefix: string,
  clock: SimClock,
  out: Record<string, unknown>,
): void {
  if (clock.inWindow(value)) {
    out[pathPrefix] = clock.map(value);
    return;
  }
  if (value && typeof value === "object") {
    for (const [k, v] of Object.entries(value as Record<string, unknown>))
      collectTimestampUpdates(v, `${pathPrefix}/${k}`, clock, out);
  }
}

async function commitInChunks(
  updates: Record<string, unknown>,
  chunkSize = 400,
): Promise<void> {
  const entries = Object.entries(updates);
  for (let i = 0; i < entries.length; i += chunkSize) {
    await update(
      ref(database),
      Object.fromEntries(entries.slice(i, i + chunkSize)),
    );
  }
}

async function buildRegistryAndRemap(
  clock: SimClock,
  log: SeedLogger,
): Promise<string[]> {
  const registry: string[] = [];
  const updates: Record<string, unknown> = {};
  const seededIds = new Set<string>();

  for (const path of SEEDED_COLLECTIONS) {
    const snap = await get(ref(database, path));
    const records = (snap.val() || {}) as Record<
      string,
      Record<string, unknown> | number
    >;
    for (const [id, raw] of Object.entries(records)) {
      if (!raw || typeof raw !== "object") continue;
      if (!isSeeded(path, raw, clock)) continue;
      registry.push(`${path}/${id}`);
      seededIds.add(id);
      collectTimestampUpdates(raw, `${path}/${id}`, clock, updates);
      for (const [field, source] of Object.entries(DATE_FIELD_SOURCE)) {
        const ts = raw[source];
        if (raw[field] === clock.todayKey && clock.inWindow(ts))
          updates[`${path}/${id}/${field}`] = toLocalDateKey(
            new Date(clock.map(ts)),
          );
      }
    }
  }

  // Keys that aren't records with timestamps: return-quantity holds and supplier-code claims.
  const holds = await get(ref(database, RETURNS_PATHS.quantityReservations));
  for (const scopeKey of Object.keys(
    (holds.val() || {}) as Record<string, unknown>,
  )) {
    if ([...seededIds].some((id) => scopeKey.includes(id)))
      registry.push(`${RETURNS_PATHS.quantityReservations}/${scopeKey}`);
  }
  for (const v of Object.values(VENDORS))
    registry.push(
      `meta/supplierCodeClaims/${firebaseKey(v.code.toUpperCase())}`,
    );

  log(
    `Back-dating ${Object.keys(updates).length} timestamps onto the demo timeline…`,
  );
  await commitInChunks(updates);
  return registry;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function getDemoSeedStatus(): Promise<DemoSeedMeta | null> {
  const snap = await get(ref(database, DEMO_SEED_PATH));
  return snap.exists() ? (snap.val() as DemoSeedMeta) : null;
}

export async function runDemoSeed(
  performedBy: string,
  log: SeedLogger,
): Promise<void> {
  log("Checking for conflicts with existing data…");
  await assertNoConflicts();
  const clock = new SimClock();
  const ctx: Ctx = {
    clock,
    log,
    warehouseId: {} as Record<WarehouseKey, string>,
    binId: new Map(),
    vendorId: {} as Record<VendorKey, string>,
    customerId: {} as Record<CustomerKey, string>,
    carrierByCode: new Map(),
    templateByCode: new Map(),
    soSeq: 0,
  };
  // Claim the marker first so a second tab can't start a parallel seed.
  await set(ref(database, DEMO_SEED_PATH), {
    seededAt: Date.now(),
    seededBy: performedBy,
    recordCount: 0,
    registry: [],
    inProgress: true,
  });
  try {
    await playScenario(ctx);
  } finally {
    clock.finish();
    // Always register what was written, even after a failure, so it can be removed cleanly.
    const registry = await buildRegistryAndRemap(clock, log);
    await set(ref(database, DEMO_SEED_PATH), {
      seededAt: Date.now(),
      seededBy: performedBy,
      recordCount: registry.length,
      registry,
    } satisfies DemoSeedMeta);
    log(`Registered ${registry.length} demo records.`);
  }
  log("Done. Reload the SCM pages to see the data.");
}

export async function removeDemoSeed(log: SeedLogger): Promise<void> {
  const meta = await getDemoSeedStatus();
  if (!meta) throw new Error("No demo data is registered.");
  const registry = meta.registry || [];
  log(`Removing ${registry.length} demo records…`);
  await commitInChunks(Object.fromEntries(registry.map((p) => [p, null])));

  // Advanced SCM persists exceptions/recommendations derived from the demo records on page view.
  const ids = new Set(registry.map((p) => p.split("/").pop() as string));
  for (const path of [
    ADVANCED_PATHS.exceptions,
    ADVANCED_PATHS.replenishment,
  ]) {
    const snap = await get(ref(database, path));
    const stale = Object.keys(
      (snap.val() || {}) as Record<string, unknown>,
    ).filter(
      (key) =>
        [...DEMO_PRODUCT_CODES].some((code) =>
          key.includes(firebaseKey(code)),
        ) || [...ids].some((id) => key.includes(id)),
    );
    await commitInChunks(
      Object.fromEntries(stale.map((key) => [`${path}/${key}`, null])),
    );
  }
  await remove(ref(database, DEMO_SEED_PATH));
  log("Demo data removed.");
}
