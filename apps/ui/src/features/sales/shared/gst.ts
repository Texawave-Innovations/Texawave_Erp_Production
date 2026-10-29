/**
 * GST reference data and formats for Sales forms (PAN, IFSC, pincode,
 * mobile and name formats are shared: packages/core/src/schemas/fields.ts). Mirrors
 * apps/api/src/modules/sales/shared/gst.ts and countries.ts so a form fails
 * the way the API would, before a round trip; the API stays authoritative.
 */

export const GST_STATES: ReadonlyArray<{ code: string; name: string }> = [
  { code: "01", name: "Jammu and Kashmir" },
  { code: "02", name: "Himachal Pradesh" },
  { code: "03", name: "Punjab" },
  { code: "04", name: "Chandigarh" },
  { code: "05", name: "Uttarakhand" },
  { code: "06", name: "Haryana" },
  { code: "07", name: "Delhi" },
  { code: "08", name: "Rajasthan" },
  { code: "09", name: "Uttar Pradesh" },
  { code: "10", name: "Bihar" },
  { code: "11", name: "Sikkim" },
  { code: "12", name: "Arunachal Pradesh" },
  { code: "13", name: "Nagaland" },
  { code: "14", name: "Manipur" },
  { code: "15", name: "Mizoram" },
  { code: "16", name: "Tripura" },
  { code: "17", name: "Meghalaya" },
  { code: "18", name: "Assam" },
  { code: "19", name: "West Bengal" },
  { code: "20", name: "Jharkhand" },
  { code: "21", name: "Odisha" },
  { code: "22", name: "Chhattisgarh" },
  { code: "23", name: "Madhya Pradesh" },
  { code: "24", name: "Gujarat" },
  { code: "26", name: "Dadra and Nagar Haveli and Daman and Diu" },
  { code: "27", name: "Maharashtra" },
  { code: "29", name: "Karnataka" },
  { code: "30", name: "Goa" },
  { code: "31", name: "Lakshadweep" },
  { code: "32", name: "Kerala" },
  { code: "33", name: "Tamil Nadu" },
  { code: "34", name: "Puducherry" },
  { code: "35", name: "Andaman and Nicobar Islands" },
  { code: "36", name: "Telangana" },
  { code: "37", name: "Andhra Pradesh" },
  { code: "38", name: "Ladakh" },
  { code: "96", name: "Other Countries" },
  { code: "97", name: "Other Territory" },
];

export const GSTIN_PATTERN = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][0-9A-Z]Z[0-9A-Z]$/;
export const CIN_PATTERN = /^[LU][0-9]{5}[A-Z]{2}[0-9]{4}[A-Z]{3}[0-9]{6}$/;

/** The state and PAN a GSTIN carries ("33ABCDE1234F1Z5" → 33, ABCDE1234F);
 * null when it is not a full GSTIN yet. */
export function fromGstin(
  gstin: string,
): { stateCode: string; pan: string } | null {
  const value = gstin.trim().toUpperCase();
  if (!GSTIN_PATTERN.test(value)) return null;
  return { stateCode: value.slice(0, 2), pan: value.slice(2, 12) };
}

export function stateName(code: string | null | undefined): string | null {
  if (!code) return null;
  return GST_STATES.find((s) => s.code === code)?.name ?? null;
}
