// HANDWRITTEN — mirrors apps/api/src/modules/scm/suppliers/. Migrated from
// the LEGACY TexaWave_ERP_old/src/modules/scm/suppliers (RTDB
// `contacts/vendors`). See packages/api-types/README.md.

export const SUPPLIER_STATUSES = [
  "Active",
  "Inactive",
  "Pending Approval",
  "Blocked",
] as const;
export type SupplierStatus = (typeof SUPPLIER_STATUSES)[number];

export interface Supplier {
  id: number;
  organizationId: number;
  supplierCode: string;
  companyName: string;
  type: string | null;
  status: SupplierStatus;
  gstin: string | null;
  pan: string | null;
  contactPerson: string;
  phone: string | null;
  email: string | null;
  street: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  pincode: string | null;
  paymentTerms: string | null;
  creditLimit: string;
  currency: string;
  leadTimeDays: number;
  rating: number | null;
  notes: string | null;
  createdBy: number | null;
  updatedBy: number | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface CreateSupplierInput {
  supplierCode?: string | undefined;
  companyName: string;
  type?: string | undefined;
  status?: SupplierStatus | undefined;
  gstin?: string | undefined;
  pan?: string | undefined;
  contactPerson: string;
  phone?: string | undefined;
  email?: string | undefined;
  street?: string | undefined;
  city?: string | undefined;
  state?: string | undefined;
  country?: string | undefined;
  pincode?: string | undefined;
  paymentTerms?: string | undefined;
  creditLimit?: number | undefined;
  currency?: string | undefined;
  leadTimeDays?: number | undefined;
  /** `null` clears a previously set rating. */
  rating?: number | null | undefined;
  notes?: string | undefined;
}

export type UpdateSupplierInput = Partial<CreateSupplierInput>;

export interface QuerySuppliersInput {
  page?: number | undefined;
  limit?: number | undefined;
  order?: ("asc" | "desc") | undefined;
  q?: string | undefined;
  status?: SupplierStatus | undefined;
  type?: string | undefined;
}

export interface SupplierActivityEntry {
  id: number;
  action: string;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  at: string;
  byName: string | null;
}

export interface SupplierProcurementSummary {
  kpis: {
    purchaseOrders: number;
    totalPoValue: number;
    openPurchaseOrders: number;
    receipts: number;
    acceptedQuantity: number;
    rejectedQuantity: number;
    rejectionRate: number;
  };
  rfqs: { id: number; rfqNumber: string; status: string; issueDate: string }[];
  quotations: {
    id: number;
    quotationNumber: string;
    status: string;
    quotationDate: string;
    total: string;
    currency: string;
    rfq: { rfqNumber: string };
  }[];
  purchaseOrders: {
    id: number;
    poNumber: string;
    status: string;
    poDate: string;
    total: string;
    currency: string;
  }[];
  receipts: {
    id: number;
    grnNumber: string;
    receiptDate: string;
    poNumber: string;
    status: string;
  }[];
  productsSupplied: {
    productId: number;
    name: string;
    lastRate: number;
    lastDate: string;
    totalQty: number;
    pos: number;
  }[];
}
