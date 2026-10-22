#!/usr/bin/env node
// Seeds the full SCM demo story through the running API, so every quantity
// lands via the real document workflows (and the stock ledger), never by
// writing tables directly. It covers what the legacy demo seed covered:
// bin layout (zone/rack/shelf/bin) with put-away and bin-to-bin moves,
// requisition -> RFQ -> quotation comparison -> PO -> GRN, incoming and
// inventory QC (failures, holds, quarantine write-off), customer and vendor
// returns, sales -> reserve -> pick -> pack -> issue -> ship -> deliver,
// a delivery exception, transfers, adjustments, and in-flight work for the
// live demo (pending approvals, an overdue PO, a backorder, an open RFQ),
// plus supplier finance: bills (paid / part-paid and overdue / open /
// cancelled), payments (incl. a voided one and an advance) and uploaded
// supplier documents.
//
//   node scripts/seed-scm-demo.mjs
//   API_URL=http://localhost:3000 ORG_SLUG=texawave-innovations \
//     SEED_EMAIL=admin@texawave.com SEED_PASSWORD=ChangeMe123! node scripts/seed-scm-demo.mjs
//
// Resumable and idempotent: each step records its result in a state file, so
// a re-run (or a re-run after a failure) skips what already happened and
// exits without changes once the story is complete. SEED_FORCE=1 ignores the
// state file. Master data is find-or-create by code.
//
// Document dates are back-dated across ~4 months; row `createdAt` stamps are
// set by the server and are therefore "now". Every name, GSTIN-style code and
// address is fictional.

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const API = process.env.API_URL ?? "http://localhost:3000";
const ORG = process.env.ORG_SLUG ?? "texawave-innovations";
const EMAIL = process.env.SEED_EMAIL ?? "admin@texawave.com";
const PASSWORD = process.env.SEED_PASSWORD ?? "ChangeMe123!";
const STATE_FILE = join(tmpdir(), `texawave-seed-scm-demo.${ORG}.json`);

const DAY = 24 * 60 * 60 * 1000;
const dateKey = (d) => {
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};
/** `YYYY-MM-DD` for `n` days ago (negative = in the future). */
const ago = (n) => dateKey(new Date(Date.now() - n * DAY));

let token = "";
async function call(method, path, body, okStatuses = [200, 201]) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!okStatuses.includes(res.status)) {
    throw new Error(
      `${method} ${path} -> ${res.status} ${JSON.stringify(json).slice(0, 500)}`,
    );
  }
  return json.data;
}
const post = (p, b = {}) => call("POST", p, b);
const patch = (p, b = {}) => call("PATCH", p, b);
const put = (p, b = {}) => call("PUT", p, b);
const get = (p) => call("GET", p);

// ---- resumable steps --------------------------------------------------------

let state = {};
function saveState() {
  writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}
/** Runs `fn` once; later runs reuse the stored (JSON) result. */
async function step(key, fn) {
  if (key in state) return state[key];
  const value = await fn();
  state[key] = value === undefined ? null : value;
  saveState();
  return state[key];
}
const log = (m) => console.log(m);

// ---- master data -------------------------------------------------------------

const PRODUCTS = {
  bearing: { productCode: "BRG-6205ZZ", name: "Deep Groove Ball Bearing 6205-ZZ", category: "Bearings", uom: "PCS", hsn: "8482", unitPrice: 260, costPrice: 185, reorderLevel: 150, minimumStock: 100, maximumStock: 2000 },
  valve: { productCode: "VLV-HCV12", name: "Hydraulic Control Valve 12 mm", category: "Hydraulics", uom: "PCS", hsn: "8481", unitPrice: 3450, costPrice: 2400, reorderLevel: 20, minimumStock: 10, maximumStock: 150 },
  motor: { productCode: "MTR-IND2HP", name: "Induction Motor 2 HP (3-Phase)", category: "Motors", uom: "PCS", hsn: "8501", unitPrice: 13500, costPrice: 9800, reorderLevel: 2, minimumStock: 1, maximumStock: 10, serialTracked: true },
  cable: { productCode: "CBL-CU4SQ", name: "Copper Power Cable 4 sq.mm", category: "Electricals", uom: "MTR", hsn: "8544", unitPrice: 58, costPrice: 42, reorderLevel: 500, minimumStock: 300, maximumStock: 5000, batchTracked: true },
  housing: { productCode: "HSG-ADC350", name: "Aluminium Die-Cast Gear Housing ADC-350", category: "Castings", uom: "PCS", hsn: "7616", unitPrice: 920, costPrice: 640, reorderLevel: 100, minimumStock: 50, maximumStock: 1000 },
  gloves: { productCode: "GLV-NIT09", name: "Nitrile Safety Gloves (Box of 100)", category: "Safety", uom: "BOX", hsn: "4015", unitPrice: 420, costPrice: 310, reorderLevel: 30, minimumStock: 20, maximumStock: 300 },
  seal: { productCode: "SEAL-OR25K", name: "O-Ring Seal Kit (25 pcs)", category: "Hydraulics", uom: "KIT", hsn: "4016", unitPrice: 140, costPrice: 95, reorderLevel: 50, minimumStock: 30, maximumStock: 400 },
  pump: { productCode: "PMP-CF1HP", name: "Centrifugal Water Pump 1 HP", category: "Pumps", uom: "PCS", hsn: "8413", unitPrice: 10900, costPrice: 7800, reorderLevel: 4, minimumStock: 2, maximumStock: 20 },
};

const WAREHOUSES = {
  chennai: { code: "WH-CHN", name: "Chennai Central Warehouse", type: "Main", address: "Plot 14, SIPCOT Industrial Park, Irungattukottai", city: "Chennai", state: "Tamil Nadu", country: "India", postalCode: "602117", managerName: "Arun Kumar", phone: "+91 98400 11223", capacity: 12000, capacityUnit: "SQFT", operatingHours: "Mon-Sat, 08:00-20:00" },
  bengaluru: { code: "WH-BLR", name: "Bengaluru Distribution Centre", type: "Distribution", address: "No. 82, Peenya Industrial Area Phase II", city: "Bengaluru", state: "Karnataka", country: "India", postalCode: "560058", managerName: "Kiran Gowda", phone: "+91 98450 44556", capacity: 5000, capacityUnit: "SQFT", operatingHours: "Mon-Sat, 08:00-20:00" },
};

/** zone -> rack -> shelf -> bins (capacity in units). */
const LOCATION_LAYOUT = {
  chennai: [
    { zone: "Z01", name: "Fast-moving Components", racks: [{ rack: "R01", shelves: [
      { shelf: "S01", bins: [{ bin: "B01", name: "Bearings - primary", capacity: 500 }, { bin: "B02", name: "Bearings - overflow", capacity: 800 }] },
      { shelf: "S02", bins: [{ bin: "B03", name: "Valves & seals", capacity: 300 }, { bin: "B04", name: "Motors (floor pallet)", capacity: 20 }] },
    ] }] },
    { zone: "Z02", name: "Bulk & Electricals", racks: [{ rack: "R01", shelves: [
      { shelf: "S01", bins: [{ bin: "B01", name: "Cable drums", capacity: 4000 }, { bin: "B02", name: "Castings", capacity: 600 }] },
    ] }] },
  ],
  bengaluru: [
    { zone: "Z01", name: "Distribution Stock", racks: [{ rack: "R01", shelves: [
      { shelf: "S01", bins: [{ bin: "B01", name: "Bearings", capacity: 600 }, { bin: "B02", name: "General", capacity: 400 }] },
    ] }] },
  ],
};

