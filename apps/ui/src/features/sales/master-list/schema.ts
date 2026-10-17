import { ifscField, panField, requiredText } from "@texawave-erp/core";
import { z } from "zod";
import { blankNull, optionalText } from "../shared/priced-form";
import { GST_STATES, GSTIN_PATTERN } from "../shared/gst";
import type {
  CodeType,
  CompanyProfile,
  CompanyProfileBody,
  MasterField,
  MasterOption,
  OptionBody,
} from "./types";

/**
 * Client-side checks of the master-list forms. Mirrors
 * apps/api/src/modules/sales/master-list/dto/*.ts and its rules; the API
 * stays authoritative.
 */

const STATE_CODES = new Set(GST_STATES.map((s) => s.code));

/** Empty, or a value that passes `field`. */
const blankOr = <T extends z.ZodType<string>>(field: T) =>
  z.union([z.literal(""), field]);

// --- code format (prefix + width) ------------------------------------------

const DOCUMENT_PREFIX = /^[A-Z][A-Z0-9]*(\/[A-Z0-9]+)*$/;
const CUSTOMER_PREFIX = /^[A-Z][A-Z0-9]{0,9}$/;

export function codeFormatSchema(codeType: CodeType) {
  const customer = codeType === "customer";
  return z.object({
    prefix: z
      .string()
      .trim()
      .toUpperCase()
      .min(1, "This field is required.")
      .regex(
        customer ? CUSTOMER_PREFIX : DOCUMENT_PREFIX,
        customer
          ? "1 to 10 letters or digits, starting with a letter (for example CUS)."
          : "Letters or digits starting with a letter, in /-separated parts (for example TW/QUO).",
      )
      .max(20, "At most 20 characters."),
    padding: z
      .string()
      .trim()
      .regex(/^[1-8]$/, "Enter a width from 1 to 8 digits."),
  });
}

export type CodeFormatValues = z.input<ReturnType<typeof codeFormatSchema>>;

// --- running number --------------------------------------------------------

export const runningNumberSchema = z.object({
  lastNumber: z
    .string()
    .trim()
    .regex(/^\d{1,8}$/, "Enter a whole number from 0 to 99999999."),
});

export type RunningNumberValues = z.input<typeof runningNumberSchema>;

// --- company details ---------------------------------------------------------

export const companySchema = z
  .object({
    legalName: requiredText(200),
    tagline: optionalText(200),
    address: requiredText(1000),
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
    email: blankOr(
      z.string().trim().max(254).email("Enter a valid email address."),
    ),
    phone: blankOr(
      z
        .string()
        .trim()
        .regex(/^[0-9+()\- ]{6,30}$/, "Enter a phone number (6 to 30 digits)."),
    ),
  })
  .superRefine((v, ctx) => {
    const issue = (path: string, message: string) =>
      ctx.addIssue({ code: "custom", path: [path], message });
    if (v.gstin) {
      if (!STATE_CODES.has(v.gstin.slice(0, 2))) {
        issue("gstin", "The GSTIN does not start with a valid state code.");
      }
      if (v.pan && v.gstin.slice(2, 12).toUpperCase() !== v.pan.toUpperCase()) {
        issue("pan", "PAN does not match the GSTIN.");
      }
    } else if (!STATE_CODES.has(v.stateCode)) {
      issue("stateCode", "Select the GST state (or enter a GSTIN).");
    }
  });

export type CompanyValues = z.input<typeof companySchema>;

export function companyToForm(p: CompanyProfile | null): CompanyValues {
  return {
    legalName: p?.legalName ?? "",
    tagline: p?.tagline ?? "",
    address: p?.address ?? "",
    gstin: p?.gstin ?? "",
    stateCode: p?.stateCode ?? "",
    pan: p?.pan ?? "",
    email: p?.email ?? "",
    phone: p?.phone ?? "",
  };
}

export function companyToBody(v: CompanyValues): CompanyProfileBody {
  const gstin = blankNull(v.gstin)?.toUpperCase() ?? null;
  return {
    legalName: v.legalName.trim(),
    tagline: blankNull(v.tagline),
    address: v.address.trim(),
    gstin,
    // With a GSTIN the server takes the state from it.
    stateCode: gstin ? gstin.slice(0, 2) : blankNull(v.stateCode),
    pan: blankNull(v.pan)?.toUpperCase() ?? null,
    email: blankNull(v.email),
    phone: blankNull(v.phone),
  };
}

// --- document field option -------------------------------------------------

export interface OptionValues {
  label: string;
  value: string;
  bankName: string;
  accountNumber: string;
  branch: string;
  ifsc: string;
  isDefault: boolean;
  sortOrder: string;
}

const sortOrder = z
  .string()
  .trim()
  .regex(/^\d{1,4}$/, "Enter a number from 0 to 9999.");

/** One schema per field kind: HSN (code + description), bank account,
 * payment mode (≤ 50) and plain text (validity, terms, seal, signature,
 * prepared-by). */
export function optionSchema(field: MasterField) {
  const base = { isDefault: z.boolean(), sortOrder };
  const any = z.string();
  if (field === "HSN_CODE") {
    return z.object({
      ...base,
      value: z
        .string()
        .trim()
        .regex(/^[0-9]{4,8}$/, "HSN code must be 4 to 8 digits."),
      label: optionalText(200),
      bankName: any,
      accountNumber: any,
      branch: any,
      ifsc: any,
    });
  }
  if (field === "BANK_ACCOUNT") {
    return z.object({
      ...base,
      label: optionalText(200),
      value: any,
      bankName: requiredText(150),
      accountNumber: z
        .string()
        .trim()
        .regex(/^[0-9]{6,20}$/, "Account number must be 6 to 20 digits."),
      branch: optionalText(150),
      ifsc: ifscField,
    });
  }
  return z.object({
    ...base,
    label: requiredText(field === "PAYMENT_MODE" ? 50 : 200),
    value: any,
    bankName: any,
    accountNumber: any,
    branch: any,
    ifsc: any,
  });
}

export function optionToForm(o: MasterOption | null): OptionValues {
  return {
    label:
      o?.field === "HSN_CODE" && o.label === o.value ? "" : (o?.label ?? ""),
    value: o?.value ?? "",
    bankName: o?.bankDetails?.bankName ?? "",
    accountNumber: o?.bankDetails?.accountNumber ?? "",
    branch: o?.bankDetails?.branch ?? "",
    ifsc: o?.bankDetails?.ifsc ?? "",
    isDefault: o?.isDefault ?? false,
    sortOrder: String(o?.sortOrder ?? 0),
  };
}

export function optionToBody(field: MasterField, v: OptionValues): OptionBody {
  const common = {
    isDefault: v.isDefault,
    sortOrder: Number(v.sortOrder),
  };
  if (field === "HSN_CODE") {
    return { ...common, value: v.value.trim(), label: blankNull(v.label) };
  }
  if (field === "BANK_ACCOUNT") {
    return {
      ...common,
      label: blankNull(v.label),
      bankDetails: {
        bankName: v.bankName.trim(),
        accountNumber: v.accountNumber.trim(),
        branch: blankNull(v.branch),
        ifsc: v.ifsc.trim().toUpperCase(),
      },
    };
  }
  return { ...common, label: v.label.trim() };
}
