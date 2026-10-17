import type {
  BankDetails,
  MasterDocumentType,
  MasterField,
  MasterOption,
} from "../shared/documents";

/** Mirrors apps/api/src/modules/sales/master-list (the services' views). */

export type CodeType =
  | "customer"
  | "quotation"
  | "proforma_invoice"
  | "tax_invoice"
  | "delivery_challan"
  | "payment_received"
  | "returnable_dc";

export type DocumentCodeType = Exclude<CodeType, "customer">;

export const CODE_TYPE_LABEL: Record<CodeType, string> = {
  customer: "Customer code",
  quotation: "Quotation",
  proforma_invoice: "Proforma invoice",
  tax_invoice: "Tax invoice",
  delivery_challan: "Delivery challan",
  payment_received: "Payment received",
  returnable_dc: "Returnable DC",
};

/** GET /sales/master/code-formats. */
export interface CodeFormat {
  codeType: CodeType;
  prefix: string;
  padding: number;
  /** Never edited: the built-in format. */
  isDefault: boolean;
  updatedAt: string | null;
  /** What the next code looks like. */
  example: string;
}

/** GET /sales/master/running-numbers. */
export interface RunningNumber {
  codeType: DocumentCodeType;
  prefix: string;
  padding: number;
  fiscalYear: string;
  lastNumber: number;
  lastCode: string | null;
  nextCode: string;
}

/** GET /sales/master/company-profile (null until set up). */
export interface CompanyProfile {
  legalName: string;
  tagline: string | null;
  address: string;
  gstin: string | null;
  stateCode: string;
  stateName: string | null;
  pan: string | null;
  email: string | null;
  phone: string | null;
  hasLogo: boolean;
}

export interface CompanyProfileBody {
  legalName: string;
  tagline: string | null;
  address: string;
  gstin: string | null;
  stateCode: string | null;
  pan: string | null;
  email: string | null;
  phone: string | null;
}

/** GET /sales/master/document-fields/layout: each field, whether its
 * options carry an image, and the documents that offer it. */
export interface FieldLayout {
  field: MasterField;
  hasImage: boolean;
  documentTypes: MasterDocumentType[];
}

export type { BankDetails, MasterDocumentType, MasterField, MasterOption };

export interface OptionBody {
  label?: string | null;
  value?: string | null;
  bankDetails?: {
    bankName: string;
    accountNumber: string;
    branch: string | null;
    ifsc: string;
  } | null;
  isDefault?: boolean;
  sortOrder?: number;
}

export const DOCUMENT_TYPE_LABEL: Record<MasterDocumentType, string> = {
  QUOTATION: "Quotation",
  PROFORMA_INVOICE: "Proforma invoice",
  TAX_INVOICE: "Tax invoice",
  DELIVERY_CHALLAN: "Delivery challan",
  PAYMENT_RECEIVED: "Payment received",
  RETURNABLE_DC: "Returnable DC",
};

export const FIELD_LABEL: Record<MasterField, string> = {
  VALIDITY: "Validity",
  DELIVERY_TERMS: "Delivery terms",
  PAYMENT_TERMS: "Payment terms",
  HSN_CODE: "HSN codes",
  BANK_ACCOUNT: "Bank accounts",
  COMPANY_SEAL: "Company seals",
  AUTHORIZED_SIGNATURE: "Authorized signatures",
  PREPARED_BY: "Prepared by",
  PAYMENT_MODE: "Payment modes",
};
