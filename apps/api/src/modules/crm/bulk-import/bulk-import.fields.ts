import { isEmail } from "class-validator";
import {
  ACCOUNT_TYPES,
  BUSINESS_TYPES,
  CUSTOMER_CATEGORIES,
  CUSTOMER_CLASSES,
} from "../accounts/dto/account.dto.js";
import {
  LEAD_PRIORITIES,
  LEAD_RATINGS,
  LEAD_STATUSES,
} from "../leads/dto/lead.dto.js";
import { MEETING_STATUSES } from "../meetings/dto/meeting.dto.js";
import {
  FORECAST_CATEGORIES,
  OPPORTUNITY_PRIORITIES,
} from "../opportunities/dto/opportunity.dto.js";

/**
 * Pure (framework-free) field specs + header matching + value coercion for
 * CRM Bulk Import. Ports legacy `importExport/fieldMatch.ts` and the per-tab
 * `FieldSchema` lists (Leads.tsx, Accounts.tsx, Contacts.tsx, Products.tsx,
 * AccountsMiningSheet.tsx, ColdCallingStatus.tsx, bulkImport/
 * crmBulkImportSheets.ts). Header matching is intentionally conservative:
 * exact (case/whitespace-insensitive) match on label, key or alias only —
 * never fuzzy.
 */

export const IMPORT_ENTITIES = [
  "leads",
  "accounts",
  "contacts",
  "products",
  "mining-rows",
  "cold-calling",
  "meetings",
  "call-back-send-info",
  "not-interested",
  "keep-in-touch",
  "opportunities",
] as const;
export type ImportEntity = (typeof IMPORT_ENTITIES)[number];

/** Legacy `CrmCustomFieldModule` buckets (`crm/customFieldDefs/<module>`). */
export const CUSTOM_FIELD_MODULES = [
  "leads",
  "accountsMining",
  "accounts",
  "meetings",
  "coldCalling",
] as const;
export type CustomFieldModule = (typeof CUSTOM_FIELD_MODULES)[number];

export const ENTITY_CUSTOM_MODULE: Record<
  ImportEntity,
  CustomFieldModule | null
> = {
  leads: "leads",
  accounts: "accounts",
  contacts: null,
  products: null,
  "mining-rows": "accountsMining",
  "cold-calling": "coldCalling",
  meetings: "meetings",
  "call-back-send-info": "accounts",
  "not-interested": "accounts",
  "keep-in-touch": "accounts",
  opportunities: null,
};

export type ImportFieldType =
  "string" | "number" | "email" | "date" | "select" | "boolean" | "tags";

export interface ImportFieldSpec {
  key: string;
  label: string;
  aliases?: string[];
  type?: ImportFieldType;
  options?: readonly string[];
  required?: boolean;
}

const f = (
  key: string,
  label: string,
  extra: Partial<Omit<ImportFieldSpec, "key" | "label">> = {},
): ImportFieldSpec => ({ key, label, ...extra });

const COMPANY = (label: string, aliases: string[]) =>
  f("companyName", label, { required: true, aliases });

const STATUS_SHEET_COMMON = [
  f("domain", "Domain"),
  f("prospectName", "Prospect Name"),
  f("title", "Title"),
];