const VENDORS = {
  precision: { supplierCode: "SUP-PBI", companyName: "Precision Bearings India Pvt Ltd", type: "Manufacturer", status: "Active", gstin: "33AAECP4821K1Z6", pan: "AAECP4821K", contactPerson: "Ramesh Natarajan", phone: "919444012345", email: "sales@precisionbearings.example", street: "21, Ambattur Industrial Estate", city: "Chennai", state: "Tamil Nadu", country: "India", pincode: "600058", paymentTerms: "Net 30", creditLimit: 1500000, leadTimeDays: 10, rating: 5, notes: "Preferred bearing supplier. ISO 9001 certified." },
  hydrotech: { supplierCode: "SUP-HFS", companyName: "Hydrotech Fluid Systems", type: "Manufacturer", status: "Active", gstin: "33AAGFH7314M1Z2", pan: "AAGFH7314M", contactPerson: "Lakshmi Prasad", phone: "919489023456", email: "orders@hydrotech.example", street: "SF 112, Kurichi Industrial Cluster", city: "Coimbatore", state: "Tamil Nadu", country: "India", pincode: "641021", paymentTerms: "Net 45", creditLimit: 2000000, leadTimeDays: 7, rating: 4, notes: "Valves, seals and motors." },
  southern: { supplierCode: "SUP-SCW", companyName: "Southern Cables & Wires", type: "Manufacturer", status: "Active", gstin: "33AAHFS5566Q1Z9", pan: "AAHFS5566Q", contactPerson: "Senthil Murugan", phone: "919443034567", email: "dispatch@southerncables.example", street: "Plot 7, SIPCOT Phase I", city: "Hosur", state: "Tamil Nadu", country: "India", pincode: "635126", paymentTerms: "Net 30", creditLimit: 1000000, leadTimeDays: 8, rating: 3, notes: "Price-competitive on copper cable; recent insulation quality issues under review." },
  metro: { supplierCode: "SUP-MIS", companyName: "Metro Industrial Supplies", type: "Distributor", status: "Active", gstin: "29AAJCM9087R1Z4", pan: "AAJCM9087R", contactPerson: "Farhan Sheikh", phone: "919886045678", email: "info@metroindustrial.example", street: "44, Bommasandra Industrial Area", city: "Bengaluru", state: "Karnataka", country: "India", pincode: "560099", paymentTerms: "Net 30", creditLimit: 1200000, leadTimeDays: 14, rating: 3, notes: "Multi-category distributor - castings, consumables and cable." },
  nova: { supplierCode: "SUP-NCL", companyName: "Nova Castings Ltd", type: "Manufacturer", status: "Pending Approval", gstin: "27AAKCN2231P1Z7", pan: "AAKCN2231P", contactPerson: "Aditi Kulkarni", phone: "919822056789", email: "bd@novacastings.example", street: "Gat No. 112, Chakan MIDC", city: "Pune", state: "Maharashtra", country: "India", pincode: "410501", paymentTerms: "Net 60", creditLimit: 0, leadTimeDays: 21, notes: "New casting vendor - onboarding documents under review. Cannot receive RFQs/POs until approved." },
};

const CUSTOMERS = {
  balaji: { customerCode: "CUS-SBE", name: "Sri Balaji Engineering Works", contactPerson: "Venkatesh Rao", email: "purchase@sribalaji.example", phone: "919841061234", gstin: "33AAFFS3344D1Z1", address: "18, Guindy Industrial Estate, Chennai, Tamil Nadu - 600032" },
  apex: { customerCode: "CUS-AAC", name: "Apex Automotive Components Pvt Ltd", contactPerson: "Neha Deshpande", email: "scm@apexauto.example", phone: "919823072345", gstin: "27AAHCA6677E1Z3", address: "Plot B-12, Bhosari MIDC, Pune, Maharashtra - 411026" },
  kaveri: { customerCode: "CUS-KAI", name: "Kaveri Agro Industries", contactPerson: "Murali Krishnan", email: "stores@kaveriagro.example", phone: "919443083456", gstin: "33AAJFK8899F1Z5", address: "5/210, Avinashi Road, Coimbatore, Tamil Nadu - 641014" },
  deccan: { customerCode: "CUS-DPM", name: "Deccan Pumps & Motors", contactPerson: "Srinivas Reddy", email: "procurement@deccanpumps.example", phone: "919908094567", gstin: "36AAKFD1122G1Z8", address: "IDA Cherlapally, Phase III, Hyderabad, Telangana - 500051" },
};

const CARRIERS = [
  { carrierCode: "BLUEDART", carrierName: "Blue Dart Express", serviceTypes: ["EXPRESS", "STANDARD", "SAME_DAY"], contact: "Key Accounts Desk", phone: "914440001111", email: "keyaccounts@bluedart.example", trackingUrlTemplate: "https://track.example.com/bluedart/{trackingNumber}", notes: "Express parcels up to 50 kg." },
  { carrierCode: "DELHIVERY", carrierName: "Delhivery", serviceTypes: ["STANDARD", "ECONOMY"], contact: "B2B Support", phone: "911244002222", email: "b2b@delhivery.example", trackingUrlTemplate: "https://track.example.com/delhivery/{trackingNumber}", notes: "Pan-India surface freight." },
  { carrierCode: "VRL", carrierName: "VRL Logistics", serviceTypes: ["ECONOMY", "STANDARD"], contact: "Chennai Branch", phone: "914440003333", email: "chennai@vrl.example", trackingUrlTemplate: "https://track.example.com/vrl/{trackingNumber}", notes: "Full/part truck loads, cable drums and pallets." },
];

const DEFECTS = [
  { defectCode: "INS-CRACK", name: "Insulation crack", description: "Visible cracks or cuts in cable insulation", category: "PRODUCT", severity: "HIGH" },
  { defectCode: "DIM-OOT", name: "Dimension out of tolerance", description: "Critical dimension outside drawing tolerance", category: "PRODUCT", severity: "MEDIUM" },
  { defectCode: "SURF-POR", name: "Surface porosity", description: "Blow holes / porosity on casting surface", category: "PHYSICAL_DAMAGE", severity: "HIGH" },
  { defectCode: "PKG-DMG", name: "Packaging damaged", description: "Outer carton or pallet damaged in transit", category: "PACKAGING", severity: "LOW" },
  { defectCode: "SHORT-QTY", name: "Short supply", description: "Quantity received is less than invoiced", category: "QUANTITY", severity: "MEDIUM" },
  { defectCode: "NOISE-VIB", name: "Abnormal noise / vibration", description: "Bearing or motor runs rough on spin test", category: "FUNCTIONAL", severity: "CRITICAL" },
];

const TEMPLATES = [
  { templateCode: "TPL-INC-GEN", name: "Incoming Material Inspection", description: "Standard receiving inspection for all purchased material", inspectionType: "INCOMING", checkpoints: [
    { name: "Packaging intact", required: true },
    { name: "Quantity matches delivery challan", required: true },
    { name: "Visual inspection", required: true },
    { name: "Critical dimension check", required: false, expectedValue: "Per drawing", unit: "mm" },
  ] },
  { templateCode: "TPL-RET-CUS", name: "Customer Return Inspection", description: "Condition and function check for returned goods", inspectionType: "CUSTOMER_RETURN", checkpoints: [
    { name: "Physical condition", required: true },
    { name: "Functional / spin test", required: false },
  ] },
  { templateCode: "TPL-INV-AUD", name: "Periodic Stock Quality Audit", description: "Random quality audit of stock on hand", inspectionType: "INVENTORY", checkpoints: [
    { name: "Visual inspection", required: true },
    { name: "Surface porosity check", required: true },
  ] },
  { templateCode: "TPL-PDI", name: "Pre-Dispatch Inspection", description: "Final check before goods leave the warehouse", inspectionType: "PRE_DISPATCH", checkpoints: [
    { name: "Labelling and part numbers correct", required: true },
    { name: "Packing secure", required: true },
  ] },
];

/** Unit weight (kg), used to size packages. */
const UNIT_WEIGHT_KG = { bearing: 0.25, valve: 1.8, motor: 28, cable: 0.12, housing: 2.4, gloves: 1, seal: 0.3, pump: 14 };

// ---- find-or-create helpers --------------------------------------------------

async function findByCode(path, field, code, extra = "") {
  const rows = await get(`${path}?q=${encodeURIComponent(code)}&limit=50${extra}`);
  return (Array.isArray(rows) ? rows : []).find(
    (r) => String(r[field]).toUpperCase() === code.toUpperCase(),
  );
}

