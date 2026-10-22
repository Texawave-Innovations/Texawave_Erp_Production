import { useCallback, useEffect, useMemo, useState } from "react";
import { getAllRecords } from "@/services/firebase";
import { useInventoryData } from "@/modules/scm/inventory/useInventoryData";
import type {
  GrnStatus,
  QuotationStatus,
  RequisitionStatus,
  RfqStatus,
  ScmPOStatus,
  Vendor,
} from "@/types";
import { SCM_CROSS_MODULE_PATHS } from "@/modules/scm/shared/crossModulePaths";
import { isSupplierActive } from "@/modules/scm/shared/businessRules";
import { errorMessage } from "@/modules/scm/shared/format";

export const PAGE_SIZE = 20;

/** Line amounts. The discount is clamped to the gross amount so a line can never go negative. */
export function lineTotal(
  qty: number,
  unitPrice: number,
  discount: number,
  taxRate: number,
) {
  const gross = Math.max(0, qty) * Math.max(0, unitPrice);
  const afterDiscount = Math.max(0, gross - Math.max(0, discount));
  const taxAmount =
    Math.round(afterDiscount * (Math.max(0, taxRate) / 100) * 100) / 100;
  const total = Math.round((afterDiscount + taxAmount) * 100) / 100;
  return { taxAmount, total };
}

interface PricedLine {
  productName: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  taxAmount: number;
}

/** Document totals, with the subtotal clamped per line exactly like `lineTotal`. */
export function documentTotals(
  lines: PricedLine[],
  freight: number,
  discount: number,
) {
  const subtotal =
    Math.round(
      lines.reduce(
        (s, it) => s + Math.max(0, it.quantity * it.unitPrice - it.discount),
        0,
      ) * 100,
    ) / 100;
  const taxAmount =
    Math.round(lines.reduce((s, it) => s + it.taxAmount, 0) * 100) / 100;
  const total =
    Math.round((subtotal + taxAmount + freight - discount) * 100) / 100;
  return { subtotal, taxAmount, total };
}

/** Rejects negative prices/charges and a line discount larger than the line's gross amount. */
export function validatePricing(
  lines: PricedLine[],
  freight: number,
  discount: number,
): string | null {
  for (const it of lines) {
    if (it.unitPrice < 0)
      return `${it.productName}: unit price cannot be negative`;
    if (it.discount < 0)
      return `${it.productName}: discount cannot be negative`;
    if (it.discount > it.quantity * it.unitPrice)
      return `${it.productName}: discount cannot exceed the line amount`;
  }
  if (freight < 0) return "Freight cannot be negative";
  if (discount < 0) return "Overall discount cannot be negative";
  return null;
}

/** First product code that appears on more than one line, if any. */
export function duplicateProductCode(
  lines: { productCode: string }[],
): string | undefined {
  const seen = new Set<string>();
  for (const { productCode } of lines) {
    if (!productCode) continue;
    if (seen.has(productCode)) return productCode;
    seen.add(productCode);
  }
  return undefined;
}

/** Shared data loader for every procurement page — the inventory masters (products, warehouses,
 * per-SKU settings) from `useInventoryData` plus the vendor list. */
