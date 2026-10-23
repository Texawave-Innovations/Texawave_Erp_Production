/** Mirrors the API's `IsImageDataUri` validator
 * (apps/api/src/common/dto/validators.ts) and the shared
 * `MAX_UPLOAD_BYTES`/`detectFileType` convention used by onboarding/HR
 * document uploads (apps/api/src/shared/file-storage/file-storage.service.ts)
 * — this is a client-side convenience check only; the server re-validates
 * the decoded bytes' own magic numbers, since both size and type here are
 * client-controlled. */
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
export const ACCEPTED_IMAGE_TYPES = ["image/png", "image/jpeg"];
export const ACCEPTED_IMAGE_ACCEPT_ATTR =
  ".png,.jpg,.jpeg,image/png,image/jpeg";

export function validateImageFile(file: File): string | null {
  if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
    return "Only PNG or JPG images are accepted.";
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return "Image must be 5 MB or smaller.";
  }
  return null;
}

/**
 * Client-side file → base64 data URI conversion for the logo/seal/signature
 * uploads. There is no file-storage integration for this module
 * (Docs/SALES_SETTINGS_FOUNDATION.md design decision #1) — the data URI is
 * stored as-is in `imageDataUri`/`logoDataUri` `Text` columns.
 */
export function fileToDataUri(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () =>
      reject(reader.error ?? new Error("File read failed"));
    reader.readAsDataURL(file);
  });
}

export const SALES_DOCUMENT_TYPE_LABELS: Record<string, string> = {
  quotation: "Quotation",
  sales_order: "Sales Order",
  packing_list: "Packing List",
  invoice: "Invoice",
  delivery_challan: "Delivery Challan",
  credit_note: "Credit Note",
  retainer_invoice: "Retainer Invoice",
  payment_receipt: "Payment Receipt",
};

export const SALES_MASTER_LIST_CATEGORY_LABELS: Record<string, string> = {
  payment_term: "Payment Terms",
  delivery_term: "Delivery Terms",
  dispatch_mode: "Dispatch Modes",
  gst_rate: "GST Rates",
  item_category: "Item Categories",
  item_type: "Item Types",
  item_group: "Item Groups",
  unit: "Units",
};
