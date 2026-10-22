import type {
  CreateLeadInput,
  Lead,
  LeadStatus,
} from "@texawave-erp/api-types";
import {
  Building2,
  CalendarClock,
  FileText,
  MapPin,
  ShieldCheck,
  Target,
  User,
} from "lucide-react";
import type { PanelSectionDef } from "@/features/crm/legacy-ui/RecordFormPanel";

/** Legacy `LEAD_STATUSES` (Leads.tsx). */
export const LEAD_STATUS_OPTIONS = [
  "NEW",
  "CONTACTED",
  "INTERESTED",
  "NOT_INTERESTED",
  "FOLLOW_UP",
  "MEETING_PENDING",
  "QUALIFIED",
  "CONVERTED",
  "LOST",
] as const;

export const EMAIL_OPT_OUT_OPTIONS = ["No", "Yes"];
export const DATA_PROCESSING_BASIS_OPTIONS = [
  "Consent",
  "Contract",
  "Legitimate Interest",
  "Legal Obligation",
  "Not Specified",
];

/** Legacy `LEAD_STATUS_STYLE`, with brand-50/700/200 = the CRM green. */
export const LEAD_STATUS_STYLE: Record<string, string> = {
  NEW: "bg-blue-50 text-blue-700 border-blue-200",
  CONTACTED: "bg-cyan-50 text-cyan-700 border-cyan-200",
  INTERESTED: "bg-emerald-50 text-emerald-700 border-emerald-200",
  NOT_INTERESTED: "bg-slate-100 text-slate-500 border-slate-200",
  FOLLOW_UP: "bg-amber-50 text-amber-700 border-amber-200",
  MEETING_PENDING: "bg-purple-50 text-purple-700 border-purple-200",
  QUALIFIED: "bg-teal-50 text-teal-700 border-teal-200",
  CONVERTED: "bg-brand-50 text-brand-700 border-brand-200",
  LOST: "bg-red-50 text-red-700 border-red-200",
};

/** Flat all-string editing shape (legacy `LeadsRow`), the form works on this
 * and `valuesToInput` converts it to the API payload. */
export interface LeadFormValues {
  leadStatus: string;
  leadSource: string;
  assignedTo: string;
  priority: string;
  rating: string;
  month: string;
  companyName: string;
  domain: string;
  industry: string;
  annualRevenue: string;
  numberOfEmployees: string;
  prospectName: string;
  title: string;
  contactNumber: string;
  mobile: string;
  email: string;
  fax: string;
  skypeId: string;
  meetingStatus: string;
  meetingDate: string;
  meetingScheduled: string;
  hq: string;
  addressStreet: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  tags: string;
  emailOptOut: string;
  dataProcessingBasis: string;
  areaOfInterest: string;
  comments: string;
}

export const emptyLeadValues = (): LeadFormValues => ({
  leadStatus: "NEW",
  leadSource: "",
  assignedTo: "",
  priority: "",
  rating: "",
  month: "",
  companyName: "",
  domain: "",
  industry: "",
  annualRevenue: "",
  numberOfEmployees: "",
  prospectName: "",
  title: "",
  contactNumber: "",
  mobile: "",
  email: "",
  fax: "",
  skypeId: "",
  meetingStatus: "",
  meetingDate: "",
  meetingScheduled: "",
  hq: "",
  addressStreet: "",
  city: "",
  state: "",
  postalCode: "",
  country: "",
  tags: "",
  emailOptOut: "No",
  dataProcessingBasis: "",
  areaOfInterest: "",
  comments: "",
});

export function leadToValues(lead: Lead): LeadFormValues {
  return {
    leadStatus: lead.leadStatus,
    leadSource: lead.leadSource ?? "",
    assignedTo: lead.assignedTo ?? "",
    priority: lead.priority ?? "",
    rating: lead.rating ?? "",
    month: lead.month ?? "",
    companyName: lead.companyName,
    domain: lead.domain ?? "",
    industry: lead.industry ?? "",
    annualRevenue: lead.annualRevenue ?? "",
    numberOfEmployees: lead.numberOfEmployees ?? "",
    prospectName: lead.prospectName,
    title: lead.title ?? "",
    contactNumber: lead.contactNumber ?? "",
    mobile: lead.mobile ?? "",
    email: lead.email ?? "",
    fax: lead.fax ?? "",
    skypeId: lead.skypeId ?? "",
    meetingStatus: lead.meetingStatus ?? "",
    meetingDate: lead.meetingDate ? lead.meetingDate.slice(0, 10) : "",
    meetingScheduled: lead.meetingScheduled ?? "",
    hq: lead.hq ?? "",
    addressStreet: lead.addressStreet ?? "",
    city: lead.city ?? "",
    state: lead.state ?? "",
    postalCode: lead.postalCode ?? "",
    country: lead.country ?? "",
    tags: lead.tags ?? "",
    emailOptOut: lead.emailOptOut ? "Yes" : "No",
    dataProcessingBasis: lead.dataProcessingBasis ?? "",
    areaOfInterest: lead.areaOfInterest ?? "",
    comments: lead.comments ?? "",
  };
}

const optCreate = (v: string): string | undefined => {
  const t = v.trim();
  return t ? t : undefined;
};

/** Client-side guard mirroring legacy: company + prospect name required. */
export function validateLeadValues(v: LeadFormValues): string | null {
  if (!v.companyName.trim()) return "Name of the Company is required";
  if (!v.prospectName.trim()) return "Prospect / Lead Name is required";
  if (v.email.trim() && !/^\S+@\S+\.\S+$/.test(v.email.trim()))
    return "Enter a valid email";
  return null;
}