async function ensureMasters(ctx) {
  log("Master data: warehouses, bin layout, products, suppliers, customers, carriers, QC...");
  for (const [key, w] of Object.entries(WAREHOUSES)) {
    const wh = (await findByCode("/scm/warehouses", "code", w.code)) ?? (await post("/scm/warehouses", w));
    ctx.wh[key] = wh.id;
  }
  // Bin layout: find-or-create each zone/rack/shelf/bin under its parent.
  for (const [key, zones] of Object.entries(LOCATION_LAYOUT)) {
    const existing = (await get(`/scm/warehouse-locations?warehouseId=${ctx.wh[key]}&limit=100`)) ?? [];
    const FIELD = { ZONE: "zone", RACK: "rack", SHELF: "shelf", BIN: "binCode" };
    const make = async (locationType, parent, code, locationName, capacity) => {
      const found = existing.find(
        (l) => l.locationType === locationType && (l.parentLocationId ?? null) === (parent?.id ?? null) && l[FIELD[locationType]] === code,
      );
      if (found) return found;
      const created = await post("/scm/warehouse-locations", {
        warehouseId: ctx.wh[key], locationType, parentLocationId: parent?.id, code, locationName,
        ...(capacity ? { capacity, capacityUnit: "units" } : {}),
      });
      existing.push(created);
      return created;
    };
    for (const z of zones) {
      const zone = await make("ZONE", undefined, z.zone, z.name);
      for (const r of z.racks) {
        const rack = await make("RACK", zone, r.rack);
        for (const s of r.shelves) {
          const shelf = await make("SHELF", rack, s.shelf);
          for (const b of s.bins) {
            const bin = await make("BIN", shelf, b.bin, b.name, b.capacity);
            ctx.bin[`${key}:${z.zone}-${r.rack}-${s.shelf}-${b.bin}`] = bin.id;
          }
        }
      }
    }
  }

  for (const [key, p] of Object.entries(PRODUCTS)) {
    let row = await findByCode("/scm/products", "productCode", p.productCode);
    if (!row) row = await post("/scm/products", p);
    else row = await patch(`/scm/products/${row.id}`, p);
    ctx.product[key] = row;
  }
  for (const [key, v] of Object.entries(VENDORS)) {
    const { street, city, state, country, pincode, ...rest } = v;
    let row = await findByCode("/scm/suppliers", "supplierCode", v.supplierCode);
    if (!row) row = await post("/scm/suppliers", { ...rest, street, city, state, country, pincode });
    ctx.vendor[key] = row;
  }
  for (const [key, c] of Object.entries(CUSTOMERS)) {
    const { address, ...rest } = c;
    let row = await findByCode("/scm/customers", "customerCode", c.customerCode);
    if (!row) row = await post("/scm/customers", { ...rest, billingAddress: address, shippingAddress: address });
    ctx.customer[key] = row;
  }
  for (const c of CARRIERS) {
    const row = (await findByCode("/scm/carriers", "carrierCode", c.carrierCode)) ?? (await post("/scm/carriers", c));
    ctx.carrier[c.carrierCode] = row;
  }
  for (const d of DEFECTS) {
    if (!(await findByCode("/scm/quality/defects", "defectCode", d.defectCode))) await post("/scm/quality/defects", d);
  }
  for (const t of TEMPLATES) {
    ctx.template[t.templateCode] =
      (await findByCode("/scm/quality/templates", "templateCode", t.templateCode)) ??
      (await post("/scm/quality/templates", t));
  }
  // Template checkpoints carry server-assigned ids; load them for QC results.
  for (const code of Object.keys(ctx.template)) {
    ctx.template[code] = await get(`/scm/quality/templates/${ctx.template[code].id}`);
  }
}

// ---- document helpers ---------------------------------------------------------

const P = "/scm/procurement";

async function requisition(ctx, { wh, lines, priority, department, purpose, requiredIn, submit = true, approve = false, daysAgo }) {
  const pr = await post(`${P}/requisitions`, {
    department, requestDate: ago(daysAgo), requiredDate: ago(daysAgo - requiredIn), priority, warehouseId: ctx.wh[wh], purpose,
    items: lines.map((l) => ({ productId: ctx.product[l.p].id, quantity: l.qty, estimatedUnitCost: l.estCost ?? PRODUCTS[l.p].costPrice })),
  });
  if (submit) await post(`${P}/requisitions/${pr.id}/submit`);
  if (approve) await post(`${P}/requisitions/${pr.id}/approve`);
  return pr;
}

async function rfq(ctx, { pr, vendors, wh, lines, daysAgo, dueIn, paymentTerms, deliveryTerms, notes }) {
  const r = await post(`${P}/rfqs`, {
    requisitionId: pr?.id, supplierIds: vendors.map((v) => ctx.vendor[v].id), issueDate: ago(daysAgo), responseDueDate: ago(daysAgo - dueIn),
    warehouseId: ctx.wh[wh], deliveryLocation: WAREHOUSES[wh].name, paymentTerms, deliveryTerms, notes,
    items: lines.map((l) => ({ productId: ctx.product[l.p].id, quantity: l.qty })),
  });
  await post(`${P}/rfqs/${r.id}/issue`);
  return r;
}

async function quotation(ctx, { rfqId, vendor, ref, lines, freight = 0, discount = 0, daysAgo, validFor, paymentTerms, deliveryTerms, notes }) {
  return post(`${P}/quotations`, {
    rfqId, supplierId: ctx.vendor[vendor].id, supplierQuotationNumber: ref, quotationDate: ago(daysAgo), validUntil: ago(daysAgo - validFor),
    paymentTerms, deliveryTerms, freight, discount, notes,
    items: lines.map((l) => ({
      productId: ctx.product[l.p].id, quantity: l.qty, unitPrice: l.unitPrice, taxRate: 18,
      ...(l.deliveryIn != null ? { promisedDeliveryDate: ago(daysAgo - l.deliveryIn) } : {}),
    })),
  });
}

async function purchaseOrder(ctx, { vendor, wh, lines, quotationId, freight = 0, daysAgo, expectedIn, paymentTerms, notes, stage = "sent" }) {
  const po = await post(`${P}/purchase-orders`, {
    quotationId, supplierId: quotationId ? undefined : ctx.vendor[vendor].id, poDate: ago(daysAgo), expectedDeliveryDate: ago(daysAgo - expectedIn),
    warehouseId: ctx.wh[wh], deliveryLocation: WAREHOUSES[wh].name, paymentTerms, freight, notes,
    ...(quotationId ? {} : { items: lines.map((l) => ({ productId: ctx.product[l.p].id, quantity: l.qty, unitPrice: l.unitPrice, taxRate: 18 })) }),
  });
  if (stage === "draft") return po;
  await post(`${P}/purchase-orders/${po.id}/submit`);
  if (stage === "pending") return po;
  await post(`${P}/purchase-orders/${po.id}/approve`);
  if (stage === "approved") return po;
  await post(`${P}/purchase-orders/${po.id}/send`);
  return po;
}

async function receive(poId, daysAgo, lines, notes) {
  const po = await get(`${P}/purchase-orders/${poId}`);
  const grn = await post(`${P}/goods-receipts`, {
    purchaseOrderId: poId, receiptDate: ago(daysAgo), notes,
    lines: lines.map((l) => ({
      purchaseOrderItemId: po.items[l.index].id, receivingQuantity: l.receive, rejectedQuantity: l.reject ?? 0,
      batchNumber: l.batch, serialNumbers: l.serials,
    })),
  });
  return get(`${P}/goods-receipts/${grn.id}`);
}

/** Put-away (create from GRN -> start -> record destination per line). */
async function putaway(ctx, grn, assignments, { complete = true, start = true } = {}) {
  const pa = await post("/scm/warehouse/putaway", { warehouseId: grn.warehouseId, grnId: grn.id });
  if (!start) return pa;
  await post(`/scm/warehouse/putaway/${pa.id}/start`);
  if (!complete) return pa;
  const detail = await get(`/scm/warehouse/putaway/${pa.id}`);
  for (const a of assignments) {
    const item = detail.items.find((i) => i.productCode === PRODUCTS[a.p].productCode);
    await post(`/scm/warehouse/putaway/${pa.id}/items/${item.id}`, { quantity: a.qty, destinationLocationId: ctx.bin[a.bin] });
  }
  return pa;
}

async function transfer(ctx, { p, from, to, qty, notes, upTo }) {
  const t = await post("/scm/inventory/transfers", {
    productId: ctx.product[p].id, sourceWarehouseId: ctx.wh[from], destinationWarehouseId: ctx.wh[to], quantity: qty, notes,
  });
  if (upTo === "requested") return t;
  await post(`/scm/inventory/transfers/${t.id}/approve`);
  if (upTo === "approved") return t;
  await post(`/scm/inventory/transfers/${t.id}/dispatch`);
  return t;
}

async function adjustment(ctx, { p, wh, direction, qty, reason, notes, approve }) {
  const a = await post("/scm/inventory/adjustments", { productId: ctx.product[p].id, warehouseId: ctx.wh[wh], direction, quantity: qty, reason, notes });
  if (approve) await post(`/scm/inventory/adjustments/${a.id}/approve`);
  return a;
}

async function salesOrder(ctx, { customer, lines, daysAgo, requiredIn, notes }) {
  const c = ctx.customer[customer];
  const so = await post("/scm/sales-orders", {
    customerId: c.id, orderDate: ago(daysAgo), expectedDate: ago(daysAgo - requiredIn), notes,
    items: lines.map((l) => ({ productId: ctx.product[l.p].id, quantity: l.qty, unitPrice: PRODUCTS[l.p].unitPrice, taxRate: 18 })),
  });
  await post(`/scm/sales-orders/${so.id}/confirm`);
  return so;
}

async function startFulfillment(ctx, so, wh, { reserve = true } = {}) {
  const f = await post("/scm/fulfillments", { salesOrderId: so.id, warehouseId: ctx.wh[wh] });
  if (reserve) await post(`/scm/fulfillments/${f.id}/reserve`);
  return f;
}

