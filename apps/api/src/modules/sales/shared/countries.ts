import { CALLING_CODE_COUNTRIES } from "../../../common/dto/field-formats.js";

/** The supported codes and the default live in common/dto/field-formats.ts
 * (shared with every module); re-exported for the Sales callers. */
export {
  CALLING_CODE_COUNTRIES,
  CALLING_CODES,
  INDIA_CALLING_CODE,
} from "../../../common/dto/field-formats.js";

/** `+91` → `IN`, for the country part of a customer code (CUS-IN-001);
 * throws for an unsupported code (validation rejects those first, so
 * reaching this is a bug). */
export function countryFromCallingCode(callingCode: string): string {
  const country = CALLING_CODE_COUNTRIES[callingCode];
  if (!country) {
    throw new Error(`Unsupported mobile country code ${callingCode}`);
  }
  return country;
}
