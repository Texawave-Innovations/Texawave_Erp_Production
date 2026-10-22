import type { CrmMiningRow } from "@texawave-erp/api-types";
import { MINING_PRIORITIES } from "@texawave-erp/api-types";

/** Editable text columns of a mining row (everything except id/audit/link
 * columns and `customFields`). */
export type MiningFieldKey =
  | "serialNo"
  | "minedDate"
  | "domain"
  | "companyName"
  | "hq"
  | "website"
  | "keyDecisionMakers"
  | "title"
  | "contactNumber"
  | "email"
  | "emailStatus"
  | "followUpStatus"
  | "industry"
  | "numberOfEmployees"
  | "city"
  | "state"
  | "country"
  | "linkedInProfile"
  | "assignedTo"
  | "priority"
  | "nextFollowUpDate"
  | "notes";

export type MiningFormValues = Record<MiningFieldKey, string>;

export interface MiningFieldDef {
  key: MiningFieldKey;
  label: string;
  type?: "text" | "textarea" | "select";
  options?: readonly string[];
  span?: 2;
  required?: boolean;
}

export interface MiningSectionDef {
  id: string;
  title: string;
  description: string;
  fields: MiningFieldDef[];
}

/** Sections/fields/order mirror legacy AccountsMiningSheet.tsx `SECTIONS`
 * exactly (legacy `date` is `minedDate`). */
export const MINING_SECTIONS: MiningSectionDef[] = [
  {
    id: "basic",
    title: "Basic Information",
    description: "Serial number and date this account was mined.",
    fields: [
      { key: "serialNo", label: "Serial No" },
      { key: "minedDate", label: "Date" },
    ],
  },
  {
    id: "company",
    title: "Company Details",
    description: "Company identity and web presence.",
    fields: [
      { key: "domain", label: "Domain" },
      { key: "companyName", label: "Name of the Company", required: true },
      { key: "hq", label: "HQ" },
      { key: "website", label: "Website" },
    ],
  },
  {
    id: "decision-maker",
    title: "Decision Maker",
    description: "Key contact identified at this company.",
    fields: [
      {
        key: "keyDecisionMakers",
        label: "Key Decision Makers",
        type: "textarea",
      },
      { key: "title", label: "Title" },
      { key: "contactNumber", label: "Contact Number" },
      { key: "email", label: "Email ID" },
    ],
  },
  {
    id: "follow-up",
    title: "Follow-up Status",
    description: "Outreach and follow-up tracking.",
    fields: [
      { key: "emailStatus", label: "Email Status" },
      { key: "followUpStatus", label: "Follow-up Status" },
    ],
  },
  {
    id: "business-profile",
    title: "Business Profile",
    description: "Additional company profile and location details.",
    fields: [
      { key: "industry", label: "Industry" },
      { key: "numberOfEmployees", label: "No. of Employees" },
      { key: "city", label: "City" },
      { key: "state", label: "State / Province" },
      { key: "country", label: "Country" },
      { key: "linkedInProfile", label: "LinkedIn Profile" },
    ],
  },
  {
    id: "ownership",
    title: "Ownership & Next Steps",
    description: "Ownership, priority and next follow-up for this account.",
    fields: [
      { key: "assignedTo", label: "Assigned To" },
      {
        key: "priority",
        label: "Priority",
        type: "select",
        options: MINING_PRIORITIES,
      },
      { key: "nextFollowUpDate", label: "Next Follow-up Date" },
      { key: "notes", label: "Notes", type: "textarea", span: 2 },
    ],
  },
];

/** Toggleable list columns (legacy `COLUMN_META`); Actions always shows. */
export type MiningColumnKey =
  "company" | "decisionMaker" | "contactNumber" | "followUpStatus";

export const MINING_COLUMNS: { key: MiningColumnKey; label: string }[] = [
  { key: "company", label: "Company" },
  { key: "decisionMaker", label: "Decision Maker" },
  { key: "contactNumber", label: "Contact Number" },
  { key: "followUpStatus", label: "Follow-up Status" },
];

export function emptyMiningValues(): MiningFormValues {
  const values = {} as MiningFormValues;
  for (const section of MINING_SECTIONS)
    for (const f of section.fields) values[f.key] = "";
  return values;
}

export function miningValuesFromRow(row: CrmMiningRow): MiningFormValues {
  const values = emptyMiningValues();
  for (const key of Object.keys(values) as MiningFieldKey[])
    values[key] = row[key] ?? "";
  return values;
}
