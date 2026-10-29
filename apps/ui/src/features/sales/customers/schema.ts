import {
  bankAccountField,
  CALLING_CODES,
  INDIA_CALLING_CODE,
  ifscField,
  mobileFieldFor,
  optionalName,
  panField,
  pincodeField,
  requiredName,
  requiredText,
} from "@texawave-erp/core";
import { z } from "zod";
import { CIN_PATTERN, GST_STATES, GSTIN_PATTERN } from "../shared/gst";
import type {
  AddressType,
  Customer,
  CustomerBody,
  CustomerStatus,
} from "./types";

/**
 * Client-side validation of the customer form. Shared formats (names,
 * mobile, pincode, PAN, IFSC, bank account) come from
 * packages/core/src/schemas/fields.ts — the same rules as onboarding. Mirrors
 * apps/api/src/modules/sales/customers/dto/customer.dto.ts (and its service
 * rules), so the form rejects what the API rejects; the API stays
 * authoritative.
 */

const STATE_CODES = new Set(GST_STATES.map((s) => s.code));
const CALLING = new Set(CALLING_CODES.map((c) => c.code));

/** Empty, or a value that passes `field`. */
const blankOr = <T extends z.ZodType<string>>(field: T) =>
  z.union([z.literal(""), field]);

const rate = z
  .string()
  .trim()
  .refine(
    (v) =>
      v === "" ||
      (/^\d{1,3}(\.\d{1,2})?$/.test(v) && Number(v) >= 0 && Number(v) <= 100),
    { message: "Enter a percentage from 0 to 100 (up to 2 decimals)." },
  );

export const addressSchema = z.object({
  addressType: z.enum(["BILLING", "SHIPPING"]),
  label: requiredText(100),
  street: requiredText(500),
  area: optionalName(200),
  city: requiredName(100),
  stateCode: z
    .string()
    .refine((v) => STATE_CODES.has(v), { message: "Select a state." }),
  pincode: pincodeField,
  country: requiredName(100),
  isDefault: z.boolean(),
});

export const customerSchema = z
  .object({
    companyName: requiredText(200).regex(
      /[A-Za-z]/,
      "Enter a company name (it must contain letters).",
    ),
    contactPerson: requiredName(150),
    email: z
      .string()
      .trim()
      .toLowerCase()
      .min(1, "This field is required.")
      .max(254, "Must be at most 254 characters.")
      .email("Enter a valid email address."),
    mobileCountryCode: z
      .string()
      .refine((v) => CALLING.has(v), { message: "Select a country code." }),
    // Checked below with the shared rule for the chosen country code
    // (mobileFieldFor: +91 → the onboarding rule, others → 6–15 digits).
    mobileNumber: z.string().trim().min(1, "This field is required."),
    gstin: blankOr(
      z
        .string()
        .trim()
        .toUpperCase()
        .regex(
          GSTIN_PATTERN,
          "Enter a valid 15-character GSTIN (for example 33ABCDE1234F1Z5).",
        ),
    ),
    stateCode: z.string(),
    pan: blankOr(panField),
    cin: blankOr(
      z
        .string()
        .trim()
        .toUpperCase()
        .regex(CIN_PATTERN, "Enter a valid 21-character CIN."),
    ),
    cgstRate: rate,
    sgstRate: rate,
    igstRate: rate,
    bankName: optionalName(150),
    bankAccountNumber: blankOr(bankAccountField),
    bankIfsc: blankOr(ifscField),
    bankBranch: optionalName(150),
    paymentNotes: z
      .string()
      .trim()
      .max(2000, "Must be at most 2000 characters."),
    status: z.enum(["ACTIVE", "INACTIVE"]),
    addresses: z
      .array(addressSchema)
      .max(50, "At most 50 addresses.")
      .refine((list) => list.some((a) => a.addressType === "BILLING"), {
        message: "Add a billing address.",
      }),
  })
  .superRefine((v, ctx) => {
    const issue = (path: string, message: string) =>
      ctx.addIssue({ code: "custom", path: [path], message });

    const mobile = mobileFieldFor(v.mobileCountryCode).safeParse(
      v.mobileNumber,
    );
    if (!mobile.success && v.mobileNumber !== "") {
      issue("mobileNumber", mobile.error.issues[0]?.message ?? "Invalid.");
    }

    if (v.gstin) {
      if (!STATE_CODES.has(v.gstin.slice(0, 2))) {
        issue("gstin", "The GSTIN does not start with a valid state code.");
      }
      if (!v.stateCode) issue("stateCode", "Select the GST state.");
      if (v.pan && v.gstin.slice(2, 12) !== v.pan) {
        issue("pan", "PAN does not match the GSTIN.");
      }
    }
    if (v.stateCode && !STATE_CODES.has(v.stateCode)) {
      issue("stateCode", "Select a state.");
    }

    // CGST and SGST are charged together, at the same rate.
    if ((v.cgstRate === "") !== (v.sgstRate === "")) {
      issue(
        v.cgstRate === "" ? "cgstRate" : "sgstRate",
        "Enter CGST and SGST together.",
      );
    } else if (v.cgstRate !== "" && Number(v.cgstRate) !== Number(v.sgstRate)) {
      issue("sgstRate", "SGST must equal CGST.");
    }

    // Bank details are all-or-nothing: name, account number and IFSC.
    const bankGiven =
      Boolean(v.bankName) ||
      v.bankAccountNumber !== "" ||
      v.bankIfsc !== "" ||
      Boolean(v.bankBranch);
    if (bankGiven) {
      if (!v.bankName) issue("bankName", "Enter the bank name.");
      if (v.bankIfsc === "") issue("bankIfsc", "Enter the IFSC code.");
    }

    for (const type of ["BILLING", "SHIPPING"] as const) {
      const defaults = v.addresses.filter(
        (a) => a.addressType === type && a.isDefault,
      );
      if (defaults.length > 1) {
        issue(
          "addresses",
          `Only one ${type.toLowerCase()} address can be the default.`,
        );
      }
    }
  });

