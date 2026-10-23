import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useNavigate, useLocation, useSearchParams } from "react-router-dom";
import { ref, onValue, set, push } from "firebase/database";
import { database } from "@/services/firebase";
import { softDeleteCrmRecord } from "./domain/recycleBinService";
import { isCrmAdmin } from "./domain/roles";
import { celebrateCrm } from "./celebration";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { DatePicker } from "./components/DatePicker";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import {
  Plus,
  ArrowRightCircle,
  ArrowUpRight,
  Trash2,
  Pencil,
  Eye,
  CalendarClock,
  Building2,
  User,
  FileText,
  Target,
  Search,
  SlidersHorizontal,
  Settings2,
  X,
  MapPin,
  ShieldCheck,
  ArrowLeft,
  Sparkles,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { toast } from "@/hooks/use-toast";
import { LeadsRow, LeadsSheetData } from "./types";
import { useCrmDomainData } from "./domain/useCrmDomainData";
import { CrmLeadStatus } from "./domain/types";
import { LeadConvertDialog } from "./domain/LeadConvertDialog";
import { paginate, PaginationFooter } from "./components/Pagination";
import {
  DeleteConfirmDialog,
  TemperatureBadge,
} from "./intelligence/components";
import {
  writeCrmAuditLog,
  subscribeCrmAuditLogs,
} from "./intelligence/auditService";
import { subscribeCrmMetadata } from "./intelligence/metadataService";
import { CrmAuditLogEntry, CrmMetadata } from "./intelligence/types";
import { PanelSectionDef } from "./components/RecordFormPanel";
import { DetailPageBoxes } from "./components/DetailPageBoxes";
import { ImportExportBar } from "./importExport/ImportExportBar";
import {
  FieldSchema,
  MappedImportRow,
  DuplicateStrategy,
} from "./importExport/types";
import {
  commitFirebaseImport,
  logBulkImportAudit,
} from "./importExport/commitHelpers";
import { BackToDashboardButton } from "./components/BackToDashboardButton";
import {
  useCrmCustomFields,
  setCrmCustomFieldValue,
} from "./bulkImport/crmCustomFieldsService";

export const LEAD_STATUSES: CrmLeadStatus[] = [
  "NEW",
  "CONTACTED",
  "INTERESTED",
  "NOT_INTERESTED",
  "FOLLOW_UP",
  "MEETING_PENDING",
  "QUALIFIED",
  "CONVERTED",
  "LOST",
];
const EMAIL_OPT_OUT_OPTIONS = ["No", "Yes"];
const DATA_PROCESSING_BASIS_OPTIONS = [
  "Consent",
  "Contract",
  "Legitimate Interest",
  "Legal Obligation",
  "Not Specified",
];

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

// Third tab of the CRM module. Isolated from Overall Data and Accounts Mining Sheet —
// stored under its own `crm/leads` path. Reorganized into 7 sections (was 5) so every new
// enterprise field from the Leads enhancement has a logical home; every original field/section
// title concept is preserved, none were removed or renamed at the data level.
export const LEAD_FORM_SECTIONS: PanelSectionDef<LeadsRow>[] = [
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
        options: LEAD_STATUSES,
      },
      { key: "leadSource", label: "Lead Source" },
      { key: "assignedTo", label: "Lead Owner (Assigned To)" },
      {
        key: "priority",
        label: "Priority",
        type: "select",
        options: ["High", "Medium", "Low"],
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
      { key: "date", label: "Date" },
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

export const emptyLeadRow = (): LeadsRow => ({
  meetingStatus: "",
  month: "",
  date: "",
  meetingScheduled: "",
  companyName: "",
  domain: "",
  hq: "",
  prospectName: "",
  title: "",
  contactNumber: "",
  email: "",
  areaOfInterest: "",
  comments: "",
  leadStatus: "",
  priority: "",
  assignedTo: "",
  leadSource: "",
  mobile: "",
  fax: "",
  website: "",
  skypeId: "",
  industry: "",
  annualRevenue: "",
  numberOfEmployees: "",
  emailOptOut: "",
  dataProcessingBasis: "",
  addressStreet: "",
  city: "",
  state: "",
  postalCode: "",
  country: "",
  tags: "",
});

export const LEAD_IMPORT_EXPORT_FIELDS: FieldSchema<LeadsRow>[] = [
  {
    key: "companyName",
    label: "Name of the Company",
    required: true,
    aliases: ["Company Name", "Company"],
  },
  { key: "domain", label: "Domain / Website", aliases: ["Website"] },
  { key: "industry", label: "Industry" },
  { key: "annualRevenue", label: "Annual Revenue" },
  {
    key: "numberOfEmployees",
    label: "No. of Employees",
    aliases: ["Number Of Employees"],
  },
  {
    key: "prospectName",
    label: "Prospect / Lead Name",
    required: true,
    aliases: ["Contact Name", "Lead Name", "Prospect Name"],
  },
  { key: "title", label: "Title" },
  {
    key: "contactNumber",
    label: "Phone",
    aliases: ["Contact Number", "Mobile Number"],
  },
  { key: "mobile", label: "Mobile" },
  {
    key: "email",
    label: "Email id",
    type: "email",
    aliases: ["Email", "Email ID"],
  },
  { key: "fax", label: "Fax" },
  { key: "skypeId", label: "Skype ID" },
  {
    key: "leadStatus",
    label: "Lead Status",
    type: "select",
    options: LEAD_STATUSES,
  },
  { key: "leadSource", label: "Lead Source" },
  {
    key: "assignedTo",
    label: "Lead Owner (Assigned To)",
    aliases: ["Lead Owner"],
  },
  {
    key: "priority",
    label: "Priority",
    type: "select",
    options: ["High", "Medium", "Low"],
  },
  { key: "meetingStatus", label: "Meeting Status" },
  { key: "month", label: "Month" },
  { key: "date", label: "Date" },
  { key: "meetingScheduled", label: "Meeting Scheduled" },
  { key: "hq", label: "HQ" },
  { key: "addressStreet", label: "Address" },
  { key: "city", label: "City" },
  { key: "state", label: "State / Province" },
  { key: "postalCode", label: "Postal / ZIP Code" },
  { key: "country", label: "Country" },
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
  { key: "areaOfInterest", label: "Area of Interest / Requirement" },
  { key: "comments", label: "Comments / Description" },
];

export const LEADS_PATH = "crm/leads";

// --- List enhancements: columns, filters, sorting, pagination ---------------------------------

type OptionalColumnKey =
  | "title"
  | "mobile"
  | "industry"
  | "annualRevenue"
  | "rating"
  | "priority"
  | "meetingStatus"
  | "createdDate"
  | "lastActivity";

const OPTIONAL_COLUMN_META: { key: OptionalColumnKey; label: string }[] = [
  { key: "title", label: "Title" },
  { key: "mobile", label: "Mobile" },
  { key: "industry", label: "Industry" },
  { key: "annualRevenue", label: "Annual Revenue" },
  { key: "rating", label: "Rating" },
  { key: "priority", label: "Priority" },
  { key: "meetingStatus", label: "Meeting Status" },
  { key: "createdDate", label: "Created Date" },
  { key: "lastActivity", label: "Last Activity" },
];

const DEFAULT_VISIBLE_OPTIONAL: OptionalColumnKey[] = ["rating", "createdDate"];

type SortKey = "createdAsc" | "createdDesc" | "companyAsc" | "companyDesc";

interface LeadFilters {
  status: string;
  owner: string;
  source: string;
  industry: string;
  rating: string;
  touched: string;
  converted: string;
  city: string;
  country: string;
  createdBy: string;
  createdFrom: string;
  createdTo: string;
  minAnnualRevenue: string;
}

const DEFAULT_FILTERS: LeadFilters = {
  status: "ALL",
  owner: "ALL",
  source: "ALL",
  industry: "ALL",
  rating: "ALL",
  touched: "ALL",
  converted: "ALL",
  city: "ALL",
  country: "ALL",
  createdBy: "ALL",
  createdFrom: "",
  createdTo: "",
  minAnnualRevenue: "",
};

function uniqueValues(rows: LeadsSheetData, field: keyof LeadsRow): string[] {
  const set = new Set<string>();
  Object.values(rows).forEach((row) => {
    const raw = row[field];
    const v = typeof raw === "string" ? raw.trim() : "";
    if (v) set.add(v);
  });
  return Array.from(set).sort((a, b) => a.localeCompare(b));
}

function formatShortDate(ts?: number): string {
  if (!ts) return "—";
  return new Date(ts).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default function Leads() {
  const navigate = useNavigate();
  const location = useLocation();
  const fromDashboard = (
    location.state as { fromCrmDashboard?: boolean } | null
  )?.fromCrmDashboard;
  const { user } = useAuth();
  const currentUser = user?.name || user?.username || "CRM User";
  const [rows, setRows] = useState<LeadsSheetData>({});
  const [order, setOrder] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingRowId, setEditingRowId] = useState<string | null>(null);
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [convertRowId, setConvertRowId] = useState<string | null>(null);

  // --- search / filter / sort / pagination / columns (new — the original list had none of these) ---
  // Mirrored into the URL query string (see the sync effect below) so this whole view state —
  // tab/filter, search, sort, page — survives navigating away to a Lead/Account and back via
  // "Back to Leads", instead of resetting to defaults on remount.
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState(() => searchParams.get("q") || "");
  const [filters, setFilters] = useState<LeadFilters>(() => {
    const fromUrl = { ...DEFAULT_FILTERS };
    (Object.keys(DEFAULT_FILTERS) as (keyof LeadFilters)[]).forEach((key) => {
      const v = searchParams.get(key);
      if (v !== null) fromUrl[key] = v;
    });
    return fromUrl;
  });
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [visibleOptional, setVisibleOptional] = useState<
    Set<OptionalColumnKey>
  >(new Set(DEFAULT_VISIBLE_OPTIONAL));
  const [sortKey, setSortKey] = useState<SortKey>(
    () => (searchParams.get("sort") as SortKey) || "createdAsc",
  );
  const [page, setPage] = useState(() => Number(searchParams.get("page")) || 1);
  const [pageSize, setPageSize] = useState(
    () => Number(searchParams.get("pageSize")) || 10,
  );

  // Keep the URL in sync with the view state above (replacing, not pushing, so it doesn't spam
  // browser history) — this is what lets "Back to Leads" restore the exact tab/filter/search/
  // sort/page the user left, since the URL alone fully describes it.
  useEffect(() => {
    const params = new URLSearchParams();
    if (search) params.set("q", search);
    (Object.keys(filters) as (keyof LeadFilters)[]).forEach((key) => {
      if (filters[key] && filters[key] !== DEFAULT_FILTERS[key])
        params.set(key, filters[key]);
    });
    if (sortKey !== "createdAsc") params.set("sort", sortKey);
    if (page !== 1) params.set("page", String(page));
    if (pageSize !== 10) params.set("pageSize", String(pageSize));
    setSearchParams(params, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, filters, sortKey, page, pageSize]);

  // Restores the scroll offset the user had when they last left this page (e.g. to view a Lead),
  // and remembers the current one again on the way out — so "Back to Leads" also lands back at
  // the same scroll position, not just the same tab/filter/search/sort/page.
  useEffect(() => {
    const saved = sessionStorage.getItem("crm-leads-scroll");
    if (saved)
      requestAnimationFrame(() => window.scrollTo(0, Number(saved) || 0));
    return () => {
      sessionStorage.setItem("crm-leads-scroll", String(window.scrollY));
    };
  }, []);

  // Reused existing infrastructure (Feature 8 audit trail + Feature 6 metadata layer) rather than
  // inventing new Firebase paths for "touched/untouched" and "Rating" — see the Leads-module
  // enhancement notes in `domain/LeadConvertDialog.tsx` for the same reuse principle.
  const [auditLogs, setAuditLogs] = useState<CrmAuditLogEntry[]>([]);
  const [metadata, setMetadata] = useState<Record<string, CrmMetadata>>({});
  const { activities, meetings, followUps } = useCrmDomainData();
  const customFieldDefs = useCrmCustomFields("leads");

  useEffect(() => subscribeCrmAuditLogs(setAuditLogs), []);
  useEffect(() => subscribeCrmMetadata(setMetadata), []);

  // Subscribe to the Leads data — isolated under its own path so it never touches
  // `crm/overallData` / `crm/overallReport` / `crm/accountsMiningSheet`.
  useEffect(() => {
    setLoading(true);
    const sheetRef = ref(database, "crm/leads");
    const unsub = onValue(sheetRef, (snap) => {
      const val: LeadsSheetData = snap.val() || {};
      setRows(val);
      setOrder(Object.keys(val).sort()); // push ids sort chronologically
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const handleChange = (
    rowId: string,
    field: keyof LeadsRow,
    value: string,
  ) => {
    setRows((prev) => ({
      ...prev,
      [rowId]: { ...(prev[rowId] || emptyLeadRow()), [field]: value },
    }));
  };

  const handleBlur = (rowId: string, field: keyof LeadsRow) => {
    const rawValue = rows[rowId]?.[field];
    const value = typeof rawValue === "string" ? rawValue : "";
    set(ref(database, `crm/leads/${rowId}/${field}`), value).catch((err) => {
      console.error("Failed to save Leads cell:", err);
      toast({
        title: "Failed to save change",
        description: err instanceof Error ? err.message : undefined,
        variant: "destructive",
      });
    });
    if (field === "assignedTo" && value.trim()) {
      writeCrmAuditLog({
        action: "lead_assigned",
        entityType: "lead",
        entityId: rowId,
        newValue: value,
        details: `Lead assigned to ${value}`,
        by: currentUser,
        at: Date.now(),
      }).catch((err) =>
        console.error("Failed to write lead_assigned audit log:", err),
      );
    }
  };

  // Bulk-Import-discovered fields (see bulkImport/crmCustomFieldsService.ts) — same optimistic
  // local update + on-blur Firebase write pattern as handleChange/handleBlur above, just nested
  // under customFields instead of a top-level LeadsRow key.
  const handleCustomFieldChange = (
    rowId: string,
    key: string,
    value: string,
  ) => {
    setRows((prev) => ({
      ...prev,
      [rowId]: {
        ...(prev[rowId] || emptyLeadRow()),
        customFields: { ...(prev[rowId]?.customFields || {}), [key]: value },
      },
    }));
  };

  const handleCustomFieldBlur = (rowId: string, key: string) => {
    const value = rows[rowId]?.customFields?.[key] || "";
    setCrmCustomFieldValue("crm/leads", rowId, key, value).catch((err) => {
      console.error("Failed to save Leads custom field:", err);
      toast({
        title: "Failed to save change",
        description: err instanceof Error ? err.message : undefined,
        variant: "destructive",
      });
    });
  };

  const handleAddRow = () => {
    const newRef = push(ref(database, "crm/leads"));
    if (!newRef.key) return;
    const payload: LeadsRow = {
      ...emptyLeadRow(),
      createdAt: Date.now(),
      createdBy: currentUser,
    };
    set(newRef, payload)
      .then(() => {
        celebrateCrm("lead.created");
        return writeCrmAuditLog({
          action: "lead_created",
          entityType: "lead",
          entityId: newRef.key as string,
          details: "New lead added",
          by: currentUser,
          at: Date.now(),
        });
      })
      .catch((err) => {
        console.error("Failed to add Leads row:", err);
        toast({
          title: "Failed to add lead",
          description: err instanceof Error ? err.message : undefined,
          variant: "destructive",
        });
      });
    setIsCreatingNew(true);
    setEditingRowId(newRef.key);
  };

  const handleDeleteRow = async (rowId: string) => {
    const row = rows[rowId];
    try {
      const deleted = await softDeleteCrmRecord(
        "lead",
        row?.companyName || rowId,
        "crm/leads",
        rowId,
        user,
      );
      if (!deleted) {
        // Already gone (e.g. soft-deleted from another tab/session moments earlier) — say so
        // instead of leaving the row visually lingering with no explanation either way.
        toast({ title: "Lead was already removed" });
        return;
      }
      await writeCrmAuditLog({
        action: "lead_deleted",
        entityType: "lead",
        entityId: rowId,
        details: `Lead "${row?.companyName || rowId}" moved to Recycle Bin`,
        by: currentUser,
        at: Date.now(),
      });
      toast({ title: "Lead deleted" });
    } catch (err) {
      console.error("Failed to delete Leads row:", err);
      toast({
        title: "Failed to delete lead",
        description: err instanceof Error ? err.message : undefined,
        variant: "destructive",
      });
      throw err;
    }
  };

  // Select-type cells (Lead Status / Priority / Rating / etc.) save immediately on change rather than on blur.
  const handleSelectChange = (
    rowId: string,
    field: keyof LeadsRow,
    value: string,
  ) => {
    handleChange(rowId, field, value);
    set(ref(database, `crm/leads/${rowId}/${field}`), value).catch((err) => {
      console.error("Failed to save Leads cell:", err);
      toast({
        title: "Failed to save change",
        description: err instanceof Error ? err.message : undefined,
        variant: "destructive",
      });
    });
    if (field === "leadStatus") {
      writeCrmAuditLog({
        action: "lead_status_changed",
        entityType: "lead",
        entityId: rowId,
        newValue: value,
        details: `Lead status changed to ${value}`,
        by: currentUser,
        at: Date.now(),
      }).catch((err) =>
        console.error("Failed to write lead_status_changed audit log:", err),
      );
    }
  };

  const openEdit = (rowId: string) => {
    setIsCreatingNew(false);
    setEditingRowId(rowId);
  };

  const openConvert = (rowId: string) => setConvertRowId(rowId);

  // --- derived data for filters/columns ------------------------------------------------------

  const touchedIds = useMemo(() => {
    const s = new Set<string>();
    auditLogs.forEach((l) => {
      if (l.entityType === "lead" && l.entityId && l.action !== "lead_created")
        s.add(l.entityId);
    });
    activities.forEach((a) => {
      if (a.relatedType === "lead") s.add(a.relatedId);
    });
    meetings.forEach((m) => {
      if (m.relatedType === "lead") s.add(m.relatedId);
    });
    followUps.forEach((f) => {
      if (f.relatedType === "lead") s.add(f.relatedId);
    });
    return s;
  }, [auditLogs, activities, meetings, followUps]);

  const lastActivityById = useMemo(() => {
    const m = new Map<string, number>();
    const bump = (id: string, at: number) =>
      m.set(id, Math.max(m.get(id) || 0, at));
    auditLogs.forEach((l) => {
      if (l.entityType === "lead" && l.entityId) bump(l.entityId, l.at);
    });
    activities.forEach((a) => {
      if (a.relatedType === "lead")
        bump(a.relatedId, a.occurredAt || a.createdAt);
    });
    meetings.forEach((mt) => {
      if (mt.relatedType === "lead") bump(mt.relatedId, mt.createdAt);
    });
    followUps.forEach((f) => {
      if (f.relatedType === "lead") bump(f.relatedId, f.createdAt);
    });
    return m;
  }, [auditLogs, activities, meetings, followUps]);

  const ownerOptions = useMemo(() => uniqueValues(rows, "assignedTo"), [rows]);
  const sourceOptions = useMemo(() => uniqueValues(rows, "leadSource"), [rows]);
  const industryOptions = useMemo(() => uniqueValues(rows, "industry"), [rows]);
  const cityOptions = useMemo(() => uniqueValues(rows, "city"), [rows]);
  const countryOptions = useMemo(() => uniqueValues(rows, "country"), [rows]);
  const createdByOptions = useMemo(
    () => uniqueValues(rows, "createdBy"),
    [rows],
  );

  const activeFilterCount = useMemo(
    () =>
      (Object.keys(filters) as (keyof LeadFilters)[]).filter(
        (k) => filters[k] !== DEFAULT_FILTERS[k],
      ).length,
    [filters],
  );

  // Conversion sub-tabs — same `linkedAccountId` conversion flag the "Conversion Status" filter
  // and the Conversion column already use (set only by LeadConvertDialog's real convert flow), so
  // these counts and the filters-panel dropdown can never disagree.
  const conversionCounts = useMemo(() => {
    let converted = 0;
    order.forEach((id) => {
      if (rows[id]?.linkedAccountId) converted += 1;
    });
    return {
      all: order.length,
      converted,
      notConverted: order.length - converted,
    };
  }, [order, rows]);

  // A 'YYYY-MM-DD' filter value parsed via `new Date(string)` is UTC midnight per spec, which
  // shifts to the previous local day in any timezone behind UTC (IST) — build via the (y, m, d)
  // numeric overload instead so "Created From/To" compares against local-midnight boundaries.
  const localDateFromIso = (value: string): Date | null => {
    const [y, m, d] = value.split("-").map(Number);
    if (!y || !m || !d) return null;
    return new Date(y, m - 1, d);
  };

  const filteredIds = useMemo(() => {
    const q = search.trim().toLowerCase();
    return order.filter((id) => {
      const row = rows[id] || emptyLeadRow();
      if (q) {
        const haystack = [
          row.companyName,
          row.prospectName,
          row.email,
          row.contactNumber,
          row.mobile,
          row.domain,
          row.tags,
        ]
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      if (filters.status !== "ALL" && (row.leadStatus || "") !== filters.status)
        return false;
      if (filters.owner !== "ALL" && (row.assignedTo || "") !== filters.owner)
        return false;
      if (filters.source !== "ALL" && (row.leadSource || "") !== filters.source)
        return false;
      if (
        filters.industry !== "ALL" &&
        (row.industry || "") !== filters.industry
      )
        return false;
      if (filters.city !== "ALL" && (row.city || "") !== filters.city)
        return false;
      if (filters.country !== "ALL" && (row.country || "") !== filters.country)
        return false;
      if (
        filters.createdBy !== "ALL" &&
        (row.createdBy || "") !== filters.createdBy
      )
        return false;
      if (
        filters.rating !== "ALL" &&
        (metadata[id]?.temperature || "") !== filters.rating
      )
        return false;
      if (filters.touched === "TOUCHED" && !touchedIds.has(id)) return false;
      if (filters.touched === "UNTOUCHED" && touchedIds.has(id)) return false;
      if (filters.converted === "CONVERTED" && !row.linkedAccountId)
        return false;
      if (filters.converted === "NOT_CONVERTED" && row.linkedAccountId)
        return false;
      const createdFromMs = filters.createdFrom
        ? localDateFromIso(filters.createdFrom)?.getTime()
        : undefined;
      if (
        createdFromMs !== undefined &&
        (!row.createdAt || row.createdAt < createdFromMs)
      )
        return false;
      const createdToMs = filters.createdTo
        ? localDateFromIso(filters.createdTo)?.getTime()
        : undefined;
      if (
        createdToMs !== undefined &&
        (!row.createdAt || row.createdAt > createdToMs + 86400000)
      )
        return false;
      if (filters.minAnnualRevenue) {
        const min = Number(filters.minAnnualRevenue);
        const rev = Number((row.annualRevenue || "").replace(/[^0-9.]/g, ""));
        if (!Number.isFinite(min) || !Number.isFinite(rev) || rev < min)
          return false;
      }
      return true;
    });
  }, [order, rows, search, filters, metadata, touchedIds]);

  const sortedIds = useMemo(() => {
    const ids = [...filteredIds];
    switch (sortKey) {
      case "createdDesc":
        return ids.sort().reverse();
      case "companyAsc":
        return ids.sort((a, b) =>
          (rows[a]?.companyName || "").localeCompare(
            rows[b]?.companyName || "",
          ),
        );
      case "companyDesc":
        return ids.sort((a, b) =>
          (rows[b]?.companyName || "").localeCompare(
            rows[a]?.companyName || "",
          ),
        );
      case "createdAsc":
      default:
        return ids.sort();
    }
  }, [filteredIds, rows, sortKey]);

  // Resets to page 1 whenever the user changes search/filters/page size — but not on the initial
  // mount, since that would stomp on a page number just restored from the URL (e.g. returning via
  // "Back to Leads" onto page 2 of a filtered view).
  const skipNextPageReset = useRef(true);
  useEffect(() => {
    if (skipNextPageReset.current) {
      skipNextPageReset.current = false;
      return;
    }
    setPage(1);
  }, [search, filters, pageSize]);

  const {
    paged: pagedIds,
    page: clampedPage,
    totalPages,
  } = paginate(sortedIds, page, pageSize);

  const toggleOptionalColumn = (key: OptionalColumnKey) => {
    setVisibleOptional((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const editingRow = editingRowId
    ? rows[editingRowId] || emptyLeadRow()
    : emptyLeadRow();

  // Custom Fields section only appears once Bulk Import has actually discovered one for Leads.
  const leadFormSections: PanelSectionDef<LeadsRow>[] = useMemo(() => {
    if (customFieldDefs.length === 0) return LEAD_FORM_SECTIONS;
    return [
      ...LEAD_FORM_SECTIONS,
      {
        id: "custom-fields",
        title: "Additional Fields (from Import)",
        description:
          "Discovered automatically from an imported Excel column with no matching built-in field.",
        icon: Sparkles,
        tone: "brand",
        fields: customFieldDefs.map((d) => ({
          custom: true as const,
          key: d.key,
          label: d.label,
        })),
      },
    ];
  }, [customFieldDefs]);

  const allLeadRecords = order.map((id) => rows[id] || emptyLeadRow());
  const filteredLeadRecords = sortedIds.map((id) => rows[id] || emptyLeadRow());

  const commitLeadsImport = async (
    importRows: MappedImportRow[],
    strategy: DuplicateStrategy,
  ) => {
    const summary = await commitFirebaseImport(
      LEADS_PATH,
      importRows,
      strategy,
      (row) =>
        row.isDuplicate && strategy === "update"
          ? { ...row.data }
          : {
              ...emptyLeadRow(),
              ...row.data,
              createdAt: Date.now(),
              createdBy: currentUser,
            },
    );
    await logBulkImportAudit("lead", "Leads", summary, currentUser);
    return summary;
  };

  const renderOptionalCell = (
    key: OptionalColumnKey,
    id: string,
    row: LeadsRow,
  ): ReactNode => {
    switch (key) {
      case "title":
        return row.title || "—";
      case "mobile":
        return row.mobile || "—";
      case "industry":
        return row.industry || "—";
      case "annualRevenue":
        return row.annualRevenue || "—";
      case "rating":
        return metadata[id]?.temperature ? (
          <TemperatureBadge temperature={metadata[id].temperature} />
        ) : (
          <span className="text-slate-300">—</span>
        );
      case "priority":
        return row.priority || "—";
      case "meetingStatus":
        return row.meetingStatus || "—";
      case "createdDate":
        return formatShortDate(row.createdAt);
      case "lastActivity":
        return formatShortDate(lastActivityById.get(id));
      default:
        return "—";
    }
  };

  if (editingRowId) {
    return (
      <div className="space-y-6 pb-8">
        {fromDashboard ? (
          <BackToDashboardButton />
        ) : (
          <Button
            size="sm"
            variant="ghost"
            className="rounded-xl gap-1.5 -ml-2"
            onClick={() => {
              setEditingRowId(null);
              setIsCreatingNew(false);
            }}
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back to Leads
          </Button>
        )}
        <DetailPageBoxes<LeadsRow>
          heading={editingRow.companyName || "New Lead"}
          subheading="Leads"
          sections={leadFormSections}
          values={editingRow}
          onFieldChange={(field, value) =>
            editingRowId && handleChange(editingRowId, field, value)
          }
          onFieldBlur={(field) =>
            editingRowId && handleBlur(editingRowId, field)
          }
          onSelectCommit={(field, value) =>
            editingRowId && handleSelectChange(editingRowId, field, value)
          }
          onCustomFieldChange={(key, value) =>
            editingRowId && handleCustomFieldChange(editingRowId, key, value)
          }
          onCustomFieldBlur={(key) =>
            editingRowId && handleCustomFieldBlur(editingRowId, key)
          }
          emphasized
          footer={
            <>
              <div className="text-sm text-slate-600">
                Changes save automatically as you edit each field.
              </div>
              <div className="flex justify-end gap-2 flex-wrap">
                {isCreatingNew && (
                  <Button
                    type="button"
                    variant="outline"
                    className="rounded-xl gap-1.5"
                    onClick={() => {
                      setEditingRowId(null);
                      setIsCreatingNew(false);
                      handleAddRow();
                    }}
                  >
                    <Plus className="h-3.5 w-3.5" /> Save &amp; New
                  </Button>
                )}
                <Button
                  type="button"
                  className="rounded-xl gap-1.5"
                  onClick={() => {
                    setEditingRowId(null);
                    setIsCreatingNew(false);
                  }}
                >
                  Done
                </Button>
              </div>
            </>
          }
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <BackToDashboardButton />
      <Card className="crm-panel-frame rounded-3xl overflow-hidden bg-white">
        <CardHeader className="crm-panel-header relative overflow-hidden p-5 border-b border-brand-200/50 bg-gradient-to-br from-white via-brand-100/70 to-blue-100/50 flex flex-col gap-4">
          <span
            aria-hidden
            className="pointer-events-none absolute -left-16 -top-20 h-48 w-48 rounded-full bg-brand-300/40 blur-3xl"
          />
          <span
            aria-hidden
            className="pointer-events-none absolute right-10 -bottom-20 h-48 w-48 rounded-full bg-blue-300/35 blur-3xl"
          />
          <div className="relative flex flex-row items-center justify-between gap-4 flex-wrap">
            <div>
              <CardTitle className="text-lg font-extrabold text-slate-900">
                Leads
              </CardTitle>
              <CardDescription className="text-sm text-slate-500">
                Track leads and meeting details. Click Edit to view and update
                full details.
              </CardDescription>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <ImportExportBar
                moduleLabel="Leads"
                fields={LEAD_IMPORT_EXPORT_FIELDS}
                allRecords={allLeadRecords}
                filteredRecords={filteredLeadRecords}
                fileBaseName="crm-leads"
                duplicate={{
                  keys: ["companyName", "email"],
                  findExisting: (mapped) => {
                    const company = String(mapped.companyName || "")
                      .trim()
                      .toLowerCase();
                    const email = String(mapped.email || "")
                      .trim()
                      .toLowerCase();
                    if (!company || !email) return undefined;
                    const match = order.find((id) => {
                      const r = rows[id];
                      return (
                        r &&
                        r.companyName?.trim().toLowerCase() === company &&
                        r.email?.trim().toLowerCase() === email
                      );
                    });
                    return match
                      ? { id: match, label: rows[match].companyName || match }
                      : undefined;
                  },
                }}
                commitImport={commitLeadsImport}
              />
              <Button
                size="sm"
                className="rounded-xl gap-1.5 shrink-0"
                onClick={handleAddRow}
              >
                <Plus className="h-4 w-4" />
                Add Row
              </Button>
            </div>
          </div>

          {/* Search + Filters + Columns toolbar */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[220px]">
              <Search className="h-3.5 w-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search company, name, email, phone…"
                className="h-9 rounded-xl pl-9 bg-white border-brand-300 shadow-[0_0_0_3px_rgba(77,159,75,0.12)] focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-brand-400 focus-visible:shadow-[0_0_0_3px_rgba(77,159,75,0.18)] transition-shadow"
              />
            </div>
            <Button
              size="sm"
              variant={filtersOpen ? "default" : "outline"}
              className="rounded-xl gap-1.5 h-9"
              onClick={() => setFiltersOpen((v) => !v)}
            >
              <SlidersHorizontal className="h-3.5 w-3.5" /> Filters
              {activeFilterCount > 0 && (
                <Badge className="ml-1 h-4 min-w-4 px-1 text-xs bg-white text-brand-700 border-none">
                  {activeFilterCount}
                </Badge>
              )}
            </Button>
            <Select
              value={sortKey}
              onValueChange={(v) => setSortKey(v as SortKey)}
            >
              <SelectTrigger className="h-9 rounded-xl w-[170px] bg-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="createdAsc">Oldest First</SelectItem>
                <SelectItem value="createdDesc">Newest First</SelectItem>
                <SelectItem value="companyAsc">Company A–Z</SelectItem>
                <SelectItem value="companyDesc">Company Z–A</SelectItem>
              </SelectContent>
            </Select>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  size="sm"
                  variant="outline"
                  className="rounded-xl gap-1.5 h-9"
                >
                  <Settings2 className="h-3.5 w-3.5" /> Columns
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-56 rounded-2xl">
                <p className="text-xs font-extrabold uppercase tracking-wider text-slate-400 mb-2">
                  Optional Columns
                </p>
                <div className="space-y-2">
                  {OPTIONAL_COLUMN_META.map((col) => (
                    <label
                      key={col.key}
                      className="flex items-center gap-2 text-sm cursor-pointer"
                    >
                      <Checkbox
                        checked={visibleOptional.has(col.key)}
                        onCheckedChange={() => toggleOptionalColumn(col.key)}
                      />
                      {col.label}
                    </label>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
          </div>

          {/* Conversion sub-tabs — quick access to Converted / Not Converted without opening the
              Filters panel. Drives the same `filters.converted` state as the "Conversion Status"
              filter above, so the two stay in sync either way. Same Tabs/TabsList/TabsTrigger
              pill styling as the "All / Follow-ups / Tasks / Meetings" sub-tabs on Yet to Happen. */}
          <Tabs
            value={filters.converted}
            onValueChange={(v) => setFilters((f) => ({ ...f, converted: v }))}
          >
            <TabsList className="rounded-2xl h-auto p-1.5 flex-nowrap w-max [&_[data-state=inactive]]:text-slate-700">
              <TabsTrigger value="ALL" className="rounded-xl gap-1.5">
                All Leads ({conversionCounts.all})
              </TabsTrigger>
              <TabsTrigger value="CONVERTED" className="rounded-xl gap-1.5">
                Converted ({conversionCounts.converted})
              </TabsTrigger>
              <TabsTrigger value="NOT_CONVERTED" className="rounded-xl gap-1.5">
                Not Converted ({conversionCounts.notConverted})
              </TabsTrigger>
            </TabsList>
          </Tabs>

          {/* Advanced filters panel */}
          {filtersOpen && (
            <div className="crm-panel-frame rounded-2xl bg-white p-4 space-y-3">
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                <FilterSelect
                  label="Lead Status"
                  value={filters.status}
                  onChange={(v) => setFilters((f) => ({ ...f, status: v }))}
                  options={LEAD_STATUSES}
                />
                <FilterSelect
                  label="Lead Owner"
                  value={filters.owner}
                  onChange={(v) => setFilters((f) => ({ ...f, owner: v }))}
                  options={ownerOptions}
                />
                <FilterSelect
                  label="Lead Source"
                  value={filters.source}
                  onChange={(v) => setFilters((f) => ({ ...f, source: v }))}
                  options={sourceOptions}
                />
                <FilterSelect
                  label="Industry"
                  value={filters.industry}
                  onChange={(v) => setFilters((f) => ({ ...f, industry: v }))}
                  options={industryOptions}
                />
                <FilterSelect
                  label="Rating"
                  value={filters.rating}
                  onChange={(v) => setFilters((f) => ({ ...f, rating: v }))}
                  options={["Hot", "Warm", "Cold"]}
                />
                <FilterSelect
                  label="City"
                  value={filters.city}
                  onChange={(v) => setFilters((f) => ({ ...f, city: v }))}
                  options={cityOptions}
                />
                <FilterSelect
                  label="Country"
                  value={filters.country}
                  onChange={(v) => setFilters((f) => ({ ...f, country: v }))}
                  options={countryOptions}
                />
                <FilterSelect
                  label="Created By"
                  value={filters.createdBy}
                  onChange={(v) => setFilters((f) => ({ ...f, createdBy: v }))}
                  options={createdByOptions}
                />
                <FilterSelect
                  label="Touched Records"
                  value={filters.touched}
                  onChange={(v) => setFilters((f) => ({ ...f, touched: v }))}
                  options={["TOUCHED", "UNTOUCHED"]}
                  optionLabels={{ TOUCHED: "Touched", UNTOUCHED: "Untouched" }}
                />
                <FilterSelect
                  label="Conversion Status"
                  value={filters.converted}
                  onChange={(v) => setFilters((f) => ({ ...f, converted: v }))}
                  options={["CONVERTED", "NOT_CONVERTED"]}
                  optionLabels={{
                    CONVERTED: "Converted",
                    NOT_CONVERTED: "Not Converted",
                  }}
                />
                <div className="space-y-1">
                  <Label className="text-xs font-bold text-slate-500">
                    Created From
                  </Label>
                  <DatePicker
                    value={filters.createdFrom}
                    onChange={(v) =>
                      setFilters((f) => ({ ...f, createdFrom: v }))
                    }
                    className="h-9 text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-bold text-slate-500">
                    Created To
                  </Label>
                  <DatePicker
                    value={filters.createdTo}
                    onChange={(v) =>
                      setFilters((f) => ({ ...f, createdTo: v }))
                    }
                    className="h-9 text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-bold text-slate-500">
                    Min. Annual Revenue
                  </Label>
                  <Input
                    type="number"
                    min={0}
                    value={filters.minAnnualRevenue}
                    onChange={(e) =>
                      setFilters((f) => ({
                        ...f,
                        minAnnualRevenue: e.target.value,
                      }))
                    }
                    placeholder="e.g. 1000000"
                    className="h-9 rounded-xl text-xs"
                  />
                </div>
              </div>
              <div className="flex items-center justify-between pt-1">
                <p className="text-sm text-slate-400">
                  {activeFilterCount > 0
                    ? `${activeFilterCount} filter${activeFilterCount === 1 ? "" : "s"} applied`
                    : "No filters applied"}
                </p>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2.5 text-xs gap-1 text-slate-500"
                  onClick={() => setFilters(DEFAULT_FILTERS)}
                  disabled={activeFilterCount === 0}
                >
                  <X className="h-3 w-3" /> Clear all
                </Button>
              </div>
            </div>
          )}
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="text-center py-16 text-slate-400 text-sm">
              Loading Leads…
            </div>
          ) : (
            <>
              <div className="overflow-x-auto crm-tracker-scroll">
                <Table>
                  <TableHeader
                    style={{
                      background:
                        "linear-gradient(135deg, #4D9F4B 0%, #72B84A 50%, #9FCA48 100%)",
                    }}
                    className="text-white"
                  >
                    <TableRow className="hover:bg-transparent border-none">
                      <TableHead className="text-center font-black text-sm uppercase tracking-wider text-white py-2.5 px-3 min-w-[200px]">
                        Company
                      </TableHead>
                      <TableHead className="text-center font-black text-sm uppercase tracking-wider text-white py-2.5 px-3 min-w-[170px]">
                        Lead Name
                      </TableHead>
                      <TableHead className="text-center font-black text-sm uppercase tracking-wider text-white py-2.5 px-3 min-w-[190px]">
                        Email
                      </TableHead>
                      <TableHead className="text-center font-black text-sm uppercase tracking-wider text-white py-2.5 px-3 min-w-[130px]">
                        Phone
                      </TableHead>
                      <TableHead className="text-center font-black text-sm uppercase tracking-wider text-white py-2.5 px-3 min-w-[130px]">
                        Lead Source
                      </TableHead>
                      <TableHead className="text-center font-black text-sm uppercase tracking-wider text-white py-2.5 px-3 min-w-[130px]">
                        Lead Owner
                      </TableHead>
                      <TableHead className="text-center font-black text-sm uppercase tracking-wider text-white py-2.5 px-3 min-w-[140px]">
                        Lead Status
                      </TableHead>
                      <TableHead className="text-center font-black text-sm uppercase tracking-wider text-white py-2.5 px-3 min-w-[130px]">
                        Conversion
                      </TableHead>
                      {OPTIONAL_COLUMN_META.filter((c) =>
                        visibleOptional.has(c.key),
                      ).map((c) => (
                        <TableHead
                          key={c.key}
                          className="text-center font-black text-sm uppercase tracking-wider text-white py-2.5 px-3 min-w-[130px]"
                        >
                          {c.label}
                        </TableHead>
                      ))}
                      {customFieldDefs.map((d) => (
                        <TableHead
                          key={d.key}
                          className="text-center font-black text-sm uppercase tracking-wider text-white py-2.5 px-3 min-w-[130px]"
                        >
                          {d.label}
                        </TableHead>
                      ))}
                      <TableHead className="text-center font-black text-sm uppercase tracking-wider text-white py-2.5 px-3 min-w-[376px]">
                        Actions
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody className="[&_tr:last-child]:border-b [&_tr:last-child]:border-brand-200">
                    {pagedIds.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={
                            9 + visibleOptional.size + customFieldDefs.length
                          }
                          className="text-center py-10 text-slate-400 text-sm"
                        >
                          {order.length === 0
                            ? 'No rows yet. Click "Add Row" to get started.'
                            : "No leads match your search/filters."}
                        </TableCell>
                      </TableRow>
                    ) : (
                      pagedIds.map((rowId) => {
                        const row = rows[rowId] || emptyLeadRow();
                        return (
                          <TableRow
                            key={rowId}
                            className="border-b border-brand-200 last:border-b-0 hover:bg-emerald-50/40"
                          >
                            <TableCell className="px-3 py-1 align-middle text-center">
                              <button
                                type="button"
                                className="text-base font-bold text-black hover:text-brand-600 hover:underline truncate max-w-[220px] block text-center mx-auto"
                                onClick={() =>
                                  navigate(`/crm/leads/${rowId}`, {
                                    state: {
                                      leadsFrom: `${location.pathname}${location.search}`,
                                    },
                                  })
                                }
                              >
                                {row.companyName || "—"}
                              </button>
                              <p className="text-sm font-normal text-slate-600 truncate max-w-[220px] mx-auto">
                                {row.domain}
                              </p>
                            </TableCell>
                            <TableCell className="px-3 py-1 align-middle text-center text-base text-slate-600 truncate max-w-[180px]">
                              {row.prospectName || "—"}
                            </TableCell>
                            <TableCell className="px-3 py-1 align-middle text-center text-base text-slate-600 truncate max-w-[200px]">
                              {row.email || "—"}
                            </TableCell>
                            <TableCell className="px-3 py-1 align-middle text-center text-base text-slate-600">
                              {row.contactNumber || "—"}
                            </TableCell>
                            <TableCell className="px-3 py-1 align-middle text-center text-base text-slate-600">
                              {row.leadSource || "—"}
                            </TableCell>
                            <TableCell className="px-3 py-1 align-middle text-center text-base text-slate-600">
                              {row.assignedTo || "—"}
                            </TableCell>
                            <TableCell className="px-3 py-1 align-middle text-center">
                              {row.leadStatus ? (
                                <Badge
                                  className={`border pointer-events-none ${LEAD_STATUS_STYLE[row.leadStatus] || "bg-slate-100 text-slate-600 border-slate-200"}`}
                                >
                                  {row.leadStatus.replace(/_/g, " ")}
                                </Badge>
                              ) : (
                                "—"
                              )}
                            </TableCell>
                            <TableCell className="px-3 py-1 align-middle text-center">
                              {row.linkedAccountId ? (
                                <Badge variant="success" className="text-xs">
                                  Converted
                                </Badge>
                              ) : (
                                <Badge
                                  variant="outline"
                                  className="text-xs text-slate-500 border-slate-200 bg-slate-50"
                                >
                                  Not Converted
                                </Badge>
                              )}
                            </TableCell>
                            {OPTIONAL_COLUMN_META.filter((c) =>
                              visibleOptional.has(c.key),
                            ).map((c) => (
                              <TableCell
                                key={c.key}
                                className="px-3 py-1 align-middle text-center text-base text-slate-600"
                              >
                                {renderOptionalCell(c.key, rowId, row)}
                              </TableCell>
                            ))}
                            {customFieldDefs.map((d) => (
                              <TableCell
                                key={d.key}
                                className="px-3 py-1 align-middle text-center text-base text-slate-600"
                              >
                                {row.customFields?.[d.key] || "—"}
                              </TableCell>
                            ))}
                            <TableCell className="px-3 py-1 align-middle text-center">
                              <div className="grid grid-cols-[72px_72px_116px_96px] items-center justify-items-center gap-0.5 mx-auto w-fit">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="rounded-lg gap-1 h-8 text-xs shrink-0 border-blue-200 text-blue-600 bg-blue-50/50 hover:text-blue-700 hover:border-blue-400 hover:bg-blue-100"
                                  onClick={() =>
                                    navigate(`/crm/leads/${rowId}`, {
                                      state: {
                                        leadsFrom: `${location.pathname}${location.search}`,
                                      },
                                    })
                                  }
                                >
                                  <Eye className="h-3.5 w-3.5" /> View
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="rounded-lg gap-1 h-8 text-xs shrink-0"
                                  onClick={() => openEdit(rowId)}
                                >
                                  <Pencil className="h-3.5 w-3.5" /> Edit
                                </Button>
                                <div className="flex items-center justify-center">
                                  {row.linkedAccountId ? (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="rounded-lg gap-1 h-8 text-xs shrink-0 border-blue-200 text-blue-600 bg-blue-50/50 hover:text-blue-700 hover:border-blue-400 hover:bg-blue-100"
                                      onClick={() =>
                                        navigate(
                                          `/crm/accounts/${row.linkedAccountId}`,
                                          {
                                            state: {
                                              from: `${location.pathname}${location.search}`,
                                              label: "Leads",
                                            },
                                          },
                                        )
                                      }
                                    >
                                      <ArrowUpRight className="h-3.5 w-3.5" />{" "}
                                      View Account
                                    </Button>
                                  ) : (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="rounded-lg gap-1 h-8 text-xs shrink-0 border-brand-300 text-brand-700 bg-brand-50/60 hover:bg-brand-100 hover:border-brand-400 disabled:opacity-70 disabled:text-brand-700 disabled:border-brand-200 disabled:bg-brand-50/40"
                                      disabled={!row.companyName?.trim()}
                                      onClick={() => openConvert(rowId)}
                                    >
                                      <ArrowRightCircle className="h-3.5 w-3.5" />{" "}
                                      Convert
                                    </Button>
                                  )}
                                </div>
                                <div className="flex items-center justify-center -ml-6">
                                  {isCrmAdmin(user) && (
                                    <DeleteConfirmDialog
                                      trigger={
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          className="h-8 px-2 gap-1 text-xs font-semibold shrink-0 text-red-700 border-red-200 bg-red-50/50 hover:text-red-800 hover:border-red-400 hover:bg-red-100 rounded-lg"
                                          title="Delete lead"
                                        >
                                          <Trash2 className="h-3.5 w-3.5" />{" "}
                                          Delete
                                        </Button>
                                      }
                                      title="Delete this lead?"
                                      description={`"${row.companyName || "This lead"}" will be moved to the CRM Recycle Bin.`}
                                      warning={
                                        row.linkedAccountId
                                          ? "This lead has already been converted — deleting it will NOT remove the linked Account, Contact or Opportunity, which remain as separate records."
                                          : undefined
                                      }
                                      onConfirm={() => handleDeleteRow(rowId)}
                                    />
                                  )}
                                </div>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination */}
              <PaginationFooter
                page={clampedPage}
                setPage={setPage}
                pageSize={pageSize}
                setPageSize={setPageSize}
                totalPages={totalPages}
                total={sortedIds.length}
              />
            </>
          )}
        </CardContent>
      </Card>

      {convertRowId && rows[convertRowId] && (
        <LeadConvertDialog
          open={!!convertRowId}
          onOpenChange={(open) => !open && setConvertRowId(null)}
          rowId={convertRowId}
          row={rows[convertRowId]}
          currentUser={currentUser}
        />
      )}
    </div>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
  optionLabels,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
  optionLabels?: Record<string, string>;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-xs font-bold text-slate-500">{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="h-9 rounded-xl text-xs bg-white">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="ALL">All</SelectItem>
          {options.map((opt) => (
            <SelectItem key={opt} value={opt}>
              {optionLabels?.[opt] || opt.replace(/_/g, " ")}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