/** Pick list created, started and fully picked. Returns the picking row. */
async function pickAll(fulfillmentId, picker = "Arun Kumar") {
  await post(`/scm/fulfillments/${fulfillmentId}/pick-list`);
  const f = await get(`/scm/fulfillments/${fulfillmentId}`);
  const pick = f.pickings[f.pickings.length - 1];
  await post(`/scm/pickings/${pick.id}/assign`, { pickerName: picker });
  await post(`/scm/pickings/${pick.id}/start`);
  await post(`/scm/pickings/${pick.id}/record`, {
    items: pick.items.map((it) => ({ pickingItemId: it.id, pickedQuantity: Number(it.requestedQuantity) })),
  });
  return get(`/scm/pickings/${pick.id}`);
}

/** One package per product line (cables go on drums, heavy lines on pallets). */
async function packAll(ctx, pick) {
  const keyByCode = Object.fromEntries(Object.entries(PRODUCTS).map(([k, p]) => [p.productCode, k]));
  const packages = pick.items.filter((it) => Number(it.pickedQuantity) > 0).map((it, i) => {
    const key = keyByCode[it.productCode];
    const qty = Number(it.pickedQuantity);
    const weight = Math.round(qty * (UNIT_WEIGHT_KG[key] ?? 1) * 10) / 10;
    const bulky = weight > 60;
    return {
      packageNumber: `PKG-${i + 1}`, packageType: key === "cable" ? "Drum" : bulky ? "Pallet" : "Carton", weight,
      length: bulky ? 120 : 60, width: bulky ? 100 : 40, height: bulky ? 90 : 40,
      items: [{ productId: it.productId, quantity: qty }],
    };
  });
  return post("/scm/packings", { pickingId: pick.id, packages, packerName: "Arun Kumar" });
}

/** Pick -> pack -> issue stock -> shipment at READY_TO_SHIP. Returns the shipment. */
async function pickPackShip(ctx, fulfillmentId) {
  const pick = await pickAll(fulfillmentId);
  const pack = await packAll(ctx, pick);
  await post(`/scm/fulfillments/${fulfillmentId}/finalize`);
  return post("/scm/shipments", { fulfillmentId, packingIds: [pack.id] });
}

async function dispatch(ctx, shipmentId, carrierCode, serviceType, deliverIn, trackingNumber) {
  await post(`/scm/shipments/${shipmentId}/carrier`, {
    carrierId: ctx.carrier[carrierCode].id, serviceType, expectedDeliveryDate: ago(-deliverIn),
  });
  await post(`/scm/shipments/${shipmentId}/label`, { trackingNumber });
  await post(`/scm/shipments/${shipmentId}/dispatch`);
}
const moveShipment = (id, status, location, description) =>
  post(`/scm/shipments/${id}/status`, { status, location, description });
const deliver = (id, recipientName, deliveryNotes = "Delivered in good condition") =>
  post(`/scm/shipments/${id}/deliver`, { recipientName, deliveryNotes });

/** Full dispatch -> in transit -> out for delivery -> delivered chain. */
async function ship(ctx, shipmentId, { carrier, service, trackingNumber, deliverIn, hub, town, recipient, notes }) {
  await dispatch(ctx, shipmentId, carrier, service, deliverIn, trackingNumber);
  await moveShipment(shipmentId, "IN_TRANSIT", hub, `Arrived at ${hub}`);
  await moveShipment(shipmentId, "OUT_FOR_DELIVERY", town, "Out for delivery");
  await deliver(shipmentId, recipient, notes);
}

// ---- quality helpers -------------------------------------------------------------

function checkpointResults(template, failing = [], defectCode) {
  return template.checkpoints.map((c) => ({
    checkpointId: c.checkpointId,
    result: failing.includes(c.name) ? "FAIL" : "PASS",
    ...(failing.includes(c.name) && defectCode ? { defectCode } : {}),
    ...(c.expectedValue && !failing.includes(c.name) ? { observedValue: "Within tolerance" } : {}),
  }));
}

async function inspect(inspectionId, template, results) {
  await post(`/scm/quality/inspections/${inspectionId}/start`, { inspectorName: "Meena Sundaram" });
  const insp = await get(`/scm/quality/inspections/${inspectionId}`);
  for (const [idx, item] of insp.items.entries()) {
    const { failing, ...body } = results[idx];
    await put(`/scm/quality/inspections/${inspectionId}/items/${item.id}`, {
      ...body, checkpointResults: checkpointResults(template, failing, body.defectCode),
    });
  }
  await post(`/scm/quality/inspections/${inspectionId}/complete`);
}

const quarantineFor = async (inspectionId) => {
  const rows = await get("/scm/quality/quarantine?limit=100");
  const rec = rows.find((r) => r.inspectionId === inspectionId);
  if (!rec) throw new Error(`No quarantine record for inspection ${inspectionId}`);
  return rec;
};

// ---- the story ------------------------------------------------------------------------