export const ENTITY_FIELD_SPECS: Record<ImportEntity, ImportFieldSpec[]> = {
  // Legacy Pipeline.tsx `buildDealFields()`. New deals land in the first
  // board stage with OPEN status.
  opportunities: [
    f("title", "Deal Title", {
      required: true,
      aliases: ["Opportunity", "Deal Name"],
    }),
    f("accountName", "Account", {
      required: true,
      aliases: ["Account Name", "Company", "Company Name"],
    }),
    f("contactName", "Contact", { aliases: ["Contact Name"] }),
    f("ownerName", "Owner", { required: true, aliases: ["Deal Owner"] }),
    f("estimatedValue", "Estimated Value", {
      required: true,
      type: "number",
    }),
    f("currency", "Currency"),
    f("expectedCloseDate", "Expected Close Date", { type: "date" }),
    f("priority", "Priority", {
      type: "select",
      options: OPPORTUNITY_PRIORITIES,
    }),
    f("nextAction", "Next Action"),
    f("nextActionDate", "Next Action Date", { type: "date" }),
    f("campaignSource", "Campaign Source"),
    f("forecastCategory", "Forecast Category", {
      type: "select",
      options: FORECAST_CATEGORIES,
    }),
  ],
  leads: [
    COMPANY("Name of the Company", ["Company Name", "Company"]),
    f("domain", "Domain / Website", { aliases: ["Website"] }),
    f("industry", "Industry"),
    f("annualRevenue", "Annual Revenue"),
    f("numberOfEmployees", "No. of Employees", {
      aliases: ["Number Of Employees"],
    }),
    f("prospectName", "Prospect / Lead Name", {
      required: true,
      aliases: ["Contact Name", "Lead Name", "Prospect Name"],
    }),
    f("title", "Title"),
    f("contactNumber", "Phone", {
      aliases: ["Contact Number", "Mobile Number"],
    }),
    f("mobile", "Mobile"),
    f("email", "Email id", {
      type: "email",
      aliases: ["Email", "Email ID"],
    }),
    f("fax", "Fax"),
    f("skypeId", "Skype ID"),
    f("leadStatus", "Lead Status", { type: "select", options: LEAD_STATUSES }),
    f("leadSource", "Lead Source"),
    f("assignedTo", "Lead Owner (Assigned To)", { aliases: ["Lead Owner"] }),
    f("priority", "Priority", { type: "select", options: LEAD_PRIORITIES }),
    f("rating", "Rating", { type: "select", options: LEAD_RATINGS }),
    f("meetingStatus", "Meeting Status"),
    f("month", "Month"),
    f("meetingScheduled", "Meeting Scheduled"),
    f("hq", "HQ"),
    f("addressStreet", "Address"),
    f("city", "City"),
    f("state", "State / Province"),
    f("postalCode", "Postal / ZIP Code"),
    f("country", "Country"),
    f("tags", "Tags (comma-separated)"),
    f("emailOptOut", "Email Opt Out", { type: "boolean" }),
    f("dataProcessingBasis", "Data Processing Basis"),
    f("areaOfInterest", "Area of Interest / Requirement"),
    f("comments", "Comments / Description"),
  ],
  accounts: [
    f("name", "Account Name", {
      required: true,
      aliases: ["Company Name", "Company", "Account"],
    }),
    f("accountType", "Type", { type: "select", options: ACCOUNT_TYPES }),
    f("industry", "Industry"),
    f("website", "Website"),
    f("hq", "HQ", { aliases: ["Location"] }),
    f("phone", "Phone", { aliases: ["Contact Number"] }),
    f("email", "Email", { type: "email" }),
    f("ownerName", "Owner", { aliases: ["Account Owner"] }),
    f("registrationNumber", "Registration Number"),
    f("numberOfEmployees", "Number of Employees", { type: "number" }),
    f("annualRevenue", "Annual Revenue", { type: "number" }),
    f("description", "Description"),
    f("billingStreet", "Billing Street"),
    f("billingCity", "Billing City"),
    f("billingState", "Billing State"),
    f("billingPostalCode", "Billing Postal Code"),
    f("billingCountry", "Billing Country"),
    f("shippingStreet", "Shipping Street"),
    f("shippingCity", "Shipping City"),
    f("shippingState", "Shipping State"),
    f("shippingPostalCode", "Shipping Postal Code"),
    f("shippingCountry", "Shipping Country"),
    f("customerCategory", "Customer Category", {
      type: "select",
      options: CUSTOMER_CATEGORIES,
    }),
    f("customerClass", "Customer Class", {
      type: "select",
      options: CUSTOMER_CLASSES,
    }),
    f("businessType", "Business Type", {
      type: "select",
      options: BUSINESS_TYPES,
    }),
    f("resellerType", "Reseller Type"),
    f("tags", "Tags (comma-separated)", { type: "tags" }),
  ],
  contacts: [
    f("accountName", "Account", {
      required: true,
      aliases: ["Account Name", "Company", "Company Name"],
    }),
    f("name", "Full Name", { required: true, aliases: ["Contact Name"] }),
    f("designation", "Designation"),
    f("department", "Department"),
    f("email", "Email", { type: "email", aliases: ["Email ID"] }),
    f("phone", "Phone", { aliases: ["Contact Number", "Mobile Number"] }),
    f("whatsapp", "WhatsApp"),
    f("isPrimary", "Primary Contact", { type: "boolean" }),
    f("isDecisionMaker", "Decision Maker", { type: "boolean" }),
  ],
  products: [
    f("name", "Product Name", { required: true }),
    f("code", "Code / SKU", {
      required: true,
      aliases: ["Product Code", "SKU"],
    }),
    f("category", "Category"),
    f("vendor", "Vendor"),
    f("unitPrice", "Unit Price", { required: true, type: "number" }),
    f("taxPercent", "Tax %", { type: "number" }),
    f("description", "Description"),
    f("isActive", "Active", { type: "boolean" }),
  ],
  "mining-rows": [
    f("serialNo", "Serial No"),
    f("minedDate", "Date"),
    f("domain", "Domain"),
    COMPANY("Name of the Company", ["Company Name", "Company"]),
    f("hq", "HQ"),
    f("website", "Website"),
    f("keyDecisionMakers", "Key Decision Makers", {
      aliases: ["Decision Maker", "Key Decision Maker"],
    }),
    f("title", "Title"),
    f("contactNumber", "Contact Number", {
      aliases: ["Phone", "Mobile Number"],
    }),
    f("email", "Email ID", { type: "email", aliases: ["Email"] }),
    f("emailStatus", "Email Status"),
    f("followUpStatus", "Follow-up Status"),
    f("industry", "Industry"),
    f("numberOfEmployees", "No. of Employees"),
    f("city", "City"),
    f("state", "State / Province"),
    f("country", "Country"),
    f("linkedInProfile", "LinkedIn Profile"),
    f("assignedTo", "Assigned To"),
    f("priority", "Priority", { type: "select", options: LEAD_PRIORITIES }),
    f("nextFollowUpDate", "Next Follow-up Date"),
    f("notes", "Notes"),
  ],
  "cold-calling": [
    f("serialNo", "Serial No", { aliases: ["SINO", "S.No", "Sl No"] }),
    f("callDate", "Date", { type: "date" }),
    COMPANY("Company Name", ["Name of the Company", "Company"]),
    f("prospectName", "Prospect Name"),
    f("designation", "Designation", { aliases: ["Title"] }),
    f("status", "Status", { aliases: ["Cold Calling Status", "Call Status"] }),
  ],
  meetings: [
    f("meetingStatusRaw", "Meeting Status"),
    f("recordDate", "Date"),
    f("meetingScheduled", "Meeting Scheduled", {
      required: true,
      type: "date",
    }),
    COMPANY("Name of the Company", ["Company Name", "Company"]),
    f("domain", "Domain"),
    f("hq", "HQ"),
    f("prospectName", "Prospect Name"),
    f("title", "Title"),
    f("contactNumber", "Contact Number"),
    f("email", "Email id", { type: "email", aliases: ["Email ID", "Email"] }),
    f("areaOfInterest", "Area of Interest / Requirement"),
    f("comments", "Comments"),
  ],
  "call-back-send-info": [
    COMPANY("Name of the Company", ["Company Name", "Company"]),
    ...STATUS_SHEET_COMMON,
    f("email", "Email ID", { type: "email", aliases: ["Email id", "Email"] }),
    f("source", "Source"),
    f("recordDate", "Date"),
    f("responseNotes", "Response/Comments", {
      aliases: ["Response / Comments", "Comments"],
    }),
    f("statusDate", "Next Follow-up", {
      required: true,
      type: "date",
      aliases: ["Next Follow Up", "Follow-up Date"],
    }),
  ],
  "not-interested": [
    COMPANY("Company Name", ["Name of the Company", "Company"]),
    ...STATUS_SHEET_COMMON,
    f("email", "Email id", { type: "email", aliases: ["Email ID", "Email"] }),
    f("source", "Source"),
    f("recordDate", "Date"),
    f("statusReason", "Response/Comments", {
      required: true,
      aliases: ["Response / Comments", "Comments"],
    }),
  ],
  "keep-in-touch": [
    COMPANY("Name of the Company", ["Company Name", "Company"]),
    f("prospectName", "Prospect Name"),
    f("title", "Title"),
    f("email", "Email ID", { type: "email", aliases: ["Email id", "Email"] }),
    f("source", "Source"),
    f("recordDate", "Date"),
    f("responseNotes", "Response/Comments", {
      aliases: ["Response / Comments", "Comments"],
    }),
    f("statusDate", "Next Follow-up", {
      required: true,
      type: "date",
      aliases: ["Next Follow Up", "Follow-up Date"],
    }),
  ],
};

