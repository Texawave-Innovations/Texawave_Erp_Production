/**
 * Pure GST identity helpers for Sales. No I/O.
 */

/** GST state/UT codes as used in a GSTIN's first two digits and as the
 * place of supply. 96 = other countries (exports), 97 = other territory. */
export const GST_STATE_CODES: Readonly<Record<string, string>> = {
  "01": "Jammu and Kashmir",
  "02": "Himachal Pradesh",
  "03": "Punjab",
  "04": "Chandigarh",
  "05": "Uttarakhand",
  "06": "Haryana",
  "07": "Delhi",
  "08": "Rajasthan",
  "09": "Uttar Pradesh",
  "10": "Bihar",
  "11": "Sikkim",
  "12": "Arunachal Pradesh",
  "13": "Nagaland",
  "14": "Manipur",
  "15": "Mizoram",
  "16": "Tripura",
  "17": "Meghalaya",
  "18": "Assam",
  "19": "West Bengal",
  "20": "Jharkhand",
  "21": "Odisha",
  "22": "Chhattisgarh",
  "23": "Madhya Pradesh",
  "24": "Gujarat",
  "26": "Dadra and Nagar Haveli and Daman and Diu",
  "27": "Maharashtra",
  "29": "Karnataka",
  "30": "Goa",
  "31": "Lakshadweep",
  "32": "Kerala",
  "33": "Tamil Nadu",
  "34": "Puducherry",
  "35": "Andaman and Nicobar Islands",
  "36": "Telangana",
  "37": "Andhra Pradesh",
  "38": "Ladakh",
  "96": "Other Countries",
  "97": "Other Territory",
};

export function isGstStateCode(code: string): boolean {
  return Object.prototype.hasOwnProperty.call(GST_STATE_CODES, code);
}

export function gstStateName(code: string | null): string | null {
  return code !== null && isGstStateCode(code)
    ? (GST_STATE_CODES[code] ?? null)
    : null;
}

/** 2 state digits, 10-character PAN, entity character, `Z`, check
 * character. The check character is not verified: legacy data and test
 * GSTINs do not always carry a correct one. */
export const GSTIN_PATTERN = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][0-9A-Z]Z[0-9A-Z]$/;
export const PAN_PATTERN = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
/** Indian Financial System Code: 4 letters, `0`, 6 alphanumerics. */
export const IFSC_PATTERN = /^[A-Z]{4}0[A-Z0-9]{6}$/;
/** Corporate Identification Number (21 characters). */
export const CIN_PATTERN = /^[LU][0-9]{5}[A-Z]{2}[0-9]{4}[A-Z]{3}[0-9]{6}$/;

/** The state code a GSTIN was issued in. */
export function stateCodeFromGstin(gstin: string): string {
  return gstin.slice(0, 2);
}