async function play(ctx) {
  const T = ctx.template;
  const pid = (k) => ctx.product[k].id;

  // Opening balances at go-live.
  await step("opening", async () => {
    log("Opening balances...");
    const open = (p, wh, quantity) =>
      post("/scm/inventory/opening-balance", { productId: pid(p), warehouseId: ctx.wh[wh], quantity, unitCost: PRODUCTS[p].costPrice, notes: "Opening stock at go-live" });
    await open("bearing", "chennai", 400);
    await open("bearing", "bengaluru", 150);
    await open("valve", "chennai", 60);
    await open("housing", "chennai", 380);
    await open("gloves", "chennai", 200);
    await open("seal", "chennai", 45);
    await open("pump", "chennai", 3);
    return true;
  });

  // ---- Procurement cycle 1: copper cable, full PR -> RFQ -> comparison -> PO ----------------
  const c1 = await step("cycle1", async () => {
    log("Procurement cycle 1: copper cable (PR -> RFQ -> 2 quotations -> comparison -> PO)...");
    const pr = await requisition(ctx, { wh: "chennai", lines: [{ p: "cable", qty: 2000, estCost: 44 }], priority: "High", department: "Maintenance", purpose: "Rewiring of Line 3 and stock for customer orders", requiredIn: 14, approve: true, daysAgo: 100 });
    const r = await rfq(ctx, { pr, vendors: ["southern", "metro"], wh: "chennai", lines: [{ p: "cable", qty: 2000 }], daysAgo: 98, dueIn: 4, paymentTerms: "Net 30", deliveryTerms: "Door delivery, Chennai", notes: "ISI-marked FRLS cable only" });
    const q1 = await quotation(ctx, { rfqId: r.id, vendor: "southern", ref: "SCW/Q/2605/118", lines: [{ p: "cable", qty: 2000, unitPrice: 41.5, deliveryIn: 8 }], daysAgo: 95, validFor: 30, paymentTerms: "Net 30", deliveryTerms: "Free delivery" });
    await quotation(ctx, { rfqId: r.id, vendor: "metro", ref: "MIS-QT-4471", lines: [{ p: "cable", qty: 2000, unitPrice: 44, deliveryIn: 12 }], freight: 1500, daysAgo: 94, validFor: 21, paymentTerms: "Net 30", deliveryTerms: "Ex-works + freight" });
    await post(`${P}/comparison`, { rfqId: r.id, selectedQuotationId: q1.id, remarks: "Lowest landed cost and faster delivery; ISI certificate verified." });
    const po = await purchaseOrder(ctx, { vendor: "southern", wh: "chennai", quotationId: q1.id, daysAgo: 93, expectedIn: 7, paymentTerms: "Net 30" });
    return { poId: po.id };
  });

  // ---- Sales order 1 -----------------------------------------------------------------------
  const s1 = await step("so1", async () => {
    log("Sales: orders -> reserve -> pick -> pack -> issue -> ship -> deliver...");
    const so = await salesOrder(ctx, { customer: "balaji", lines: [{ p: "bearing", qty: 120 }, { p: "valve", qty: 8 }], daysAgo: 91, requiredIn: 7 });
    const f = await startFulfillment(ctx, so, "chennai");
    const sh = await pickPackShip(ctx, f.id);
    await ship(ctx, sh.id, { carrier: "DELHIVERY", service: "STANDARD", trackingNumber: "DLV5540021873", deliverIn: 3, hub: "Chennai Hub", town: "Guindy, Chennai", recipient: "Venkatesh Rao" });
    return { soId: so.id, fId: f.id, shId: sh.id };
  });

  // ---- Cable receipt: dock reject, incoming QC fails partially, quarantine, write-off --------
  const g1 = await step("grn1", async () => {
    log("Receiving cable (GRN), incoming QC with partial failure, quarantine...");
    const grn = await receive(c1.poId, 86, [{ index: 0, receive: 2000, reject: 50, batch: "SCW-2605-A" }], "50 m rejected at dock - drum outer layer crushed.");
    const qc = await post("/scm/quality/inspections", { inspectionType: "INCOMING", sourceId: grn.id, templateId: T["TPL-INC-GEN"].id, priority: "HIGH", notes: "Random sampling of 3 drums per lot" });
    await inspect(qc.id, T["TPL-INC-GEN"], [{
      inspectedQuantity: 1950, acceptedQuantity: 1800, rejectedQuantity: 150, condition: "DEFECTIVE", defectCode: "INS-CRACK",
      defectDescription: "Insulation cracks on one 150 m coil", disposition: "QUARANTINE",
      notes: "Coil #3 shows insulation cracking at 12 points. Held for supplier review.", failing: ["Visual inspection"],
    }]);
    await putaway(ctx, grn, [{ p: "cable", qty: 1950, bin: "chennai:Z02-R01-S01-B01" }]);
    const qr = await quarantineFor(qc.id);
    await post(`/scm/quality/quarantine/${qr.id}/review`, { notes: "Supplier notified; photos attached." });
    await post(`/scm/quality/quarantine/${qr.id}/reject`, { notes: "Supplier accepted the claim; coil scrapped and debit note raised." });
    try {
      await post(`${P}/purchase-orders/${c1.poId}/close`);
    } catch (e) {
      log(`  (PO short-close skipped: ${e.message.slice(0, 120)})`);
    }
    return { grnId: grn.id, itemId: grn.items[0].id };
  });

  // ---- Sales order 2 + vendor return + customer return (full lifecycle) -----------------------
  const s2 = await step("so2", async () => {
    const so = await salesOrder(ctx, { customer: "apex", lines: [{ p: "housing", qty: 80 }, { p: "bearing", qty: 60 }], daysAgo: 79, requiredIn: 7 });
    const f = await startFulfillment(ctx, so, "chennai");
    const sh = await pickPackShip(ctx, f.id);
    return { soId: so.id, fId: f.id, shId: sh.id };
  });
  await step("vr1", async () => {
    log("Vendor return to Southern Cables...");
    const vr = await post("/scm/returns/vendor", {
      grnId: g1.grnId, reasonCode: "QUALITY_ISSUE", reasonDescription: "Additional 100 m with insulation damage found during put-away",
      items: [{ grnItemId: g1.itemId, requestedQuantity: 100 }], notes: "Replacement requested against PO",
    });
    await post(`/scm/returns/${vr.id}/submit`);
    await post(`/scm/returns/${vr.id}/approve`);
    await post(`/scm/returns/${vr.id}/ready-to-ship`);
    await post(`/scm/returns/${vr.id}/ship`, { carrier: "VRL Logistics", trackingNumber: "VRL-LR-558120", notes: "Return to Hosur plant" });
    await post(`/scm/returns/${vr.id}/vendor-received`);
    await post(`/scm/returns/${vr.id}/complete`);
    return vr.id;
  });
  await step("so2-ship", async () => {
    await ship(ctx, s2.shId, { carrier: "BLUEDART", service: "EXPRESS", trackingNumber: "BD80431175520", deliverIn: 3, hub: "Pune Hub", town: "Bhosari, Pune", recipient: "Neha Deshpande", notes: "Delivered - 1 carton reported crushed" });
    return true;
  });

  // ---- Procurement cycle 2: bearings, direct PO, two partial receipts, put-away ----------------
  const c2 = await step("cycle2", async () => {
    log("Procurement cycle 2: bearings (direct PO, two partial receipts, put-away)...");
    const po = await purchaseOrder(ctx, { vendor: "precision", wh: "chennai", lines: [{ p: "bearing", qty: 1000, unitPrice: 178 }], daysAgo: 71, expectedIn: 14, paymentTerms: "Net 30", notes: "Annual rate contract RC-PBI-2026" });
    return { poId: po.id };
  });

  const cr1 = await step("cr1", async () => {
    log("Customer return 1: damaged housings (request -> approve -> receive -> inspect -> disposition)...");
    const cr = await post("/scm/returns/customer", {
      fulfillmentId: s2.fId, shipmentId: s2.shId, reasonCode: "DELIVERY_DAMAGE",
      reasonDescription: "One carton crushed in transit - 10 housings returned", items: [{ productId: pid("housing"), requestedQuantity: 10 }],
    });
    await post(`/scm/returns/${cr.id}/submit`);
    await post(`/scm/returns/${cr.id}/approve`);
    await post(`/scm/returns/${cr.id}/in-transit`, { carrier: "Blue Dart Express", trackingNumber: "BD80431190044" });
    return cr.id;
  });

  const s3 = await step("so3", async () => {
    const so = await salesOrder(ctx, { customer: "deccan", lines: [{ p: "pump", qty: 3 }, { p: "cable", qty: 400 }], daysAgo: 67, requiredIn: 10 });
    const f = await startFulfillment(ctx, so, "chennai");
    return { soId: so.id, fId: f.id };
  });
  await step("cr1-inspect", async () => {
    await post(`/scm/returns/${cr1}/receive`, {});
    await post(`/scm/returns/${cr1}/start-inspection`);
    const cr = await get(`/scm/returns/${cr1}`);
    const item = cr.items[0];
    await post(`/scm/returns/${cr1}/inspect`, {
      itemResults: [{ itemId: item.id, condition: "USED", acceptedQuantity: 7, rejectedQuantity: 3 }],
      notes: "7 units cosmetically fine after cleaning; 3 have cracked mounting lugs.",
    });
    await post(`/scm/returns/${cr1}/to-disposition`);
    await post(`/scm/returns/${cr1}/disposition`, { itemId: item.id, disposition: "RESTOCK", quantity: 7, notes: "Back to sellable stock" });
    await post(`/scm/returns/${cr1}/disposition`, { itemId: item.id, disposition: "DAMAGED", quantity: 3, notes: "Cracked lugs - not repairable" });
    await post(`/scm/returns/${cr1}/complete`);
    return true;
  });
  const sh3 = await step("so3-ship", async () => {
    const sh = await pickPackShip(ctx, s3.fId);
    await ship(ctx, sh.id, { carrier: "VRL", service: "ECONOMY", trackingNumber: "VRL-LR-561907", deliverIn: 5, hub: "Hyderabad Hub", town: "Cherlapally, Hyderabad", recipient: "Srinivas Reddy" });
    return sh.id;
  });
  void sh3;

  const g2a = await step("grn2a", async () => {
    const grn = await receive(c2.poId, 60, [{ index: 0, receive: 600 }], "Lot 1 of 2 against the rate contract.");
    await putaway(ctx, grn, [
      { p: "bearing", qty: 470, bin: "chennai:Z01-R01-S01-B01" },
      { p: "bearing", qty: 130, bin: "chennai:Z01-R01-S01-B02" },
    ]);
    return { grnId: grn.id, itemId: grn.items[0].id };
  });

  const s4 = await step("so4", async () => {
    const so = await salesOrder(ctx, { customer: "kaveri", lines: [{ p: "bearing", qty: 150 }, { p: "seal", qty: 10 }], daysAgo: 57, requiredIn: 7 });
    const f = await startFulfillment(ctx, so, "chennai");
    const sh = await pickPackShip(ctx, f.id);
    await dispatch(ctx, sh.id, "DELHIVERY", "STANDARD", 3, "DLV5540093310");
    return { shId: sh.id };
  });

  // ---- Inter-warehouse transfer, bin-to-bin movement -------------------------------------------
  await step("transfer1", async () => {
    log("Stock transfer Chennai -> Bengaluru, bin-to-bin movement, adjustment...");
    const t = await transfer(ctx, { p: "bearing", from: "chennai", to: "bengaluru", qty: 100, notes: "Replenish Bengaluru for Sri Balaji orders" });
    await moveShipment(s4.shId, "IN_TRANSIT", "Coimbatore Hub", "In transit");
    await moveShipment(s4.shId, "OUT_FOR_DELIVERY", "Avinashi Road, Coimbatore", "Out for delivery");
    await deliver(s4.shId, "Murali Krishnan");
    await post(`/scm/inventory/transfers/${t.id}/receive`);
    return t.id;
  });

  await step("grn2b", async () => {
    const grn = await receive(c2.poId, 50, [{ index: 0, receive: 400 }], "Lot 2 of 2 - PO complete.");
    await putaway(ctx, grn, [{ p: "bearing", qty: 400, bin: "chennai:Z01-R01-S01-B02" }]);
    return grn.id;
  });

  await step("so5", async () => {
    const so = await salesOrder(ctx, { customer: "balaji", lines: [{ p: "bearing", qty: 90 }], daysAgo: 48, requiredIn: 4 });
    const f = await startFulfillment(ctx, so, "bengaluru");
    const sh = await pickPackShip(ctx, f.id);
    await ship(ctx, sh.id, { carrier: "BLUEDART", service: "EXPRESS", trackingNumber: "BD80431255871", deliverIn: 2, hub: "Chennai Hub", town: "Guindy, Chennai", recipient: "Venkatesh Rao" });
    const mv = await post("/scm/warehouse/movements", {
      warehouseId: ctx.wh.chennai, notes: "Consolidating overflow bin",
      items: [{ productId: pid("bearing"), quantity: 50, sourceLocationId: ctx.bin["chennai:Z01-R01-S01-B02"], destinationLocationId: ctx.bin["chennai:Z01-R01-S02-B03"] }],
    });
    await post(`/scm/warehouse/movements/${mv.id}/submit`);
    await post(`/scm/warehouse/movements/${mv.id}/approve`);
    await post(`/scm/warehouse/movements/${mv.id}/complete`);
    return sh.id;
  });

  // ---- Procurement cycle 3: valves + serial-tracked motors, incoming QC pass --------------------
  const c3 = await step("cycle3", async () => {
    log("Procurement cycle 3: valves + serial-tracked motors, incoming QC pass...");
    const po = await purchaseOrder(ctx, { vendor: "hydrotech", wh: "chennai", lines: [{ p: "valve", qty: 40, unitPrice: 2380 }, { p: "motor", qty: 5, unitPrice: 9650 }], freight: 2500, daysAgo: 44, expectedIn: 8, paymentTerms: "Net 45" });
    return { poId: po.id };
  });

  await step("so6", async () => {
    const so = await salesOrder(ctx, { customer: "apex", lines: [{ p: "housing", qty: 100 }, { p: "cable", qty: 300 }], daysAgo: 41, requiredIn: 6 });
    const f = await startFulfillment(ctx, so, "chennai");
    await adjustment(ctx, { p: "gloves", wh: "chennai", direction: "OUT", qty: 5, reason: "Physical Count Difference", notes: "Quarterly cycle count - 5 boxes short", approve: true });
    const sh = await pickPackShip(ctx, f.id);
    await ship(ctx, sh.id, { carrier: "VRL", service: "STANDARD", trackingNumber: "VRL-LR-570244", deliverIn: 4, hub: "Pune Hub", town: "Bhosari, Pune", recipient: "Neha Deshpande" });
    return sh.id;
  });

  await step("grn3", async () => {
    const grn = await receive(c3.poId, 35, [
      { index: 0, receive: 40 },
      { index: 1, receive: 5, serials: ["MTR2H-2608-0001", "MTR2H-2608-0002", "MTR2H-2608-0003", "MTR2H-2608-0004", "MTR2H-2608-0005"] },
    ], "Motors received with test certificates.");
    const qc = await post("/scm/quality/inspections", { inspectionType: "INCOMING", sourceId: grn.id, templateId: T["TPL-INC-GEN"].id, priority: "MEDIUM", notes: "Motors: insulation resistance and no-load run test" });
    await inspect(qc.id, T["TPL-INC-GEN"], [
      { inspectedQuantity: 40, acceptedQuantity: 40, rejectedQuantity: 0, condition: "NEW", disposition: "ACCEPT" },
      { inspectedQuantity: 5, acceptedQuantity: 5, rejectedQuantity: 0, condition: "NEW", disposition: "ACCEPT", notes: "IR > 100 MOhm on all units" },
    ]);
    await putaway(ctx, grn, [
      { p: "valve", qty: 40, bin: "chennai:Z01-R01-S02-B03" },
      { p: "motor", qty: 5, bin: "chennai:Z01-R01-S02-B04" },
    ]);
    return grn.id;
  });

  // ---- Procurement cycle 4: housings + seals from Metro - supplier is late (overdue) -------------
  const c4 = await step("cycle4", async () => {
    log("Procurement cycle 4: housings + seal kits from Metro (overdue)...");
    const po = await purchaseOrder(ctx, { vendor: "metro", wh: "chennai", lines: [{ p: "housing", qty: 500, unitPrice: 628 }, { p: "seal", qty: 200, unitPrice: 92 }], freight: 4000, daysAgo: 30, expectedIn: 18, paymentTerms: "Net 30", notes: "Urgent - housing stock running low" });
    return { poId: po.id };
  });
  void c4;

  await step("so7", async () => {
    const so = await salesOrder(ctx, { customer: "kaveri", lines: [{ p: "bearing", qty: 200 }, { p: "valve", qty: 5 }], daysAgo: 27, requiredIn: 5 });
    const f = await startFulfillment(ctx, so, "chennai");
    const sh = await pickPackShip(ctx, f.id);
    await ship(ctx, sh.id, { carrier: "DELHIVERY", service: "STANDARD", trackingNumber: "DLV5540160045", deliverIn: 3, hub: "Coimbatore Hub", town: "Avinashi Road, Coimbatore", recipient: "Murali Krishnan" });
    return { soId: so.id, fId: f.id, shId: sh.id };
  }).then((s) => (ctx.s7 = s));

  // ---- Delivery exception with re-attempt -----------------------------------------------------------
  await step("so8", async () => {
    const so = await salesOrder(ctx, { customer: "deccan", lines: [{ p: "bearing", qty: 100 }, { p: "housing", qty: 40 }], daysAgo: 18, requiredIn: 5 });
    const f = await startFulfillment(ctx, so, "chennai");
    const sh = await pickPackShip(ctx, f.id);
    await dispatch(ctx, sh.id, "BLUEDART", "EXPRESS", 2, "BD80431366102");
    await moveShipment(sh.id, "IN_TRANSIT", "Hyderabad Hub", "In transit");
    await moveShipment(sh.id, "OUT_FOR_DELIVERY", "Cherlapally, Hyderabad", "Out for delivery");
    await post(`/scm/shipments/${sh.id}/exception`, { exceptionCode: "CUSTOMER_UNAVAILABLE", description: "Receiving dock closed - stock-taking in progress" });
    const detail = await get(`/scm/shipments/${sh.id}`);
    const ex = (detail.exceptions ?? []).find((e) => !e.resolvedAt);
    if (!ex) throw new Error("Delivery exception not found on shipment");
    await post(`/scm/shipments/${sh.id}/exceptions/${ex.id}/resolve`, { resolution: "Customer confirmed next-day delivery slot 10:00-12:00" });
    await moveShipment(sh.id, "OUT_FOR_DELIVERY", "Cherlapally, Hyderabad", "Re-attempt: out for delivery");
    await deliver(sh.id, "Srinivas Reddy", "Delivered on second attempt");
    return sh.id;
  });

  const s9 = await step("so9", async () => {
    const so = await salesOrder(ctx, { customer: "balaji", lines: [{ p: "bearing", qty: 150 }, { p: "cable", qty: 200 }], daysAgo: 14, requiredIn: 5 });
    const f = await startFulfillment(ctx, so, "chennai");
    const sh = await pickPackShip(ctx, f.id);
    await ship(ctx, sh.id, { carrier: "DELHIVERY", service: "STANDARD", trackingNumber: "DLV5540201198", deliverIn: 2, hub: "Chennai Hub", town: "Guindy, Chennai", recipient: "Venkatesh Rao" });
    return { fId: f.id, shId: sh.id };
  });

  // ---- Inventory QC audit puts housings on hold; cable replenishment PO -------------------------------
  const po6 = await step("po6", async () => {
    log("Inventory QC audit puts 25 housings on hold (quarantine)...");
    const qc = await post("/scm/quality/inspections", {
      inspectionType: "INVENTORY", productId: pid("housing"), warehouseId: ctx.wh.chennai, quantity: 25, templateId: T["TPL-INV-AUD"].id,
      priority: "HIGH", notes: "Customer complaint on porosity - audit of opening-stock lot",
    });
    await inspect(qc.id, T["TPL-INV-AUD"], [{
      inspectedQuantity: 25, acceptedQuantity: 0, rejectedQuantity: 0, manualHold: true, condition: "UNKNOWN", defectCode: "SURF-POR",
      defectDescription: "Suspected sub-surface porosity - awaiting X-ray report", disposition: "QUARANTINE",
      notes: "Held pending X-ray from the foundry lab.", failing: ["Surface porosity check"],
    }]);
    const po = await purchaseOrder(ctx, { vendor: "southern", wh: "chennai", lines: [{ p: "cable", qty: 1000, unitPrice: 41.5 }], daysAgo: 12, expectedIn: 8, paymentTerms: "Net 30", notes: "Replenishment at last quoted rate" });
    return { poId: po.id };
  });

  // ---- Work in flight - the live-demo starting points ---------------------------------------------------
  log("In-flight work for the live demo (pending approvals, open RFQ, backorder, returns, etc.)...");
  await step("pr3", async () => {
    const pr = await requisition(ctx, { wh: "chennai", lines: [{ p: "seal", qty: 300 }, { p: "gloves", qty: 20 }], priority: "Normal", department: "Stores", purpose: "Monthly consumables top-up", requiredIn: 10, daysAgo: 9 });
    return pr.id;
  });
  const cr2 = await step("cr2", async () => {
    const cr = await post("/scm/returns/customer", {
      fulfillmentId: ctx.s7.fId, shipmentId: ctx.s7.shId, reasonCode: "DEFECTIVE",
      reasonDescription: "20 bearings noisy on spin test at customer incoming inspection", items: [{ productId: pid("bearing"), requestedQuantity: 20 }],
    });
    await post(`/scm/returns/${cr.id}/submit`);
    await post(`/scm/returns/${cr.id}/approve`);
    await post(`/scm/returns/${cr.id}/in-transit`, { carrier: "Delhivery", trackingNumber: "DLV5540288731" });
    return cr.id;
  });
  const rfq3 = await step("rfq3", async () => {
    const pr = await requisition(ctx, { wh: "chennai", lines: [{ p: "bearing", qty: 1500, estCost: 180 }], priority: "High", department: "Stores", purpose: "Q3 bearing demand - rate contract renewal", requiredIn: 12, approve: true, daysAgo: 8 });
    const r = await rfq(ctx, { pr, vendors: ["precision", "metro"], wh: "chennai", lines: [{ p: "bearing", qty: 1500 }], daysAgo: 7, dueIn: 4, paymentTerms: "Net 30", deliveryTerms: "Door delivery, Chennai", notes: "Quote for 12-month rate contract" });
    return r.id;
  });
  await step("so10", async () => {
    const so = await salesOrder(ctx, { customer: "apex", lines: [{ p: "housing", qty: 60 }, { p: "valve", qty: 6 }], daysAgo: 8, requiredIn: 4 });
    const f = await startFulfillment(ctx, so, "chennai");
    const sh = await pickPackShip(ctx, f.id);
    await dispatch(ctx, sh.id, "VRL", "STANDARD", 3, "VRL-LR-588410");
    await moveShipment(sh.id, "IN_TRANSIT", "Pune Hub", "In transit - line-haul delayed by weather");
    return sh.id;
  });
  await step("cr2-receive", async () => {
    await post(`/scm/returns/${cr2}/receive`, {});
    await post(`/scm/returns/${cr2}/start-inspection`);
    await post("/scm/quality/inspections", { inspectionType: "CUSTOMER_RETURN", sourceId: cr2, templateId: T["TPL-RET-CUS"].id, priority: "HIGH", notes: "Spin-test every returned bearing" });
    return true;
  });
  await step("po5", async () => {
    const po = await purchaseOrder(ctx, { vendor: "hydrotech", wh: "chennai", lines: [{ p: "valve", qty: 20, unitPrice: 2380 }, { p: "seal", qty: 100, unitPrice: 90 }], daysAgo: 6, expectedIn: 7, paymentTerms: "Net 45", stage: "pending" });
    return po.id; // left at PENDING_APPROVAL
  });
  await step("cr3", async () => {
    const cr = await post("/scm/returns/customer", {
      fulfillmentId: s9.fId, shipmentId: s9.shId, reasonCode: "WRONG_QUANTITY",
      reasonDescription: "Customer ordered 175 m; 25 m excess delivered", items: [{ productId: pid("cable"), requestedQuantity: 25 }],
    });
    await post(`/scm/returns/${cr.id}/submit`);
    return cr.id; // left PENDING_APPROVAL
  });
  await step("so11", async () => {
    const so = await salesOrder(ctx, { customer: "kaveri", lines: [{ p: "bearing", qty: 80 }], daysAgo: 5, requiredIn: 3 });
    const f = await startFulfillment(ctx, so, "chennai");
    await pickPackShip(ctx, f.id); // shipment waits at READY_TO_SHIP for a carrier
    return so.id;
  });
  await step("grn4", async () => {
    const grn = await receive(po6.poId, 4, [{ index: 0, receive: 1000, batch: "SCW-2609-B" }], "Replacement lot - inspect before put-away.");
    await post("/scm/quality/inspections", { inspectionType: "INCOMING", sourceId: grn.id, templateId: T["TPL-INC-GEN"].id, priority: "HIGH", notes: "Tightened inspection after the INS-CRACK finding on SCW-2605-A" });
    await putaway(ctx, grn, [], { start: false }); // put-away left PENDING
    return grn.id;
  });
  await step("rfq3-quotes", async () => {
    await quotation(ctx, { rfqId: rfq3, vendor: "precision", ref: "PBI/RC/26-27/044", lines: [{ p: "bearing", qty: 1500, unitPrice: 176, deliveryIn: 10 }], discount: 3000, daysAgo: 4, validFor: 30, paymentTerms: "Net 30", deliveryTerms: "Free delivery, staggered monthly", notes: "Rate held for 12 months" });
    await quotation(ctx, { rfqId: rfq3, vendor: "metro", ref: "MIS-QT-4610", lines: [{ p: "bearing", qty: 1500, unitPrice: 171, deliveryIn: 16 }], freight: 6000, daysAgo: 3, validFor: 15, paymentTerms: "Net 30", deliveryTerms: "Ex-works + freight" });
    return true;
  });
  await step("so12", async () => {
    const so = await salesOrder(ctx, { customer: "deccan", lines: [{ p: "housing", qty: 30 }, { p: "seal", qty: 5 }], daysAgo: 4, requiredIn: 3 });
    const f = await startFulfillment(ctx, so, "chennai");
    await post(`/scm/fulfillments/${f.id}/pick-list`); // pick list left PENDING
    return so.id;
  });
  await step("so13", async () => {
    const so = await salesOrder(ctx, { customer: "deccan", lines: [{ p: "pump", qty: 6 }], daysAgo: 3, requiredIn: 10 });
    const f = await startFulfillment(ctx, so, "chennai", { reserve: false }); // pumps are out of stock -> backorder
    await post(`/scm/fulfillments/${f.id}/shortage-requisition`);
    return so.id;
  });
  await step("tail", async () => {
    await salesOrder(ctx, { customer: "balaji", lines: [{ p: "bearing", qty: 120 }, { p: "seal", qty: 8 }], daysAgo: 2, requiredIn: 5 });
    await transfer(ctx, { p: "housing", from: "chennai", to: "bengaluru", qty: 40, notes: "Stock Bengaluru for Apex Pune orders", upTo: "requested" });
    await adjustment(ctx, { p: "seal", wh: "chennai", direction: "IN", qty: 3, reason: "Found Stock", notes: "Found 3 kits in the maintenance crib during audit", approve: false });
    const vr = await post("/scm/returns/vendor", {
      grnId: g2a.grnId, reasonCode: "DEFECTIVE", reasonDescription: "Bearings with rough rotation traced to lot 1",
      items: [{ grnItemId: g2a.itemId, requestedQuantity: 30 }],
    });
    await post(`/scm/returns/${vr.id}/submit`);
    return true;
  });
}