/** `create` omits blank fields; `update` sends "" so a cleared field is
 * actually cleared server-side (the API stores "" as null). */
export function valuesToInput(
  v: LeadFormValues,
  mode: "create" | "update",
): CreateLeadInput {
  const opt = (x: string): string | undefined =>
    mode === "update" ? x.trim() : optCreate(x);
  return {
    companyName: v.companyName.trim(),
    prospectName: v.prospectName.trim(),
    leadStatus: (v.leadStatus || "NEW") as LeadStatus,
    leadSource: opt(v.leadSource),
    assignedTo: opt(v.assignedTo),
    priority: opt(v.priority),
    rating: opt(v.rating),
    month: opt(v.month),
    domain: opt(v.domain),
    industry: opt(v.industry),
    annualRevenue: opt(v.annualRevenue),
    numberOfEmployees: opt(v.numberOfEmployees),
    title: opt(v.title),
    contactNumber: opt(v.contactNumber),
    mobile: opt(v.mobile),
    email: opt(v.email),
    fax: opt(v.fax),
    skypeId: opt(v.skypeId),
    meetingStatus: opt(v.meetingStatus),
    meetingDate: optCreate(v.meetingDate),
    meetingScheduled: opt(v.meetingScheduled),
    hq: opt(v.hq),
    addressStreet: opt(v.addressStreet),
    city: opt(v.city),
    state: opt(v.state),
    postalCode: opt(v.postalCode),
    country: opt(v.country),
    tags: opt(v.tags),
    emailOptOut: v.emailOptOut === "Yes",
    dataProcessingBasis: opt(v.dataProcessingBasis),
    areaOfInterest: opt(v.areaOfInterest),
    comments: opt(v.comments),
  };
}

/** Legacy `LEAD_FORM_SECTIONS` — same 7 boxes ("Date" maps to `meetingDate`). */
export const LEAD_FORM_SECTIONS: PanelSectionDef<LeadFormValues>[] = [
  {
    id: "lead-management",
    title: "Lead Information",
    description: "Status, ownership and source of this lead.",
    icon: Target,
    tone: "rose",
    fields: [
      {
        key: "leadStatus",
        label: "Lead Status",
        type: "select",
        options: [...LEAD_STATUS_OPTIONS],
      },
      { key: "leadSource", label: "Lead Source" },
      { key: "assignedTo", label: "Lead Owner (Assigned To)" },
      {
        key: "priority",
        label: "Priority",
        type: "select",
        options: ["High", "Medium", "Low"],
      },
      {
        key: "rating",
        label: "Rating",
        type: "select",
        options: ["Hot", "Warm", "Cold"],
      },
    ],
  },
  {
    id: "company",
    title: "Company Information",
    description: "Company identity and profile.",
    icon: Building2,
    tone: "teal",
    fields: [
      { key: "companyName", label: "Name of the Company", required: true },
      { key: "domain", label: "Domain / Website" },
      { key: "industry", label: "Industry" },
      { key: "annualRevenue", label: "Annual Revenue" },
      { key: "numberOfEmployees", label: "No. of Employees" },
    ],
  },
  {
    id: "prospect",
    title: "Contact Information",
    description: "Primary contact for this lead.",
    icon: User,
    tone: "purple",
    fields: [
      { key: "prospectName", label: "Prospect / Lead Name", required: true },
      { key: "title", label: "Title" },
      { key: "contactNumber", label: "Phone" },
      { key: "mobile", label: "Mobile" },
      { key: "email", label: "Email id" },
      { key: "fax", label: "Fax" },
      { key: "skypeId", label: "Skype ID" },
    ],
  },
  {
    id: "meeting",
    title: "Meeting Details",
    description: "Scheduling and status of the meeting.",
    icon: CalendarClock,
    tone: "blue",
    fields: [
      { key: "meetingStatus", label: "Meeting Status" },
      { key: "month", label: "Month" },
      { key: "meetingDate", label: "Date", type: "date" },
      { key: "meetingScheduled", label: "Meeting Scheduled" },
    ],
  },
  {
    id: "address",
    title: "Address Information",
    description: "Where this lead/company is located.",
    icon: MapPin,
    tone: "amber",
    fields: [
      { key: "hq", label: "HQ" },
      { key: "addressStreet", label: "Address", span: 2 },
      { key: "city", label: "City" },
      { key: "state", label: "State / Province" },
      { key: "postalCode", label: "Postal / ZIP Code" },
      { key: "country", label: "Country" },
    ],
  },
  {
    id: "qualification",
    title: "Lead Qualification & Privacy",
    description: "Tags and data-privacy handling for this lead.",
    icon: ShieldCheck,
    tone: "brand",
    fields: [
      { key: "tags", label: "Tags (comma-separated)" },
      {
        key: "emailOptOut",
        label: "Email Opt Out",
        type: "select",
        options: EMAIL_OPT_OUT_OPTIONS,
      },
      {
        key: "dataProcessingBasis",
        label: "Data Processing Basis",
        type: "select",
        options: DATA_PROCESSING_BASIS_OPTIONS,
      },
    ],
  },
  {
    id: "requirement",
    title: "Requirement & Notes",
    description: "What the prospect is looking for.",
    icon: FileText,
    tone: "slate",
    fields: [
      {
        key: "areaOfInterest",
        label: "Area of Interest / Requirement",
        type: "textarea",
      },
      { key: "comments", label: "Comments / Description", type: "textarea" },
    ],
  },
];
