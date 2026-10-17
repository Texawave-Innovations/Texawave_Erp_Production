import { BusinessRuleViolationException } from "../../../common/exceptions/business.exception.js";
import { IFSC_PATTERN } from "../shared/gst.js";

/**
 * Sales master list — the choices offered on the document forms. Pure, no
 * I/O. Options belong to a field and are shared by every document type
 * whose form has that field (FIELDS_BY_DOCUMENT mirrors the legacy forms).
 */
export const DOCUMENT_TYPES = [
  "QUOTATION",
  "PROFORMA_INVOICE",
  "TAX_INVOICE",
  "DELIVERY_CHALLAN",
  "PAYMENT_RECEIVED",
  "RETURNABLE_DC",
] as const;
export type MasterDocumentType = (typeof DOCUMENT_TYPES)[number];

export const DOCUMENT_FIELDS = [
  "VALIDITY",
  "DELIVERY_TERMS",
  "PAYMENT_TERMS",
  "HSN_CODE",
  "BANK_ACCOUNT",
  "COMPANY_SEAL",
  "AUTHORIZED_SIGNATURE",
  "PREPARED_BY",
  "PAYMENT_MODE",
] as const;
export type DocumentField = (typeof DOCUMENT_FIELDS)[number];

const COMMON: readonly DocumentField[] = [
  "HSN_CODE",
  "BANK_ACCOUNT",
  "COMPANY_SEAL",
  "AUTHORIZED_SIGNATURE",
  "PREPARED_BY",
];

export const FIELDS_BY_DOCUMENT: Readonly<
  Record<MasterDocumentType, readonly DocumentField[]>
> = {
  QUOTATION: ["VALIDITY", "DELIVERY_TERMS", ...COMMON],
  PROFORMA_INVOICE: ["PAYMENT_TERMS", ...COMMON],
  TAX_INVOICE: ["PAYMENT_TERMS", ...COMMON],
  DELIVERY_CHALLAN: COMMON,
  PAYMENT_RECEIVED: ["PAYMENT_MODE"],
  RETURNABLE_DC: ["COMPANY_SEAL", "AUTHORIZED_SIGNATURE", "PREPARED_BY"],
};

export const PAYMENT_MODE_MAX = 50;

/** Fields whose options carry an uploaded image. */
export const IMAGE_FIELDS: readonly DocumentField[] = [
  "COMPANY_SEAL",
  "AUTHORIZED_SIGNATURE",
];

export function isImageField(field: string): boolean {
  return (IMAGE_FIELDS as readonly string[]).includes(field);
}

/** The document types whose form offers `field`. */
export function documentTypesFor(field: DocumentField): MasterDocumentType[] {
  return DOCUMENT_TYPES.filter((d) => FIELDS_BY_DOCUMENT[d].includes(field));
}

export interface BankDetailsInput {
  bankName: string;
  accountNumber: string;
  branch?: string | null | undefined;
  ifsc: string;
}

export interface OptionInput {
  label?: string | null | undefined;
  value?: string | null | undefined;
  bankDetails?: BankDetailsInput | null | undefined;
}

export interface NormalizedOption {
  label: string;
  value: string | null;
  bankDetails: {
    bankName: string;
    accountNumber: string;
    branch: string | null;
    ifsc: string;
  } | null;
}

/**
 * The stored shape of one option:
 * - HSN_CODE: `value` is the 4–8 digit code; the label (description)
 *   defaults to the code.
 * - BANK_ACCOUNT: `bankDetails` (name, account, IFSC; branch optional); the
 *   label defaults to "HDFC Bank - 235767577457 (Main Branch)".
 * - every other field: the label is the text offered (e.g. "30 Days").
 */
export function normalizeOption(
  field: DocumentField,
  input: OptionInput,
): NormalizedOption {
  const label = input.label?.trim() || null;
  if (field === "HSN_CODE") {
    const code = input.value?.trim();
    if (!code || !/^[0-9]{4,8}$/.test(code)) {
      throw new BusinessRuleViolationException(
        "An HSN code option needs a 4-8 digit value",
        "HSN_CODE_REQUIRED",
      );
    }
    return { label: label ?? code, value: code, bankDetails: null };
  }
  if (input.value) {
    throw new BusinessRuleViolationException(
      `${field} options have no value; use the label`,
      "VALUE_NOT_ALLOWED",
    );
  }
  if (field === "BANK_ACCOUNT") {
    const b = input.bankDetails;
    if (!b) {
      throw new BusinessRuleViolationException(
        "A bank account option needs bank details",
        "BANK_DETAILS_REQUIRED",
      );
    }
    if (!IFSC_PATTERN.test(b.ifsc)) {
      throw new BusinessRuleViolationException(
        "ifsc must be a valid IFSC",
        "INVALID_IFSC",
      );
    }
    const branch = b.branch?.trim() || null;
    return {
      label:
        label ??
        `${b.bankName} - ${b.accountNumber}${branch ? ` (${branch})` : ""}`,
      value: null,
      bankDetails: {
        bankName: b.bankName,
        accountNumber: b.accountNumber,
        branch,
        ifsc: b.ifsc,
      },
    };
  }
  if (input.bankDetails) {
    throw new BusinessRuleViolationException(
      `${field} options have no bank details`,
      "BANK_DETAILS_NOT_ALLOWED",
    );
  }
  if (!label) {
    throw new BusinessRuleViolationException(
      `A ${field} option needs a label`,
      "LABEL_REQUIRED",
    );
  }
  // A payment stores its mode's label (sales.invoice_payments.mode, 50).
  if (field === "PAYMENT_MODE" && label.length > PAYMENT_MODE_MAX) {
    throw new BusinessRuleViolationException(
      `A payment mode is at most ${PAYMENT_MODE_MAX} characters`,
      "LABEL_TOO_LONG",
    );
  }
  return { label, value: null, bankDetails: null };
}
