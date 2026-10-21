// Barcode / QR value rules shared by every label and scan screen.

import type { ScmScanType } from "@texawave-erp/api-types";

export type { ScmScanType };

/** The Code 128 value for a product — its assigned barcode if set, else its
 * own product code (Code 128 can encode any printable ASCII). */
export function productBarcodeValue(
  productCode: string,
  assignedBarcode?: string | null,
): string {
  return (assignedBarcode ?? "").trim() || productCode;
}

/** The origin a printed QR should encode. Prefers an explicitly configured
 * `NEXT_PUBLIC_APP_ORIGIN` (the deployed URL) over `window.location.origin`
 * so a label made from a developer's localhost still works on a phone. */
export function appOrigin(): string {
  const configured = process.env.NEXT_PUBLIC_APP_ORIGIN?.trim();
  if (configured) return configured.replace(/\/+$/, "");
  return typeof window !== "undefined" ? window.location.origin : "";
}

/** Structured QR payload. A product QR is a real URL to its inventory page, so
 * a phone's own camera opens it; every other record encodes a small JSON
 * object (`{ scm: 1, type, code, id? }`) that resolves straight to that
 * record. No mutable or sensitive data is ever placed in a QR. */
export function buildQrPayload(
  type: ScmScanType,
  code: string,
  id?: string | number,
): string {
  if (type === "PRODUCT") {
    return `${appOrigin()}/scm/inventory/overview/${encodeURIComponent(String(id ?? code))}`;
  }
  const payload: { scm: 1; type: ScmScanType; code: string; id?: string } = {
    scm: 1,
    type,
    code,
  };
  if (id !== undefined) payload.id = String(id);
  return JSON.stringify(payload);
}
