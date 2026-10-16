// HANDWRITTEN — mirrors apps/api/src/modules/sales-settings/. See
// packages/api-types/README.md. Nothing generates these yet
// (Docs/ARCHITECTURE.md §2) — update by hand if the backend DTOs change.

export const SEAL_SIGNATURE_KINDS = ["seal", "signature"] as const;
export type SealSignatureKind = (typeof SEAL_SIGNATURE_KINDS)[number];

export const SALES_MASTER_LIST_CATEGORIES = [
  "payment_term",
  "delivery_term",
  "dispatch_mode",
  "gst_rate",
  "item_category",
  "item_type",
  "item_group",
  "unit",
] as const;
export type SalesMasterListCategory =
  (typeof SALES_MASTER_LIST_CATEGORIES)[number];

export const SALES_DOCUMENT_TYPES = [
  "quotation",
  "sales_order",
  "packing_list",
  "invoice",
  "delivery_challan",
  "credit_note",
  "retainer_invoice",
  "payment_receipt",
] as const;
export type SalesDocumentType = (typeof SALES_DOCUMENT_TYPES)[number];

/** Company tab — `sales_settings/company-detail` (singleton, upsert-only). */
export interface CompanyDetail {
  id: number;
  organizationId: number;
  name: string;
  phone: string | null;
  email: string | null;
  website: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  state: string | null;
  pincode: string | null;
  country: string | null;
  gstin: string | null;
  pan: string | null;
  logoDataUri: string | null;
  customFields: Record<string, unknown>;
  createdBy: number | null;
  updatedBy: number | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export type UpsertCompanyDetailInput = {
  name: string;
  phone?: string | undefined;
  email?: string | undefined;
  website?: string | undefined;
  addressLine1?: string | undefined;
  addressLine2?: string | undefined;
  city?: string | undefined;
  state?: string | undefined;
  pincode?: string | undefined;
  country?: string | undefined;
  gstin?: string | undefined;
  pan?: string | undefined;
  logoDataUri?: string | undefined;
  customFields?: Record<string, unknown> | undefined;
};

/** Numbering tab — `sales_settings/document-numbering`, reuses
 * `document_sequences` (one row per `docType`). */
export interface DocumentNumbering {
  id: number;
  organizationId: number;
  docType: SalesDocumentType;
  prefix: string;
  padding: number;
  nextNumber: number;
}

export interface UpdateDocumentNumberingInput {
  prefix: string;
  padding?: number | undefined;
}

/** Bank & Signatory tab (bank half) — `sales_settings/bank-accounts`. */
export interface BankAccount {
  id: number;
  organizationId: number;
  bankName: string;
  accountHolderName: string;
  accountNumber: string;
  ifscCode: string;
  branchName: string | null;
  isPrimary: boolean;
  customFields: Record<string, unknown>;
  createdBy: number | null;
  updatedBy: number | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface CreateBankAccountInput {
  bankName: string;
  accountHolderName: string;
  accountNumber: string;
  ifscCode: string;
  branchName?: string | undefined;
  isPrimary?: boolean | undefined;
  customFields?: Record<string, unknown> | undefined;
}

export type UpdateBankAccountInput = Partial<CreateBankAccountInput>;

export interface QueryBankAccountsInput {
  page?: number | undefined;
  limit?: number | undefined;
  order?: "asc" | "desc" | undefined;
  search?: string | undefined;
}

/** Bank & Signatory tab (signatory half) — `sales_settings/authorized-signatory`
 * (singleton, upsert-only). */
export interface AuthorizedSignatory {
  id: number;
  organizationId: number;
  name: string | null;
  designation: string | null;
  customFields: Record<string, unknown>;
  createdBy: number | null;
  updatedBy: number | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface UpsertAuthorizedSignatoryInput {
  name?: string | undefined;
  designation?: string | undefined;
  customFields?: Record<string, unknown> | undefined;
}

/** Salespersons tab — `sales_settings/salespersons`. */
export interface Salesperson {
  id: number;
  organizationId: number;
  name: string;
  code: string | null;
  email: string | null;
  phone: string | null;
  commissionPercent: number | null;
  customFields: Record<string, unknown>;
  createdBy: number | null;
  updatedBy: number | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface CreateSalespersonInput {
  name: string;
  code?: string | undefined;
  email?: string | undefined;
  phone?: string | undefined;
  commissionPercent?: number | undefined;
  customFields?: Record<string, unknown> | undefined;
}

export type UpdateSalespersonInput = Partial<CreateSalespersonInput>;

export interface QuerySalespersonsInput {
  page?: number | undefined;
  limit?: number | undefined;
  order?: "asc" | "desc" | undefined;
  search?: string | undefined;
}

/** Seals & Signatures tab — `sales_settings/company-seals` and
 * `.../authorized-signatures`, both backed by `SealSignature`. */
export interface SealSignature {
  id: number;
  organizationId: number;
  kind: SealSignatureKind;
  title: string;
  signatoryName: string | null;
  designation: string | null;
  imageDataUri: string;
  customFields: Record<string, unknown>;
  createdBy: number | null;
  updatedBy: number | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface CreateSealSignatureInput {
  title: string;
  signatoryName?: string | undefined;
  designation?: string | undefined;
  imageDataUri: string;
  customFields?: Record<string, unknown> | undefined;
}

export type UpdateSealSignatureInput = Partial<CreateSealSignatureInput>;

export interface QuerySealSignaturesInput {
  page?: number | undefined;
  limit?: number | undefined;
  order?: "asc" | "desc" | undefined;
}

/** Terms & Inventory tab — `sales_settings/master-list-items`, one generic
 * resource behind `category`. */
export interface SalesMasterListItem {
  id: number;
  organizationId: number;
  category: SalesMasterListCategory;
  value: string;
  numericValue: number | null;
  customFields: Record<string, unknown>;
  createdBy: number | null;
  updatedBy: number | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface CreateMasterListItemInput {
  category: SalesMasterListCategory;
  value: string;
  numericValue?: number | undefined;
  customFields?: Record<string, unknown> | undefined;
}

export type UpdateMasterListItemInput = Partial<
  Omit<CreateMasterListItemInput, "category">
>;

export interface QueryMasterListItemsInput {
  category: SalesMasterListCategory;
  page?: number | undefined;
  limit?: number | undefined;
  order?: "asc" | "desc" | undefined;
}
