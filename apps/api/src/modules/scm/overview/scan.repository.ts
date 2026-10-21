import { Injectable } from "@nestjs/common";
import { OrgScoped } from "../../../common/decorators/org-scoped.decorator.js";
import type { OrgScope } from "../../../common/tenancy/org-scope.js";
import { PrismaService } from "../../../shared/prisma/prisma.service.js";

/** Every kind of SCM record a scanned/typed code can resolve to. */
export type ScanType =
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

export interface ScanField {
  label: string;
  value: string;
}

export interface ScanResult {
  type: ScanType;
  /** The code that was matched. */
  code: string;
  title: string;
  subtitle?: string | undefined;
  fields: ScanField[];
  viewPath?: string | undefined;
  viewLabel?: string | undefined;
  actions?: { label: string; path: string }[] | undefined;
  /** Present when the same code matched more than one record. */
  alternatives?: ScanResult[] | undefined;
}

interface QrPayload {
  scm: 1;
  type: ScanType;
  code: string;
  id?: string;
}

const EXPIRY_SOON_DAYS = 30;
const n = (v: { toString(): string } | null | undefined) => Number(v ?? 0);
const when = (d: Date | null | undefined) =>
  d ? d.toLocaleString("en-IN") : "—";
const ymd = (d: Date | null | undefined) =>
  d ? d.toISOString().slice(0, 10) : "";

/** A QR this app printed is either a small JSON payload or (for a product) a
 * URL to the inventory page; anything else is plain text. */