export function useProcurementMasters() {
  const inventory = useInventoryData();
  const [vendorsLoading, setVendorsLoading] = useState(true);
  const [vendorError, setVendorError] = useState<string | null>(null);
  const [vendors, setVendors] = useState<Vendor[]>([]);

  const loadVendors = useCallback(async () => {
    setVendorsLoading(true);
    try {
      setVendors(
        (await getAllRecords(SCM_CROSS_MODULE_PATHS.vendors)) as Vendor[],
      );
      setVendorError(null);
    } catch (err: unknown) {
      setVendorError(errorMessage(err, "Failed to load suppliers"));
    } finally {
      setVendorsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadVendors();
  }, [loadVendors]);

  const activeVendors = useMemo(
    () => vendors.filter((v) => isSupplierActive(v.status)),
    [vendors],
  );
  const { reload: reloadInventory } = inventory;
  const reload = useCallback(async () => {
    await Promise.all([reloadInventory(), loadVendors()]);
  }, [reloadInventory, loadVendors]);

  return {
    loading: inventory.loading || vendorsLoading,
    error: inventory.error || vendorError,
    vendors,
    activeVendors,
    products: inventory.products,
    warehouses: inventory.warehouses,
    settings: inventory.settings,
    settingsByCode: inventory.settingsByCode,
    reload,
  };
}

export const REQUISITION_STATUS_TONE: Record<RequisitionStatus, string> = {
  DRAFT: "text-slate-600 border-slate-200 bg-slate-50",
  SUBMITTED: "text-blue-600 border-blue-200 bg-blue-50",
  UNDER_REVIEW: "text-amber-600 border-amber-200 bg-amber-50",
  APPROVED: "text-emerald-600 border-emerald-200 bg-emerald-50",
  REJECTED: "text-red-600 border-red-200 bg-red-50",
  CANCELLED: "text-gray-500 border-gray-200 bg-gray-50",
  CONVERTED: "text-violet-600 border-violet-200 bg-violet-50",
};

export const RFQ_STATUS_TONE: Record<RfqStatus, string> = {
  DRAFT: "text-slate-600 border-slate-200 bg-slate-50",
  ISSUED: "text-blue-600 border-blue-200 bg-blue-50",
  RESPONSES_PENDING: "text-amber-600 border-amber-200 bg-amber-50",
  PARTIALLY_RESPONDED: "text-amber-600 border-amber-200 bg-amber-50",
  RESPONDED: "text-emerald-600 border-emerald-200 bg-emerald-50",
  CLOSED: "text-gray-500 border-gray-200 bg-gray-50",
  CANCELLED: "text-red-600 border-red-200 bg-red-50",
};

export const QUOTATION_STATUS_TONE: Record<QuotationStatus, string> = {
  DRAFT: "text-slate-600 border-slate-200 bg-slate-50",
  RECEIVED: "text-blue-600 border-blue-200 bg-blue-50",
  UNDER_REVIEW: "text-amber-600 border-amber-200 bg-amber-50",
  SHORTLISTED: "text-indigo-600 border-indigo-200 bg-indigo-50",
  SELECTED: "text-emerald-600 border-emerald-200 bg-emerald-50",
  REJECTED: "text-red-600 border-red-200 bg-red-50",
  EXPIRED: "text-gray-500 border-gray-200 bg-gray-50",
  CANCELLED: "text-gray-500 border-gray-200 bg-gray-50",
};

export const PO_STATUS_TONE: Record<ScmPOStatus, string> = {
  DRAFT: "text-slate-600 border-slate-200 bg-slate-50",
  PENDING_APPROVAL: "text-amber-600 border-amber-200 bg-amber-50",
  APPROVED: "text-indigo-600 border-indigo-200 bg-indigo-50",
  SENT: "text-blue-600 border-blue-200 bg-blue-50",
  PARTIALLY_RECEIVED: "text-amber-600 border-amber-200 bg-amber-50",
  RECEIVED: "text-emerald-600 border-emerald-200 bg-emerald-50",
  CANCELLED: "text-red-600 border-red-200 bg-red-50",
  CLOSED: "text-gray-500 border-gray-200 bg-gray-50",
};

export const GRN_STATUS_TONE: Record<GrnStatus, string> = {
  DRAFT: "text-slate-600 border-slate-200 bg-slate-50",
  RECEIVED: "text-blue-600 border-blue-200 bg-blue-50",
  PARTIALLY_RECEIVED: "text-amber-600 border-amber-200 bg-amber-50",
  COMPLETED: "text-emerald-600 border-emerald-200 bg-emerald-50",
  CANCELLED: "text-red-600 border-red-200 bg-red-50",
};