// ---- supplier finance ----------------------------------------------------------------

/** A minimal single-page PDF with a title and a few lines of text, built by
 * hand so the demo documents are real, openable files (not zero-byte stubs). */
function makePdf(title, lines) {
  const esc = (t) => t.replace(/[\\()]/g, "\\$&");
  const content = [
    "BT /F1 18 Tf 56 760 Td (" + esc(title) + ") Tj ET",
    ...lines.map((l, i) => "BT /F1 11 Tf 56 " + (720 - i * 18) + " Td (" + esc(l) + ") Tj ET"),
  ].join("\n");
  const objs = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
    "<< /Length " + Buffer.byteLength(content) + " >>\nstream\n" + content + "\nendstream",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  let out = "%PDF-1.4\n";
  const offsets = [];
  objs.forEach((o, i) => {
    offsets.push(Buffer.byteLength(out));
    out += i + 1 + " 0 obj\n" + o + "\nendobj\n";
  });
  const xref = Buffer.byteLength(out);
  out += "xref\n0 " + (objs.length + 1) + "\n0000000000 65535 f \n";
  for (const off of offsets) out += String(off).padStart(10, "0") + " 00000 n \n";
  out += "trailer\n<< /Size " + (objs.length + 1) + " /Root 1 0 R >>\nstartxref\n" + xref + "\n%%EOF\n";
  return Buffer.from(out, "latin1");
}