export function isImportEntity(value: string): value is ImportEntity {
  return (IMPORT_ENTITIES as readonly string[]).includes(value);
}

/** Header/label normalisation shared with legacy: trim, lower-case,
 * collapse whitespace / `_` / `-` runs into one space. */
export function normalizeLabel(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, " ");
}

/** Storage-safe camelCase key from a raw header ("Source / Market Region"
 * -> "sourceMarketRegion"). Returns "" when nothing usable remains. */
export function slugifyHeaderToKey(header: string): string {
  const words = header
    .trim()
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean);
  const [first, ...rest] = words;
  if (first === undefined) return "";
  return (
    first.toLowerCase() +
    rest
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join("")
  );
}

/** Auto-maps each header (by position) to a field key via exact/alias match.
 * A field is claimed by at most one header (first wins). Unmatched -> null.
 * No fuzzy matching. */
export function autoMatchHeaders(
  headers: readonly string[],
  fields: readonly ImportFieldSpec[],
): (string | null)[] {
  const byNormalized = new Map<string, string>();
  for (const field of fields) {
    byNormalized.set(normalizeLabel(field.label), field.key);
    byNormalized.set(normalizeLabel(field.key), field.key);
    for (const alias of field.aliases ?? []) {
      byNormalized.set(normalizeLabel(alias), field.key);
    }
  }
  const used = new Set<string>();
  return headers.map((header) => {
    const match = byNormalized.get(normalizeLabel(header));
    if (match && !used.has(match)) {
      used.add(match);
      return match;
    }
    return null;
  });
}

