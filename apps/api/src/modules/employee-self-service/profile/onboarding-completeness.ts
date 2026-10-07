import type { DocumentType } from "./dto/onboarding-rules.js";

export const REQUIRED_DOCUMENT_TYPES: readonly DocumentType[] = [
  "PROFILE_PHOTO",
  "AADHAAR",
  "PAN",
  "BANK_STATEMENT",
  "CERT_10TH",
  "CERT_12TH",
  "CERT_GRADUATION",
];

export interface OnboardingSnapshot {
  personal: Record<string, unknown> | null;
  permanentAddress: Record<string, unknown> | null;
  presentAddress: Record<string, unknown> | null;
  bank: Record<string, unknown> | null;
  governmentIds: Record<string, unknown> | null;
  documents: { documentType: string }[];
}

const REQUIRED_PERSONAL = [
  "dateOfBirth",
  "gender",
  "emergencyContactName",
  "emergencyContactRelation",
  "emergencyContactPhone",
  "fatherName",
  "fatherPhone",
  "motherName",
  "motherPhone",
] as const;

const REQUIRED_ADDRESS = [
  "addressLine",
  "district",
  "city",
  "state",
  "pincode",
] as const;

const REQUIRED_BANK = [
  "accountHolderName",
  "accountNumberEncrypted",
  "ifsc",
  "bankName",
] as const;

const REQUIRED_GOV = ["aadhaarNumber", "panNumber"] as const;

const isFilled = (value: unknown): boolean =>
  value !== undefined && value !== null && String(value).trim() !== "";

/** Returns human-readable names of every required item still missing. An
 * empty array means the profile is complete and may be submitted. The present
 * address is only required when the employee did not tick "same as permanent". */
export function missingOnboardingItems(snapshot: OnboardingSnapshot): string[] {
  const missing: string[] = [];

  for (const field of REQUIRED_PERSONAL) {
    if (!isFilled(snapshot.personal?.[field]))
      missing.push(`personal.${field}`);
  }
  for (const field of REQUIRED_ADDRESS) {
    if (!isFilled(snapshot.permanentAddress?.[field])) {
      missing.push(`permanentAddress.${field}`);
    }
  }
  for (const field of REQUIRED_BANK) {
    if (!isFilled(snapshot.bank?.[field])) missing.push(`bank.${field}`);
  }
  for (const field of REQUIRED_GOV) {
    if (!isFilled(snapshot.governmentIds?.[field])) {
      missing.push(`governmentIds.${field}`);
    }
  }
  const uploaded = new Set(snapshot.documents.map((d) => d.documentType));
  for (const type of REQUIRED_DOCUMENT_TYPES) {
    if (!uploaded.has(type)) missing.push(`document.${type}`);
  }

  return missing;
}