async function uploadDocument(supplierId, { name, documentType, fileName, title, lines }) {
  const form = new FormData();
  form.append("file", new Blob([makePdf(title, lines)], { type: "application/pdf" }), fileName);
  form.append("name", name);
  form.append("documentType", documentType);
  const res = await fetch(`${API}/scm/suppliers/${supplierId}/documents`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  const json = await res.json().catch(() => ({}));
  if (res.status !== 201) {
    throw new Error(`POST documents -> ${res.status} ${JSON.stringify(json).slice(0, 300)}`);
  }
  return json.data;
}

const r2 = (n) => Math.round(n * 100) / 100;

async function playFinance(ctx) {
  const need = ["cycle1", "cycle2", "cycle3", "po6", "grn1", "grn3", "grn4"];
  if (!need.every((k) => state[k])) {
    log("Supplier finance: skipped (the procurement story is not in this database).");
    return;
  }
  log("Supplier finance: bills, payments and documents...");
  const F = "/scm/finance";
  const sup = (k) => ctx.vendor[k].id;
  const poTotals = async (poId) => {
    const po = await get(`${P}/purchase-orders/${poId}`);
    return {
      subtotal: r2(Number(po.subtotal) + Number(po.freight) - Number(po.discount)),
      tax: r2(Number(po.taxAmount)),
    };
  };
  const pay = (supplier, billId, daysAgo, mode, amount, referenceNumber, notes) =>
    post(`${F}/payments`, {
      supplierId: supplier,
      ...(billId ? { billId } : {}),
      paymentDate: ago(daysAgo),
      mode,
      amount,
      ...(referenceNumber ? { referenceNumber } : {}),
      ...(notes ? { notes } : {}),
    });

  // 1. Cable lot: billed on the 1,950 m actually accepted, settled in two payments -> PAID.
  await step("fin-bill-cable", async () => {
    const subtotal = r2(1950 * 41.5);
    const bill = await post(`${F}/bills`, {
      supplierId: sup("southern"),
      purchaseOrderId: state.cycle1.poId,
      goodsReceiptId: state.grn1.grnId,
      supplierBillNumber: "SCW/INV/2605/0412",
      billDate: ago(84),
      subtotal,
      taxAmount: r2(subtotal * 0.18),
      notes: "Billed on accepted quantity (1,950 m); 50 m dock rejection deducted.",
    });
    await pay(sup("southern"), bill.id, 60, "BANK_TRANSFER", 50000, "UTR2610048820117", "Part payment");
    await pay(sup("southern"), bill.id, 45, "BANK_TRANSFER", r2(Number(bill.total) - 50000), "UTR2610051193342", "Balance - settled in full");
    return bill.id;
  });

  // 2. Bearings lot: part-paid and now past due -> overdue.
  await step("fin-bill-bearings", async () => {
    const t = await poTotals(state.cycle2.poId);
    const bill = await post(`${F}/bills`, {
      supplierId: sup("precision"),
      purchaseOrderId: state.cycle2.poId,
      supplierBillNumber: "PBI/26-27/INV/0831",
      billDate: ago(58),
      subtotal: t.subtotal,
      taxAmount: t.tax,
      notes: "Rate contract RC-PBI-2026, both lots.",
    });
    await pay(sup("precision"), bill.id, 30, "BANK_TRANSFER", 100000, "UTR2610077301554", "Part payment against invoice");
    return bill.id;
  });

  // 3. Valves + motors: open, not yet due.
  await step("fin-bill-valves", async () => {
    const t = await poTotals(state.cycle3.poId);
    const bill = await post(`${F}/bills`, {
      supplierId: sup("hydrotech"),
      purchaseOrderId: state.cycle3.poId,
      goodsReceiptId: state.grn3,
      supplierBillNumber: "HFS/2608/1177",
      billDate: ago(33),
      subtotal: t.subtotal,
      taxAmount: t.tax,
    });
    return bill.id;
  });

  // 4. Replacement cable lot: open; a payment keyed against the wrong bill is voided.
  await step("fin-bill-cable-2", async () => {
    const t = await poTotals(state.po6.poId);
    const bill = await post(`${F}/bills`, {
      supplierId: sup("southern"),
      purchaseOrderId: state.po6.poId,
      goodsReceiptId: state.grn4,
      supplierBillNumber: "SCW/INV/2609/0733",
      billDate: ago(3),
      subtotal: t.subtotal,
      taxAmount: t.tax,
    });
    const wrong = await pay(sup("southern"), bill.id, 2, "UPI", 20000, "UPI/4401227190", "Part payment");
    await post(`${F}/payments/${wrong.id}/void`, {
      reason: "Entered against the wrong bill - to be re-posted once the lot clears QC.",
    });
    return bill.id;
  });

  // 5. A duplicate keying of the first invoice, cancelled.
  await step("fin-bill-duplicate", async () => {
    const bill = await post(`${F}/bills`, {
      supplierId: sup("southern"),
      supplierBillNumber: "SCW/INV/2605/0412-DUP",
      billDate: ago(83),
      subtotal: 80925,
      taxAmount: 14566.5,
    });
    await post(`${F}/bills/${bill.id}/cancel`, { reason: "Duplicate entry - the same invoice was keyed twice." });
    return bill.id;
  });

  // 6. Advance paid to a supplier ahead of any bill.
  await step("fin-advance", async () => {
    const p = await pay(sup("hydrotech"), null, 10, "CHEQUE", 25000, "CHQ 004417", "Advance against the next valve order");
    return p.id;
  });

  // 7. Supplier documents (real, openable PDFs).
  await step("fin-docs", async () => {
    const docs = [
      ["precision", { name: "GST registration certificate", documentType: "GST_CERTIFICATE", fileName: "pbi-gst-certificate.pdf", title: "GST Registration Certificate (demo)", lines: ["Legal name: Precision Bearings India Pvt Ltd", "GSTIN: 33AAECP4821K1Z6", "State: Tamil Nadu", "Fictional document generated for the SCM demo."] }],
      ["precision", { name: "PAN card", documentType: "PAN", fileName: "pbi-pan.pdf", title: "Permanent Account Number (demo)", lines: ["Name: Precision Bearings India Pvt Ltd", "PAN: AAECP4821K", "Fictional document generated for the SCM demo."] }],
      ["southern", { name: "Supply agreement 2026-27", documentType: "CONTRACT", fileName: "scw-supply-agreement.pdf", title: "Supply Agreement 2026-27 (demo)", lines: ["Parties: Texawave Innovations and Southern Cables & Wires", "Scope: FRLS copper cable, ISI marked", "Payment terms: Net 30", "Fictional document generated for the SCM demo."] }],
      ["southern", { name: "ISI compliance certificate", documentType: "COMPLIANCE", fileName: "scw-isi-certificate.pdf", title: "ISI Compliance Certificate (demo)", lines: ["Product: Copper power cable 4 sq.mm", "Valid until: 2027-09-30", "Under review after the INS-CRACK findings on lot SCW-2605-A.", "Fictional document generated for the SCM demo."] }],
      ["hydrotech", { name: "Bank account details", documentType: "BANK_DETAILS", fileName: "hfs-bank-details.pdf", title: "Bank Account Details (demo)", lines: ["Account name: Hydrotech Fluid Systems", "Bank: Example Bank, Coimbatore", "IFSC: EXMP0001234", "Fictional document generated for the SCM demo."] }],
    ];
    const ids = [];
    for (const [vendor, doc] of docs) ids.push((await uploadDocument(sup(vendor), doc)).id);
    return ids;
  });
}

// ---- main ----------------------------------------------------------------------------------

async function main() {
  token = (await call("POST", "/auth/login", { organizationSlug: ORG, email: EMAIL, password: PASSWORD })).accessToken;

  if (process.env.SEED_FORCE !== "1" && existsSync(STATE_FILE)) {
    try {
      state = JSON.parse(readFileSync(STATE_FILE, "utf8"));
    } catch {
      state = {};
    }
    // A stale state file from a wiped database must not suppress the seed.
    if (Object.keys(state).length > 0 && !(await findByCode("/scm/suppliers", "supplierCode", "SUP-PBI"))) state = {};
  }
  const alreadyDone = Boolean(state.__done) && Boolean(state["fin-docs"]);
  if (alreadyDone) {
    log("Demo data already present - nothing to do.");
    return;
  }

  const ctx = { wh: {}, bin: {}, product: {}, vendor: {}, customer: {}, carrier: {}, template: {} };
  // Master ids (bins, templates...) are only created once, so they are
  // persisted with the step results.
  if (state.__masters) Object.assign(ctx, state.__masters);
  else {
    await ensureMasters(ctx);
    state.__masters = ctx;
    saveState();
  }

  if (!state.__done) {
    await play(ctx);
    state.__done = true;
    saveState();
  }
  await playFinance(ctx);

  log("Done: 2 warehouses with bin layout, 5 suppliers, 4 customers, 3 carriers, 8 products, 6 QC defects, 4 QC templates, a ~4-month story of POs/GRNs/QC/returns/sales/shipments, in-flight demo work, and supplier bills/payments/documents.");
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
