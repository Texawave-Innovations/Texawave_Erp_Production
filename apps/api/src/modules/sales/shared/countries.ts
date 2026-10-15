/**
 * Mobile country calling code → ISO 3166-1 alpha-2 country, for the country
 * part of a customer code (`+91` → `IN` → CUS-IN-001). A calling code shared
 * by several countries maps to the main one (`+1` → `US`). Add a row here to
 * support a new country; anything not listed is rejected by validation.
 */
export const CALLING_CODE_COUNTRIES: Readonly<Record<string, string>> = {
  "+91": "IN",
  "+1": "US",
  "+44": "GB",
  "+971": "AE",
  "+966": "SA",
  "+974": "QA",
  "+968": "OM",
  "+965": "KW",
  "+973": "BH",
  "+65": "SG",
  "+60": "MY",
  "+61": "AU",
  "+64": "NZ",
  "+49": "DE",
  "+33": "FR",
  "+39": "IT",
  "+31": "NL",
  "+81": "JP",
  "+82": "KR",
  "+86": "CN",
  "+94": "LK",
  "+977": "NP",
  "+880": "BD",
  "+27": "ZA",
};

export const CALLING_CODES = Object.keys(CALLING_CODE_COUNTRIES);

/** `+91` → `IN`; throws for an unsupported code (validation rejects those
 * first, so reaching this is a bug). */
export function countryFromCallingCode(callingCode: string): string {
  const country = CALLING_CODE_COUNTRIES[callingCode];
  if (!country) {
    throw new Error(`Unsupported mobile country code ${callingCode}`);
  }
  return country;
}
