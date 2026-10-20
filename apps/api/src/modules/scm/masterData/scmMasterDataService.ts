// Phase 12b — search functions over the cached `ScmMasterDataBundle`. Pure client-side filters
// (the same "fetch once, filter in memory" convention every SCM list page already uses — the
// Realtime Database has no server-side text query), capped to `limit` results so a huge product
// catalog never renders thousands of rows into an autocomplete dropdown.
import type { SellableProduct } from "../inventory/productCatalog";
import type {
  Customer,
  LogisticsCarrier,
  SerialNumberRecord,
  StockBatch,
  Vendor,
  Warehouse,
  WarehouseLocation,
} from "@/types";

function norm(v: string | undefined | null): string {
  return (v || "").toLowerCase();
}

export function searchProducts(
  list: SellableProduct[],
  query: string,
  limit = 50,
): SellableProduct[] {
  const q = query.trim().toLowerCase();
  const filtered = !q
    ? list
    : list.filter(
        (p) =>
          norm(p.name).includes(q) ||
          norm(p.productCode).includes(q) ||
          norm(p.category).includes(q),
      );
  return filtered.slice(0, limit);
}

export function searchVendors(
  list: Vendor[],
  query: string,
  limit = 50,
): Vendor[] {
  const q = query.trim().toLowerCase();
  const filtered = !q
    ? list
    : list.filter(
        (v) =>
          norm(v.companyName).includes(q) ||
          norm(v.vendorCode).includes(q) ||
          norm(v.contactPerson).includes(q),
      );
  return filtered.slice(0, limit);
}

export function searchCustomers(
  list: Customer[],
  query: string,
  limit = 50,
): Customer[] {
  const q = query.trim().toLowerCase();
  const filtered = !q
    ? list
    : list.filter(
        (c) =>
          norm(c.companyName).includes(q) ||
          norm(c.customerCode).includes(q) ||
          norm(c.contactPerson).includes(q),
      );
  return filtered.slice(0, limit);
}

export function searchWarehouses(
  list: Warehouse[],
  query: string,
  limit = 50,
): Warehouse[] {
  const q = query.trim().toLowerCase();
  const filtered = !q
    ? list
    : list.filter((w) => norm(w.name).includes(q) || norm(w.code).includes(q));
  return filtered.slice(0, limit);
}

export function searchLocations(
  list: WarehouseLocation[],
  query: string,
  limit = 50,
): WarehouseLocation[] {
  const q = query.trim().toLowerCase();
  const filtered = !q
    ? list
    : list.filter(
        (l) =>
          norm(l.locationCode).includes(q) ||
          norm(l.binCode).includes(q) ||
          norm(l.locationName).includes(q),
      );
  return filtered.slice(0, limit);
}

export function searchBatches(
  list: StockBatch[],
  query: string,
  limit = 50,
): StockBatch[] {
  const q = query.trim().toLowerCase();
  const filtered = !q
    ? list
    : list.filter(
        (b) =>
          norm(b.batchNumber).includes(q) ||
          norm(b.productName).includes(q) ||
          norm(b.productCode).includes(q),
      );
  return filtered.slice(0, limit);
}

export function searchSerials(
  list: SerialNumberRecord[],
  query: string,
  limit = 50,
): SerialNumberRecord[] {
  const q = query.trim().toLowerCase();
  const filtered = !q
    ? list
    : list.filter(
        (s) =>
          norm(s.serialNumber).includes(q) ||
          norm(s.productName).includes(q) ||
          norm(s.productCode).includes(q),
      );
  return filtered.slice(0, limit);
}

export function searchCarriers(
  list: LogisticsCarrier[],
  query: string,
  limit = 50,
): LogisticsCarrier[] {
  const q = query.trim().toLowerCase();
  const filtered = !q
    ? list
    : list.filter(
        (c) =>
          norm(c.carrierName).includes(q) || norm(c.carrierCode).includes(q),
      );
  return filtered.slice(0, limit);
}