export function parseQrPayload(raw: string): QrPayload | null {
  const trimmed = raw.trim();
  if (trimmed.startsWith("{")) {
    try {
      const obj = JSON.parse(trimmed) as Partial<QrPayload>;
      if (
        obj &&
        obj.scm === 1 &&
        typeof obj.type === "string" &&
        typeof obj.code === "string"
      ) {
        return obj as QrPayload;
      }
    } catch {
      /* not JSON — falls through to a text search */
    }
    return null;
  }
  const match = trimmed.match(
    /\/scm\/inventory\/overview\/([^/?#]+)\/?(?:[?#].*)?$/,
  );
  if (match) {
    try {
      return { scm: 1, type: "PRODUCT", code: decodeURIComponent(match[1]!) };
    } catch {
      return null;
    }
  }
  return null;
}

function expiryText(
  batches: { batchNumber: string; expiryDate: Date | null }[],
  product: { expiryDate: Date | null; expiryNotApplicable: boolean },
): string {
  const status = (d: Date) => {
    const days = Math.round((d.getTime() - Date.now()) / 86_400_000);
    return days < 0
      ? "Expired"
      : days <= EXPIRY_SOON_DAYS
        ? "Expiring Soon"
        : "Valid";
  };
  const dated = batches.filter((b) => b.expiryDate);
  if (dated.length > 0) {
    const dates = new Set(dated.map((b) => ymd(b.expiryDate)));
    if (dates.size === 1) {
      return `${[...dates][0]} (${status(dated[0]!.expiryDate as Date)})`;
    }
    const counts = new Map<string, number>();
    for (const b of dated) {
      const s = status(b.expiryDate as Date);
      counts.set(s, (counts.get(s) ?? 0) + 1);
    }
    return `${dated.length} batches: ${[...counts].map(([s, c]) => `${c} ${s}`).join(", ")}`;
  }
  if (product.expiryNotApplicable) return "Not applicable";
  if (product.expiryDate)
    return `${ymd(product.expiryDate)} (${status(product.expiryDate)})`;
  return "Not set";
}

export interface ProductBinEntry {
  locationId: number | null;
  /** "Chennai WH → Rack R02 → Bin B015 (Qty: 12)" */
  path: string;
  quantity: number | null;
  /** False for the warehouse-only fallback (no bin recorded yet). */
  exact: boolean;
}

export interface BarcodeProductRow {
  id: number;
  productCode: string;
  name: string;
  category: string | null;
  /** The assigned barcode, or null when the code is derived from the SKU. */
  barcode: string | null;
  /** What gets encoded: the assigned barcode, else the product code. */
  barcodeValue: string;
  barcodeCreatedAt: string | null;
  bins: ProductBinEntry[];
  expiry: {
    source: "BATCH" | "PRODUCT" | "NOT_APPLICABLE" | "NOT_SET";
    date: string | null;
    status: "EXPIRED" | "EXPIRING_SOON" | "VALID" | null;
    text: string;
    batches: { batchNumber: string; expiryDate: string }[];
  };
  lastUpdated: string;
}

/** The single place a scanned/typed code is turned into an SCM record. Never
 * fabricates a result — an unmatched code resolves to type UNKNOWN. */
@Injectable()
export class ScanRepository {
  constructor(private readonly prisma: PrismaService) {}

  @OrgScoped()
  async scan(scope: OrgScope, rawCode: string): Promise<ScanResult> {
    const code = rawCode.trim();
    if (!code) return this.unknown(code);
    const org = scope.organizationId;
    const payload = parseQrPayload(code);

    // Structured-QR fast path: run only the matcher the payload names.
    if (payload && payload.type !== "UNKNOWN") {
      const hits = await this.match(
        org,
        payload.type,
        payload.code,
        payload.id,
      );
      if (hits.length === 1) return hits[0]!;
      if (hits.length > 1) return { ...hits[0]!, alternatives: hits };
    }

    const search = payload?.code ?? code;
    const hits: ScanResult[] = [];
    // Resolution order an operator scans most often.
    for (const type of [
      "PRODUCT",
      "BATCH",
      "SERIAL",
      "LOCATION",
      "PURCHASE_ORDER",
      "GRN",
      "SALES_ORDER",
      "SHIPMENT",
      "RETURN",
      "WAREHOUSE",
      "SUPPLIER",
      "PURCHASE_REQUISITION",
      "RFQ",
      "PICK_LIST",
      "PACKAGE",
      "QC_INSPECTION",
      "QUARANTINE",
    ] as const) {
      hits.push(...(await this.match(org, type, search)));
    }
    if (hits.length === 0) return this.unknown(code);
    if (hits.length === 1) return hits[0]!;
    return { ...hits[0]!, alternatives: hits };
  }

  /** Products with their barcode, where they sit and expiry — the Barcode
   * Utilities table. Bins come from real per-bin stock, else the default bin,
   * else just the warehouses that hold stock. */
  @OrgScoped()
  async productUtilities(
    scope: OrgScope,
    q: string | undefined,
  ): Promise<BarcodeProductRow[]> {
    const org = scope.organizationId;
    const products = await this.prisma.scmProduct.findMany({
      where: {
        organizationId: org,
        deletedAt: null,
        ...(q
          ? {
              OR: [
                { productCode: { contains: q, mode: "insensitive" } },
                { name: { contains: q, mode: "insensitive" } },
                { barcode: { contains: q, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      orderBy: { name: "asc" },
      take: 100,
    });
    const ids = products.map((p) => p.id);
    const [balances, binRows, batches, defaultBins] = await Promise.all([
      this.prisma.scmStockBalance.findMany({
        where: { organizationId: org, productId: { in: ids } },
        include: { warehouse: { select: { name: true } } },
      }),
      this.prisma.scmLocationStock.findMany({
        where: {
          organizationId: org,
          productId: { in: ids },
          quantity: { gt: 0 },
        },
        include: {
          location: {
            select: { id: true, locationCode: true, binCode: true, rack: true },
          },
          warehouse: { select: { name: true } },
        },
      }),
      this.prisma.scmStockBatch.findMany({
        where: {
          organizationId: org,
          productId: { in: ids },
          expiryDate: { not: null },
        },
        select: { productId: true, batchNumber: true, expiryDate: true },
      }),
      this.prisma.scmWarehouseLocation.findMany({
        where: {
          id: {
            in: products
              .map((p) => p.binLocationId)
              .filter((x): x is number => x !== null),
          },
        },
        include: { warehouse: { select: { name: true } } },
      }),
    ]);
    const defaultBinById = new Map(defaultBins.map((b) => [b.id, b]));
    const statusOf = (d: Date): "EXPIRED" | "EXPIRING_SOON" | "VALID" => {
      const days = Math.round((d.getTime() - Date.now()) / 86_400_000);
      return days < 0
        ? "EXPIRED"
        : days <= EXPIRY_SOON_DAYS
          ? "EXPIRING_SOON"
          : "VALID";
    };
    const label = {
      EXPIRED: "Expired",
      EXPIRING_SOON: "Expiring Soon",
      VALID: "Valid",
    } as const;

    return products.map((p) => {
      const pBalances = balances.filter((b) => b.productId === p.id);
      const pBins = binRows.filter((b) => b.productId === p.id);
      const pBatches = batches.filter((b) => b.productId === p.id);

      let bins: ProductBinEntry[] = pBins.map((r) => ({
        locationId: r.locationId,
        path: `${r.warehouse.name}${r.location.rack ? ` → Rack ${r.location.rack}` : ""} → Bin ${r.location.locationCode ?? r.location.binCode} (Qty: ${n(r.quantity)})`,
        quantity: n(r.quantity),
        exact: true,
      }));
      if (bins.length === 0 && p.binLocationId) {
        const b = defaultBinById.get(p.binLocationId);
        if (b) {
          bins = [
            {
              locationId: b.id,
              path: `${b.warehouse.name}${b.rack ? ` → Rack ${b.rack}` : ""} → Bin ${b.locationCode ?? b.binCode}`,
              quantity: null,
              exact: true,
            },
          ];
        }
      }
      if (bins.length === 0) {
        bins = pBalances
          .filter((b) => n(b.onHand) > 0)
          .map((b) => ({
            locationId: null,
            path: `${b.warehouse.name} (Qty: ${n(b.onHand)}) — bin not recorded yet`,
            quantity: n(b.onHand),
            exact: false,
          }));
      }

      let expiry: BarcodeProductRow["expiry"];
      if (pBatches.length > 0) {
        const entries = pBatches.map((b) => ({
          batchNumber: b.batchNumber,
          expiryDate: ymd(b.expiryDate),
          status: statusOf(b.expiryDate as Date),
        }));
        const dates = new Set(entries.map((e) => e.expiryDate));
        let text: string;
        let status: "EXPIRED" | "EXPIRING_SOON" | "VALID" | null = null;
        let date: string | null = null;
        if (dates.size === 1) {
          date = entries[0]!.expiryDate;
          status = entries[0]!.status;
          text = `${date} (${label[status]})`;
        } else {
          const counts = new Map<string, number>();
          for (const e of entries)
            counts.set(e.status, (counts.get(e.status) ?? 0) + 1);
          text = `${entries.length} batches: ${(
            ["EXPIRED", "EXPIRING_SOON", "VALID"] as const
          )
            .filter((k) => counts.get(k))
            .map((k) => `${counts.get(k)} ${label[k]}`)
            .join(", ")}`;
        }
        expiry = {
          source: "BATCH",
          date,
          status,
          text,
          batches: entries.map(({ batchNumber, expiryDate }) => ({
            batchNumber,
            expiryDate,
          })),
        };
      } else if (p.expiryNotApplicable) {
        expiry = {
          source: "NOT_APPLICABLE",
          date: null,
          status: null,
          text: "Not applicable",
          batches: [],
        };
      } else if (p.expiryDate) {
        const status = statusOf(p.expiryDate);
        expiry = {
          source: "PRODUCT",
          date: ymd(p.expiryDate),
          status,
          text: `${ymd(p.expiryDate)} (${label[status]})`,
          batches: [],
        };
      } else {
        expiry = {
          source: "NOT_SET",
          date: null,
          status: null,
          text: "Not set",
          batches: [],
        };
      }

      const assigned = (p.barcode ?? "").trim();
      return {
        id: p.id,
        productCode: p.productCode,
        name: p.name,
        category: p.category,
        barcode: assigned || null,
        barcodeValue: assigned || p.productCode,
        barcodeCreatedAt: p.barcodeCreatedAt
          ? p.barcodeCreatedAt.toISOString()
          : null,
        bins,
        expiry,
        lastUpdated: new Date(
          Math.max(
            p.updatedAt.getTime(),
            ...pBalances.map((b) => b.updatedAt.getTime()),
          ),
        ).toISOString(),
      };
    });
  }

  private unknown(code: string): ScanResult {
    return {
      type: "UNKNOWN",
      code,
      title: "No SCM record found",
      subtitle:
        "This barcode does not match any product, location, batch, serial or document.",
      fields: [],
    };
  }

  private async match(
    org: number,
    type: Exclude<ScanType, "UNKNOWN">,
    code: string,
    id?: string,
  ): Promise<ScanResult[]> {
    const eq = { equals: code, mode: "insensitive" as const };
    switch (type) {
      case "PRODUCT": {
        const numericId = /^\d+$/.test(code) ? Number(code) : undefined;
        const rows = await this.prisma.scmProduct.findMany({
          where: {
            organizationId: org,
            deletedAt: null,
            OR: [
              { productCode: eq },
              { barcode: eq },
              ...(numericId ? [{ id: numericId }] : []),
              ...(id && /^\d+$/.test(id) ? [{ id: Number(id) }] : []),
            ],
          },
        });
        return Promise.all(rows.map((p) => this.productResult(org, p)));
      }
      case "SUPPLIER": {
        const rows = await this.prisma.supplier.findMany({
          where: { organizationId: org, deletedAt: null, supplierCode: eq },
        });
        return rows.map((s) => ({
          type: "SUPPLIER",
          code: s.supplierCode,
          title: s.companyName,
          subtitle: `${s.supplierCode}${s.type ? ` · ${s.type}` : ""}`,
          fields: [
            { label: "Supplier Code", value: s.supplierCode },
            { label: "Company", value: s.companyName },
            { label: "Status", value: s.status },
            { label: "Contact", value: s.contactPerson || "—" },
            { label: "Phone", value: s.phone || "—" },
            { label: "Email", value: s.email || "—" },
            { label: "GSTIN", value: s.gstin || "—" },
          ],
          viewPath: `/scm/suppliers/${s.id}`,
          viewLabel: "View Supplier",
        }));
      }
      case "WAREHOUSE": {
        const rows = await this.prisma.scmWarehouse.findMany({
          where: { organizationId: org, deletedAt: null, code: eq },
        });
        return rows.map((w) => ({
          type: "WAREHOUSE",
          code: w.code,
          title: w.name,
          subtitle: `${w.code} · ${w.type}`,
          fields: [
            { label: "Code", value: w.code },
            { label: "Name", value: w.name },
            { label: "Type", value: w.type },
            { label: "Status", value: w.status },
            {
              label: "Address",
              value:
                [w.address, w.city, w.state, w.postalCode, w.country]
                  .filter(Boolean)
                  .join(", ") || "—",
            },
            { label: "Manager", value: w.managerName || "—" },
            { label: "Contact Person", value: w.contactPerson || "—" },
            { label: "Phone", value: w.phone || "—" },
            { label: "Email", value: w.email || "—" },
            {
              label: "Capacity",
              value: w.capacity
                ? `${n(w.capacity)} ${w.capacityUnit ?? ""}`.trim()
                : "—",
            },
            { label: "Operating Hours", value: w.operatingHours || "—" },
            { label: "Last Updated", value: when(w.updatedAt) },
          ],
          viewPath: "/scm/warehouses",
          viewLabel: "View Warehouses",
        }));
      }
      case "LOCATION": {
        const rows = await this.prisma.scmWarehouseLocation.findMany({
          where: {
            organizationId: org,
            deletedAt: null,
            OR: [
              { locationCode: eq },
              { binCode: eq },
              ...(id && /^\d+$/.test(id) ? [{ id: Number(id) }] : []),
            ],
          },
          include: {
            warehouse: { select: { name: true, code: true } },
            locationStock: {
              where: { quantity: { gt: 0 } },
              include: {
                product: { select: { productCode: true, name: true } },
              },
            },
          },
        });
        return rows.map((l) => ({
          type: "LOCATION",
          code: l.locationCode || l.binCode,
          title: l.locationCode || l.binCode,
          subtitle: `${l.warehouse.name} · ${l.locationType || "BIN"}`,
          fields: [
            { label: "Location Code", value: l.locationCode || l.binCode },
            { label: "Name", value: l.locationName || "—" },
            {
              label: "Warehouse",
              value: `${l.warehouse.name} (${l.warehouse.code})`,
            },
            { label: "Type", value: l.locationType || "BIN" },
            { label: "Rack", value: l.rack || "—" },
            { label: "Status", value: l.status },
            {
              label: "Capacity",
              value: l.capacity
                ? `${n(l.capacity)} ${l.capacityUnit ?? ""}`.trim()
                : "Unconfigured",
            },
            {
              label: "Stock stored here",
              value: l.locationStock.length
                ? l.locationStock
                    .map((s) => `${s.product.name} × ${n(s.quantity)}`)
                    .join("; ")
                : "None",
            },
          ],
          viewPath: "/scm/locations",
          viewLabel: "View Locations",
        }));
      }
      case "BATCH": {
        const rows = await this.prisma.scmStockBatch.findMany({
          where: { organizationId: org, batchNumber: eq },
          include: { product: true, warehouse: { select: { name: true } } },
        });
        return rows.map((b) => ({
          type: "BATCH",
          code: b.batchNumber,
          title: `Batch ${b.batchNumber}`,
          subtitle: `${b.product.name} · ${b.warehouse.name}`,
          fields: [
            {
              label: "Product",
              value: `${b.product.name} (${b.product.productCode})`,
            },
            { label: "Batch", value: b.batchNumber },
            { label: "Warehouse", value: b.warehouse.name },
            { label: "Quantity", value: String(n(b.quantity)) },
            {
              label: "Manufacturing Date",
              value: ymd(b.manufacturingDate) || "—",
            },
            { label: "Expiry Date", value: ymd(b.expiryDate) || "—" },
            { label: "Status", value: b.status },
          ],
          viewPath: "/scm/inventory/batches",
          viewLabel: "View Batches",
        }));
      }
      case "SERIAL": {
        const rows = await this.prisma.scmSerialNumber.findMany({
          where: { organizationId: org, serialNumber: eq },
          include: { product: true, warehouse: { select: { name: true } } },
        });
        return rows.map((s) => ({
          type: "SERIAL",
          code: s.serialNumber,
          title: `Serial ${s.serialNumber}`,
          subtitle: `${s.product.name} · ${s.warehouse.name}`,
          fields: [
            {
              label: "Product",
              value: `${s.product.name} (${s.product.productCode})`,
            },
            { label: "Serial Number", value: s.serialNumber },
            { label: "Warehouse", value: s.warehouse.name },
            { label: "Status", value: s.status },
            { label: "Reference", value: s.currentReference || "—" },
          ],
          viewPath: "/scm/inventory/serials",
          viewLabel: "View Serial Numbers",
        }));
      }
      case "PURCHASE_REQUISITION": {
        const rows = await this.prisma.scmPurchaseRequisition.findMany({
          where: { organizationId: org, requisitionNumber: eq },
          include: { items: true },
        });
        return rows.map((r) => ({
          type: "PURCHASE_REQUISITION",
          code: r.requisitionNumber,
          title: r.requisitionNumber,
          subtitle: `Material Requisition · ${r.status}`,
          fields: [
            { label: "MR Number", value: r.requisitionNumber },
            { label: "Requested By", value: r.requestedByName },
            { label: "Department", value: r.department || "—" },
            { label: "Status", value: r.status },
            { label: "Priority", value: r.priority },
            { label: "Items", value: String(r.items.length) },
            { label: "Request Date", value: ymd(r.requestDate) },
          ],
          viewPath: "/scm/procurement/requisitions",
          viewLabel: "View Requisitions",
        }));
      }
      case "RFQ": {
        const rows = await this.prisma.scmRfq.findMany({
          where: { organizationId: org, rfqNumber: eq },
          include: { items: true, suppliers: true },
        });
        return rows.map((r) => ({
          type: "RFQ",
          code: r.rfqNumber,
          title: r.rfqNumber,
          subtitle: `RFQ · ${r.status}`,
          fields: [
            { label: "RFQ Number", value: r.rfqNumber },
            { label: "Status", value: r.status },
            { label: "Suppliers", value: String(r.suppliers.length) },
            { label: "Items", value: String(r.items.length) },
            { label: "Issue Date", value: ymd(r.issueDate) },
            { label: "Response Due", value: ymd(r.responseDueDate) || "—" },
          ],
          viewPath: "/scm/procurement/rfqs",
          viewLabel: "View RFQs",
        }));
      }
      case "PURCHASE_ORDER": {
        const rows = await this.prisma.scmPurchaseOrder.findMany({
          where: { organizationId: org, poNumber: eq },
          include: { items: true },
        });
        return rows.map((p) => ({
          type: "PURCHASE_ORDER",
          code: p.poNumber,
          title: p.poNumber,
          subtitle: `${p.vendorNameSnapshot} · ${p.status}`,
          fields: [
            { label: "PO Number", value: p.poNumber },
            { label: "Supplier", value: p.vendorNameSnapshot },
            { label: "Status", value: p.status },
            { label: "Source MR", value: p.requisitionNumber || "—" },
            { label: "PO Date", value: ymd(p.poDate) },
            {
              label: "Expected Delivery",
              value: ymd(p.expectedDeliveryDate) || "—",
            },
            { label: "Items", value: String(p.items.length) },
            {
              label: "Total",
              value: `${p.currency} ${n(p.total).toLocaleString("en-IN")}`,
            },
          ],
          viewPath: "/scm/procurement/purchase-orders",
          viewLabel: "View Purchase Orders",
        }));
      }
      case "GRN": {
        const rows = await this.prisma.scmGoodsReceipt.findMany({
          where: { organizationId: org, grnNumber: eq },
          include: {
            items: true,
            purchaseOrder: { select: { poNumber: true } },
          },
        });
        return rows.map((g) => ({
          type: "GRN",
          code: g.grnNumber,
          title: g.grnNumber,
          subtitle: `${g.vendorNameSnapshot} · ${g.status}`,
          fields: [
            { label: "GRN Number", value: g.grnNumber },
            { label: "Purchase Order", value: g.purchaseOrder.poNumber },
            { label: "Supplier", value: g.vendorNameSnapshot },
            { label: "Receipt Date", value: ymd(g.receiptDate) },
            { label: "Received By", value: g.receivedByName },
            { label: "Lines", value: String(g.items.length) },
            {
              label: "Accepted / Rejected",
              value: `${g.items.reduce((s, i) => s + n(i.acceptedQuantity), 0)} / ${g.items.reduce((s, i) => s + n(i.rejectedQuantity), 0)}`,
            },
          ],
          viewPath: "/scm/procurement/goods-receipts",
          viewLabel: "View Goods Receipts",
        }));
      }
      case "SALES_ORDER": {
        const rows = await this.prisma.scmSalesOrder.findMany({
          where: { organizationId: org, soNumber: eq },
          include: { customer: { select: { name: true } }, items: true },
        });
        return rows.map((s) => ({
          type: "SALES_ORDER",
          code: s.soNumber,
          title: s.soNumber,
          subtitle: `${s.customer.name} · ${s.status}`,
          fields: [
            { label: "SO Number", value: s.soNumber },
            { label: "Customer", value: s.customer.name },
            { label: "Status", value: s.status },
            { label: "Items", value: String(s.items.length) },
          ],
          viewPath: "/scm/orders/sales-orders",
          viewLabel: "View Sales Orders",
        }));
      }
      case "PICK_LIST": {
        const rows = await this.prisma.scmPicking.findMany({
          where: { organizationId: org, pickNumber: eq },
          include: { items: true },
        });
        return rows.map((p) => ({
          type: "PICK_LIST",
          code: p.pickNumber,
          title: p.pickNumber,
          subtitle: `Pick list · ${p.status}`,
          fields: [
            { label: "Pick Number", value: p.pickNumber },
            { label: "Sales Order", value: p.salesOrderNumber },
            { label: "Status", value: p.status },
            { label: "Lines", value: String(p.items.length) },
          ],
          viewPath: "/scm/warehouse/picking",
          viewLabel: "View Picking",
        }));
      }
      case "PACKAGE": {
        const rows = await this.prisma.scmPackingPackage.findMany({
          where: { packageNumber: eq, packing: { organizationId: org } },
          include: { packing: true, items: true },
        });
        return rows.map((p) => ({
          type: "PACKAGE",
          code: p.packageNumber,
          title: `Package ${p.packageNumber}`,
          subtitle: `${p.packing.packNumber} · ${p.packing.salesOrderNumber}`,
          fields: [
            { label: "Package", value: p.packageNumber },
            { label: "Packing", value: p.packing.packNumber },
            { label: "Sales Order", value: p.packing.salesOrderNumber },
            { label: "Type", value: p.packageType || "—" },
            { label: "Weight", value: p.weight ? String(n(p.weight)) : "—" },
            { label: "Items", value: String(p.items.length) },
          ],
          viewPath: "/scm/warehouse/packing",
          viewLabel: "View Packing",
        }));
      }
      case "SHIPMENT": {
        const rows = await this.prisma.scmShipment.findMany({
          where: {
            organizationId: org,
            OR: [{ shipmentNumber: eq }, { trackingNumber: eq }],
          },
        });
        return rows.map((s) => ({
          type: "SHIPMENT",
          code: s.shipmentNumber,
          title: s.shipmentNumber,
          subtitle: `${s.customerName} · ${s.status}`,
          fields: [
            { label: "Shipment", value: s.shipmentNumber },
            { label: "Customer", value: s.customerName },
            { label: "Status", value: s.status },
            { label: "Carrier", value: s.carrierName || "—" },
            { label: "Tracking", value: s.trackingNumber || "—" },
            { label: "Packages", value: String(s.totalPackages) },
          ],
          viewPath: "/scm/logistics/shipments",
          viewLabel: "View Shipments",
        }));
      }
      case "RETURN": {
        const rows = await this.prisma.scmReturn.findMany({
          where: { organizationId: org, returnNumber: eq },
        });
        return rows.map((r) => ({
          type: "RETURN",
          code: r.returnNumber,
          title: r.returnNumber,
          subtitle: `${r.returnType === "VENDOR_RETURN" ? "Vendor" : "Customer"} return · ${r.status}`,
          fields: [
            { label: "Return", value: r.returnNumber },
            { label: "Type", value: r.returnType },
            { label: "Status", value: r.status },
          ],
          viewPath: "/scm/returns/all",
          viewLabel: "View Returns",
        }));
      }
      case "QC_INSPECTION": {
        const rows = await this.prisma.scmQualityInspection.findMany({
          where: { organizationId: org, inspectionNumber: eq },
          include: { items: true },
        });
        return rows.map((i) => ({
          type: "QC_INSPECTION",
          code: i.inspectionNumber,
          title: i.inspectionNumber,
          subtitle: `QC inspection · ${i.status}`,
          fields: [
            { label: "Inspection", value: i.inspectionNumber },
            { label: "Status", value: i.status },
            { label: "Source", value: i.sourceNumber || "—" },
            { label: "Lines", value: String(i.items.length) },
          ],
          viewPath: "/scm/quality/inspections",
          viewLabel: "View Inspections",
        }));
      }
      case "QUARANTINE": {
        if (!/^\d+$/.test(code)) return [];
        const rows = await this.prisma.scmQuarantineRecord.findMany({
          where: { organizationId: org, id: Number(code) },
        });
        return rows.map((q) => ({
          type: "QUARANTINE",
          code: String(q.id),
          title: `Quarantine #${q.id}`,
          subtitle: `${q.productCode} · ${q.status}`,
          fields: [
            { label: "Product", value: q.productCode },
            { label: "Quantity", value: String(n(q.quantity)) },
            { label: "Status", value: q.status },
            { label: "Defect", value: q.defectCode || "—" },
          ],
          viewPath: "/scm/quality/quarantine",
          viewLabel: "View Quarantine",
        }));
      }
    }
  }

  private async productResult(
    org: number,
    p: {
      id: number;
      productCode: string;
      name: string;
      category: string | null;
      uom: string;
      barcode: string | null;
      reorderLevel: { toString(): string } | null;
      binLocationId: number | null;
      expiryDate: Date | null;
      expiryNotApplicable: boolean;
      updatedAt: Date;
    },
  ): Promise<ScanResult> {
    const [balances, binRows, batches, defaultBin] = await Promise.all([
      this.prisma.scmStockBalance.findMany({
        where: { organizationId: org, productId: p.id },
        include: { warehouse: { select: { name: true } } },
      }),
      this.prisma.scmLocationStock.findMany({
        where: { organizationId: org, productId: p.id, quantity: { gt: 0 } },
        include: {
          location: {
            select: {
              locationCode: true,
              binCode: true,
              rack: true,
              locationName: true,
            },
          },
          warehouse: { select: { name: true } },
        },
      }),
      this.prisma.scmStockBatch.findMany({
        where: { organizationId: org, productId: p.id },
        select: { batchNumber: true, expiryDate: true },
      }),
      p.binLocationId
        ? this.prisma.scmWarehouseLocation.findFirst({
            where: { id: p.binLocationId },
            include: { warehouse: { select: { name: true } } },
          })
        : Promise.resolve(null),
    ]);
    const onHand = balances.reduce((s, b) => s + n(b.onHand), 0);
    const reserved = balances.reduce((s, b) => s + n(b.reserved), 0);
    const available = onHand - reserved;
    const reorder = p.reorderLevel === null ? null : n(p.reorderLevel);
    const status =
      balances.length === 0 || available <= 0
        ? "Out of Stock"
        : reorder !== null && available <= reorder
          ? "Low Stock"
          : reorder !== null && reorder > 0 && available > reorder * 5
            ? "Overstock"
            : "Healthy";
    const lastUpdated = Math.max(
      p.updatedAt.getTime(),
      ...balances.map((b) => b.updatedAt.getTime()),
    );
    const binText = binRows.length
      ? binRows
          .map(
            (r) =>
              `${r.warehouse.name} → ${r.location.rack ? `Rack ${r.location.rack}` : ""}${r.location.rack ? " → " : ""}Bin ${r.location.locationCode ?? r.location.binCode} (Qty: ${n(r.quantity)})`,
          )
          .join("; ")
      : defaultBin
        ? `${defaultBin.warehouse.name} → ${defaultBin.locationCode ?? defaultBin.binCode}`
        : "Not tracked";
    const barcode = (p.barcode ?? "").trim() || p.productCode;
    return {
      type: "PRODUCT",
      code: barcode,
      title: p.name,
      subtitle: `SKU ${p.productCode}${p.category ? ` · ${p.category}` : ""}`,
      fields: [
        { label: "SKU", value: p.productCode },
        { label: "Category", value: p.category || "—" },
        { label: "UOM", value: p.uom },
        { label: "Barcode", value: barcode },
        { label: "On Hand", value: String(onHand) },
        { label: "Reserved", value: String(reserved) },
        { label: "Available", value: String(available) },
        {
          label: "Warehouse(s)",
          value:
            balances
              .filter((b) => n(b.onHand) > 0)
              .map((b) => b.warehouse.name)
              .join(", ") || "—",
        },
        { label: "Rack / Bin Location(s)", value: binText },
        { label: "Stock Status", value: status },
        { label: "Expiry Date", value: expiryText(batches, p) },
        { label: "Last Updated", value: when(new Date(lastUpdated)) },
      ],
      viewPath: `/scm/inventory/overview/${p.id}`,
      viewLabel: "View Inventory",
      actions: [
        { label: "Add to Bin", path: "/scm/warehouse/putaway" },
        { label: "Move Between Bins", path: "/scm/warehouse/movements" },
      ],
    };
  }
}
