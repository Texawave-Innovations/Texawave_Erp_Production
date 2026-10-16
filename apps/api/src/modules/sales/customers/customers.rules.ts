import { BusinessRuleViolationException } from "../../../common/exceptions/business.exception.js";
import { mobileFormatFor } from "../../../common/dto/field-formats.js";
import { isGstStateCode, stateCodeFromGstin } from "../shared/gst.js";
import type { CustomerAddressDto } from "./dto/customer.dto.js";

/**
 * Pure customer rules (legacy "Add New Customer" form). No I/O — GSTIN
 * uniqueness is checked by the repository and backed by a partial unique
 * index.
 */

export interface TaxIdentityInput {
  gstin: string | null;
  stateCode: string | null;
  pan: string | null;
}

export type TaxIdentity = TaxIdentityInput;

/**
 * - The state is auto-detected from the GSTIN when not given, but stays
 *   editable (the legacy form allows overriding it).
 * - The PAN, when given with a GSTIN, must be the PAN inside it (characters
 *   3–12); it is filled in from the GSTIN when omitted.
 * - Every state code must be a known GST state.
 */
export function resolveTaxIdentity(input: TaxIdentityInput): TaxIdentity {
  const { gstin } = input;
  let { stateCode, pan } = input;

  if (gstin !== null) {
    const gstinState = stateCodeFromGstin(gstin);
    if (!isGstStateCode(gstinState)) {
      throw new BusinessRuleViolationException(
        `GSTIN ${gstin} starts with an unknown state code "${gstinState}"`,
        "INVALID_GSTIN",
      );
    }
    stateCode ??= gstinState;
    const embedded = gstin.slice(2, 12);
    if (pan !== null && pan !== embedded) {
      throw new BusinessRuleViolationException(
        `PAN ${pan} does not match the PAN inside GSTIN ${gstin} (${embedded})`,
        "PAN_GSTIN_MISMATCH",
      );
    }
    pan ??= embedded;
  }
  if (stateCode !== null && !isGstStateCode(stateCode)) {
    throw new BusinessRuleViolationException(
      `Unknown GST state code "${stateCode}"`,
      "INVALID_STATE_CODE",
    );
  }
  return { gstin, stateCode, pan };
}

/**
 * Validates an address set and settles the defaults: at most one default per
 * type, and when a type has addresses but none is marked default, the first
 * one becomes the default (so a document always has one to pick).
 */
export function normalizeAddresses(
  addresses: readonly CustomerAddressDto[],
): CustomerAddressDto[] {
  for (const type of ["BILLING", "SHIPPING"] as const) {
    const ofType = addresses.filter((a) => a.addressType === type);
    if (ofType.filter((a) => a.isDefault).length > 1) {
      throw new BusinessRuleViolationException(
        `Only one default ${type.toLowerCase()} address is allowed`,
        "MULTIPLE_DEFAULT_ADDRESSES",
      );
    }
  }
  for (const a of addresses) {
    if (!isGstStateCode(a.stateCode)) {
      throw new BusinessRuleViolationException(
        `Unknown GST state code "${a.stateCode}" on address "${a.label}"`,
        "INVALID_STATE_CODE",
      );
    }
  }
  const seenDefault = new Set(
    addresses.filter((a) => a.isDefault).map((a) => a.addressType),
  );
  return addresses.map((a) => {
    if (a.isDefault || seenDefault.has(a.addressType)) {
      return { ...a, isDefault: a.isDefault ?? false };
    }
    seenDefault.add(a.addressType);
    return { ...a, isDefault: true };
  });
}

/** `50100234567890` → `**********7890`. */
export function maskAccountNumber(value: string): string {
  return value.length <= 4
    ? "*".repeat(value.length)
    : `${"*".repeat(value.length - 4)}${value.slice(-4)}`;
}

export interface ContactAndBankInput {
  mobileCountryCode: string;
  mobileNumber: string;
  cgstRate: number | string | null;
  sgstRate: number | string | null;
  bankName: string | null;
  /** True when an account number is (or stays) stored. */
  hasAccountNumber: boolean;
  bankIfsc: string | null;
}

/**
 * Rules across fields, checked on the merged values (stored + changed):
 * - an Indian (+91) mobile is 10 digits starting with 6-9 (the onboarding
 *   format); other countries keep the DTO's 6-15 digits;
 * - CGST and SGST are charged together, at the same rate;
 * - a bank account number needs its bank name and IFSC.
 */
export function assertContactAndBank(
  input: ContactAndBankInput,
  /** On update, only the groups whose fields were sent are checked, so a
   * customer stored before these rules can still be edited. */
  check: { mobile: boolean; gst: boolean; bank: boolean } = {
    mobile: true,
    gst: true,
    bank: true,
  },
): void {
  const mobile = mobileFormatFor(input.mobileCountryCode);
  if (check.mobile && !mobile.pattern.test(input.mobileNumber)) {
    throw new BusinessRuleViolationException(mobile.message, "INVALID_MOBILE");
  }
  const cgst = input.cgstRate === null ? null : Number(input.cgstRate);
  const sgst = input.sgstRate === null ? null : Number(input.sgstRate);
  if (
    check.gst &&
    ((cgst === null) !== (sgst === null) || (cgst !== null && cgst !== sgst))
  ) {
    throw new BusinessRuleViolationException(
      "CGST and SGST are entered together, at the same rate",
      "GST_RATES_MISMATCH",
    );
  }
  if (
    check.bank &&
    input.hasAccountNumber &&
    (!input.bankName || !input.bankIfsc)
  ) {
    throw new BusinessRuleViolationException(
      "A bank account number needs the bank name and IFSC",
      "BANK_DETAILS_INCOMPLETE",
    );
  }
}
