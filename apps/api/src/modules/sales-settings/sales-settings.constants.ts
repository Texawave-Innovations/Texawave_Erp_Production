/** Shared enums for the Sales Settings / Sales & Document Masters foundation.
 * See Docs/SALES_SETTINGS_FOUNDATION.md for the UI tab each one backs. */

/** `SealSignature.kind` — Seals & Signatures tab. */
export const SEAL_SIGNATURE_KINDS = ["seal", "signature"] as const;
export type SealSignatureKind = (typeof SEAL_SIGNATURE_KINDS)[number];

/** `SalesMasterListItem.category` — Terms & Inventory tab. */
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

/** `DocumentSequence.docType` values this module adds — Numbering tab.
 * Reuses the existing `document_sequences` table (Docs/ARCHITECTURE.md
 * §5.3); employee codes already use `'employee'` there. */
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