/** The form schema: `customerSchema` plus the account-number rule, which
 * depends on the mode — required with other bank details on create; on
 * edit, a blank keeps the stored number. */
export function customerFormSchema(opts: {
  mode: "create" | "edit";
  hasStoredAccount: boolean;
}) {
  return customerSchema.superRefine((v, ctx) => {
    const bankGiven = Boolean(v.bankName) || v.bankIfsc !== "";
    if (!bankGiven || v.bankAccountNumber !== "") return;
    if (opts.mode === "create" || !opts.hasStoredAccount) {
      ctx.addIssue({
        code: "custom",
        path: ["bankAccountNumber"],
        message: "Enter the account number.",
      });
    }
  });
}

export type CustomerFormValues = z.input<typeof customerSchema>;
export type AddressFormValues = z.input<typeof addressSchema>;

export function emptyAddress(addressType: AddressType): AddressFormValues {
  return {
    addressType,
    label: addressType === "BILLING" ? "Billing" : "Shipping",
    street: "",
    area: "",
    city: "",
    stateCode: "",
    pincode: "",
    country: "India",
    isDefault: false,
  };
}

export const EMPTY_CUSTOMER_FORM: CustomerFormValues = {
  companyName: "",
  contactPerson: "",
  email: "",
  mobileCountryCode: INDIA_CALLING_CODE,
  mobileNumber: "",
  gstin: "",
  stateCode: "",
  pan: "",
  cin: "",
  cgstRate: "",
  sgstRate: "",
  igstRate: "",
  bankName: "",
  bankAccountNumber: "",
  bankIfsc: "",
  bankBranch: "",
  paymentNotes: "",
  status: "ACTIVE",
  addresses: [{ ...emptyAddress("BILLING"), isDefault: true }],
};

/** A stored customer as form values (the account number stays blank: the
 * API only returns its mask; blank on save = keep the stored number). */
export function customerToForm(c: Customer): CustomerFormValues {
  return {
    companyName: c.companyName,
    contactPerson: c.contactPerson,
    email: c.email,
    mobileCountryCode: c.mobileCountryCode,
    mobileNumber: c.mobileNumber,
    gstin: c.gstin ?? "",
    stateCode: c.stateCode ?? "",
    pan: c.pan ?? "",
    cin: c.cin ?? "",
    cgstRate: c.cgstRate ?? "",
    sgstRate: c.sgstRate ?? "",
    igstRate: c.igstRate ?? "",
    bankName: c.bankName ?? "",
    bankAccountNumber: "",
    bankIfsc: c.bankIfsc ?? "",
    bankBranch: c.bankBranch ?? "",
    paymentNotes: c.paymentNotes ?? "",
    status: c.status,
    addresses: c.addresses.map((a) => ({
      addressType: a.addressType,
      label: a.label,
      street: a.street,
      area: a.area ?? "",
      city: a.city,
      stateCode: a.stateCode,
      pincode: a.pincode,
      country: a.country,
      isDefault: a.isDefault,
    })),
  };
}

const orNull = (v: string | undefined) => (v ? v : null);
const rateOrNull = (v: string) => (v === "" ? null : Number(v));

/** Parsed form values → request body. `keepBankAccount`: on edit, a blank
 * account number means "unchanged", so the field is left out. */
export function formToBody(
  v: z.output<typeof customerSchema>,
  opts: { keepBankAccount: boolean },
): CustomerBody {
  return {
    companyName: v.companyName,
    contactPerson: v.contactPerson,
    email: v.email,
    mobileCountryCode: v.mobileCountryCode,
    mobileNumber: v.mobileNumber,
    gstin: orNull(v.gstin),
    stateCode: orNull(v.stateCode),
    cgstRate: rateOrNull(v.cgstRate),
    sgstRate: rateOrNull(v.sgstRate),
    igstRate: rateOrNull(v.igstRate),
    pan: orNull(v.pan),
    cin: orNull(v.cin),
    bankName: orNull(v.bankName),
    ...(opts.keepBankAccount && v.bankAccountNumber === ""
      ? {}
      : { bankAccountNumber: orNull(v.bankAccountNumber) }),
    bankIfsc: orNull(v.bankIfsc),
    bankBranch: orNull(v.bankBranch),
    paymentNotes: orNull(v.paymentNotes),
    status: v.status as CustomerStatus,
    addresses: v.addresses.map((a) => ({
      addressType: a.addressType,
      label: a.label,
      street: a.street,
      ...(a.area ? { area: a.area } : {}),
      city: a.city,
      stateCode: a.stateCode,
      pincode: a.pincode,
      country: a.country,
      isDefault: a.isDefault,
    })),
  };
}