export interface CoerceResult {
  data: Record<string, unknown>;
  errors: string[];
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function toIsoDate(raw: string): string | undefined {
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const d = new Date(`${raw}T00:00:00Z`);
    return Number.isNaN(d.getTime()) ? undefined : raw;
  }
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return undefined;
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function matchOption(
  options: readonly string[],
  raw: string,
): string | undefined {
  const norm = (s: string) =>
    s
      .trim()
      .toLowerCase()
      .replace(/[\s_-]+/g, " ");
  return options.find((o) => norm(o) === norm(raw));
}

/** Coerces one raw string cell per field spec: trims, parses numbers /
 * booleans / dates / selects / tags and collects per-field errors. Empty
 * cells are omitted (so an "update" never blanks existing data). Missing
 * required fields are reported. */
export function coerceRow(
  fields: readonly ImportFieldSpec[],
  values: Record<string, string>,
): CoerceResult {
  const data: Record<string, unknown> = {};
  const errors: string[] = [];
  for (const field of fields) {
    const raw = (values[field.key] ?? "").trim();
    if (!raw) {
      if (field.required)
        errors.push(`Missing required field "${field.label}"`);
      continue;
    }
    switch (field.type) {
      case "email":
        if (!isEmail(raw)) errors.push(`Invalid email in "${field.label}"`);
        else data[field.key] = raw;
        break;
      case "number": {
        const n = Number(raw.replace(/[,₹$€£\s]/g, ""));
        if (!Number.isFinite(n))
          errors.push(`Invalid number in "${field.label}"`);
        else data[field.key] = n;
        break;
      }
      case "date": {
        const iso = toIsoDate(raw);
        if (!iso) errors.push(`Invalid date in "${field.label}"`);
        else data[field.key] = iso;
        break;
      }
      case "select": {
        const match = matchOption(field.options ?? [], raw);
        if (!match)
          errors.push(
            `"${raw}" is not a valid ${field.label} (expected one of: ${(field.options ?? []).join(", ")})`,
          );
        else data[field.key] = match;
        break;
      }
      case "boolean":
        data[field.key] = /^(yes|true|1|y)$/i.test(raw);
        break;
      case "tags":
        data[field.key] = raw
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean);
        break;
      default:
        data[field.key] = raw;
    }
  }
  return { data, errors };
}

export const LEGACY_MEETING_ACTIVE_STATUSES = MEETING_STATUSES.filter(
  (s) => s !== "COMPLETED" && s !== "CANCELLED",
);

/** Legacy `resolveMeetingStatus`: an open status matched case-insensitively,
 * otherwise REQUESTED. */
export function resolveMeetingStatus(raw: string | undefined): string {
  const match = LEGACY_MEETING_ACTIVE_STATUSES.find(
    (s) => s.toLowerCase() === (raw ?? "").trim().toLowerCase(),
  );
  return match ?? "REQUESTED";
}
