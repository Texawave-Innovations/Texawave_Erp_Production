/**
 * Ported from legacy `TexaWave_ERP/src/utils/addressUtils.ts` `formatAddress` —
 * pure string formatting, no Firebase/Sales coupling. Kept duck-typed so it
 * works whether a future caller passes `postalCode` (this schema's naming)
 * or `pincode`, matching legacy's own tolerance.
 */
export interface PrintAddress {
  street?: string | null | undefined;
  city?: string | null | undefined;
  state?: string | null | undefined;
  postalCode?: string | null | undefined;
  country?: string | null | undefined;
}

export function formatAddress(addr: PrintAddress | null | undefined): string {
  if (!addr) return "—";

  const line1 = (addr.street || "").trim();
  const cityStateParts = [
    (addr.city || "").trim(),
    (addr.state || "").trim(),
  ].filter(Boolean);
  let cityStateZip = cityStateParts.join(", ");
  const pin = (addr.postalCode || "").trim();
  if (pin) cityStateZip = cityStateZip ? `${cityStateZip} - ${pin}` : pin;
  const country = (addr.country || "").trim();

  const lines = [line1, cityStateZip, country].filter(Boolean);
  return lines.length > 0 ? lines.join("\n") : "—";
}
