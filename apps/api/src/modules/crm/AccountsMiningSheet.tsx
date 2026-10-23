import { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { ref, onValue, set, push } from "firebase/database";
import { softDeleteCrmRecord } from "./domain/recycleBinService";
import { isCrmAdmin } from "./domain/roles";
import { celebrateCrm } from "./celebration";
import { database } from "@/services/firebase";
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
import { Checkbox } from "@/components/ui/checkbox";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Plus,
  Pencil,
  Eye,
  Trash2,
  Settings2,
  Hash,
  Building2,
  UserCheck,
  Activity,
  Globe2,
  Target,
  ArrowUpRight,
  ArrowLeft,
  Sparkles,
} from "lucide-react";
import { AccountsMiningRow, AccountsMiningSheetData, LeadsRow } from "./types";
import { PanelSectionDef } from "./components/RecordFormPanel";
import { DetailPageBoxes } from "./components/DetailPageBoxes";
import { useAuth } from "@/context/AuthContext";
import { toast } from "@/hooks/use-toast";
import { DeleteConfirmDialog } from "./intelligence/components";
import { writeCrmAuditLog } from "./intelligence/auditService";
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

const PRIORITY_OPTIONS = ["High", "Medium", "Low"];

// Toggleable table columns (Actions is always shown separately).
type ColumnKey =
  "company" | "decisionMaker" | "contactNumber" | "followUpStatus";
const COLUMN_META: { key: ColumnKey; label: string }[] = [
  { key: "company", label: "Company" },
  { key: "decisionMaker", label: "Decision Maker" },
  { key: "contactNumber", label: "Contact Number" },
  { key: "followUpStatus", label: "Follow-up Status" },
];

// Second tab of the CRM module. Isolated from Overall Data — stored under its own
// `crm/accountsMiningSheet` path. Fields/order below are fixed as required — this file only
// restructures how they're presented (tabbed record panel instead of one wide table).
const SECTIONS: PanelSectionDef<AccountsMiningRow>[] = [
  {
    id: "basic",
    title: "Basic Information",
    description: "Serial number and date this account was mined.",
    icon: Hash,
    tone: "slate",
    fields: [
      { key: "serialNo", label: "Serial No" },
      { key: "date", label: "Date" },
    ],
  },
  {
    id: "company",
    title: "Company Details",
    description: "Company identity and web presence.",
    icon: Building2,
    tone: "blue",
    fields: [
      { key: "domain", label: "Domain" },
      { key: "companyName", label: "Name of the Company" },
      { key: "hq", label: "HQ" },
      { key: "website", label: "Website" },
    ],
  },
  {
    id: "decision-maker",
    title: "Decision Maker",
    description: "Key contact identified at this company.",
    icon: UserCheck,
    tone: "purple",
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
    icon: Activity,
    tone: "amber",
    fields: [
      { key: "emailStatus", label: "Email Status" },
      { key: "followUpStatus", label: "Follow-up Status" },
    ],
  },
  {
    id: "business-profile",
    title: "Business Profile",
    description: "Additional company profile and location details.",
    icon: Globe2,
    tone: "teal",
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
    icon: Target,
    tone: "rose",
    fields: [
      { key: "assignedTo", label: "Assigned To" },
      {
        key: "priority",
        label: "Priority",
        type: "select",
        options: PRIORITY_OPTIONS,
      },
      { key: "nextFollowUpDate", label: "Next Follow-up Date" },
      { key: "notes", label: "Notes", type: "textarea", span: 2 },
    ],
  },
];

export const emptyRow = (): AccountsMiningRow => ({
  serialNo: "",
  date: "",
  domain: "",
  companyName: "",
  hq: "",
  website: "",
  keyDecisionMakers: "",
  title: "",
  contactNumber: "",
  email: "",
  emailStatus: "",
  followUpStatus: "",
  industry: "",
  numberOfEmployees: "",
  city: "",
  state: "",
  country: "",
  linkedInProfile: "",
  assignedTo: "",
  priority: "",
  nextFollowUpDate: "",
  notes: "",
});

export const IMPORT_EXPORT_FIELDS: FieldSchema<AccountsMiningRow>[] = [
  { key: "serialNo", label: "Serial No" },
  { key: "date", label: "Date" },
  { key: "domain", label: "Domain" },
  {
    key: "companyName",
    label: "Name of the Company",
    required: true,
    aliases: ["Company Name", "Company"],
  },
  { key: "hq", label: "HQ" },
  { key: "website", label: "Website" },
  {
    key: "keyDecisionMakers",
    label: "Key Decision Makers",
    aliases: ["Decision Maker", "Key Decision Maker"],
  },
  { key: "title", label: "Title" },
  {
    key: "contactNumber",
    label: "Contact Number",
    aliases: ["Phone", "Mobile Number"],
  },
  { key: "email", label: "Email ID", type: "email", aliases: ["Email"] },
  { key: "emailStatus", label: "Email Status" },
  { key: "followUpStatus", label: "Follow-up Status" },
  { key: "industry", label: "Industry" },
  { key: "numberOfEmployees", label: "No. of Employees" },
  { key: "city", label: "City" },
  { key: "state", label: "State / Province" },
  { key: "country", label: "Country" },
  { key: "linkedInProfile", label: "LinkedIn Profile" },
  { key: "assignedTo", label: "Assigned To" },
  { key: "priority", label: "Priority" },
  { key: "nextFollowUpDate", label: "Next Follow-up Date" },
  { key: "notes", label: "Notes" },
];

export const PATH = "crm/accountsMiningSheet";

export default function AccountsMiningSheet() {
  const { user } = useAuth();
  const location = useLocation();
  const fromDashboard = (
    location.state as { fromCrmDashboard?: boolean } | null
  )?.fromCrmDashboard;
  const currentUser = user?.name || user?.username || "CRM User";
  const [rows, setRows] = useState<AccountsMiningSheetData>({});
  const [order, setOrder] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingRowId, setEditingRowId] = useState<string | null>(null);
  const [viewingRowId, setViewingRowId] = useState<string | null>(null);
  // The button that triggers `handlePromoteToLead` only flips to its disabled "Promoted" state
  // once `promotedToLeadRowId` is written back from Firebase — a double-click (or clicking again
  // while the first push() is still in flight) would otherwise race two pushes into `crm/leads`
  // for the same row. Tracked locally so the button disables immediately on the first click.
  const [promotingRowIds, setPromotingRowIds] = useState<Set<string>>(
    new Set(),
  );
  const [visibleColumns, setVisibleColumns] = useState<Set<ColumnKey>>(
    new Set(COLUMN_META.map((c) => c.key)),
  );
  const customFieldDefs = useCrmCustomFields("accountsMining");

  // Subscribe to the Accounts Mining Sheet data — isolated under its own path so it
  // never touches `crm/overallData` / `crm/overallReport`.
  useEffect(() => {
    setLoading(true);
    const sheetRef = ref(database, "crm/accountsMiningSheet");
    const unsub = onValue(sheetRef, (snap) => {
      const val: AccountsMiningSheetData = snap.val() || {};
      setRows(val);
      setOrder(Object.keys(val).sort()); // push ids sort chronologically
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const handleChange = (
    rowId: string,
    field: keyof AccountsMiningRow,
    value: string,
  ) => {
    setRows((prev) => ({
      ...prev,
      [rowId]: { ...(prev[rowId] || emptyRow()), [field]: value },
    }));
  };

  const handleBlur = (rowId: string, field: keyof AccountsMiningRow) => {
    const value = rows[rowId]?.[field] ?? "";
    set(
      ref(database, `crm/accountsMiningSheet/${rowId}/${field}`),
      value,
    ).catch((err) =>
      console.error("Failed to save Accounts Mining Sheet cell:", err),
    );
  };

  const handleSelectChange = (
    rowId: string,
    field: keyof AccountsMiningRow,
    value: string,
  ) => {
    handleChange(rowId, field, value);
    set(
      ref(database, `crm/accountsMiningSheet/${rowId}/${field}`),
      value,
    ).catch((err) => {
      console.error("Failed to save Accounts Mining Sheet cell:", err);
      toast({
        title: "Failed to save change",
        description: err instanceof Error ? err.message : undefined,
        variant: "destructive",
      });
    });
  };

  // Bulk-Import-discovered fields (see bulkImport/crmCustomFieldsService.ts).
  const handleCustomFieldChange = (
    rowId: string,
    key: string,
    value: string,
  ) => {
    setRows((prev) => ({
      ...prev,
      [rowId]: {
        ...(prev[rowId] || emptyRow()),
        customFields: { ...(prev[rowId]?.customFields || {}), [key]: value },
      },
    }));
  };

  const handleCustomFieldBlur = (rowId: string, key: string) => {
    const value = rows[rowId]?.customFields?.[key] || "";
    setCrmCustomFieldValue("crm/accountsMiningSheet", rowId, key, value).catch(
      (err) => {
        console.error(
          "Failed to save Accounts Mining Sheet custom field:",
          err,
        );
        toast({
          title: "Failed to save change",
          description: err instanceof Error ? err.message : undefined,
          variant: "destructive",
        });
      },
    );
  };

  const handleAddRow = () => {
    const newRef = push(ref(database, "crm/accountsMiningSheet"));
    if (!newRef.key) return;
    const payload: AccountsMiningRow = {
      ...emptyRow(),
      createdAt: Date.now(),
      createdBy: currentUser,
    };
    set(newRef, payload)
      .then(() => celebrateCrm("mining.recordCreated"))
      .catch((err) => {
        console.error("Failed to add Accounts Mining Sheet row:", err);
        toast({
          title: "Failed to add row",
          description: err instanceof Error ? err.message : undefined,
          variant: "destructive",
        });
      });
    setEditingRowId(newRef.key);
  };

  // Explicit "Save & Close" — writes the full in-memory row so the record is guaranteed to be
  // persisted (even if the field currently focused hasn't blurred yet) and refreshes the row
  // immediately via the existing `onValue` subscription, then closes the panel.
  const handleSaveAndClose = () => {
    if (editingRowId) {
      const current = rows[editingRowId] || emptyRow();
      set(ref(database, `crm/accountsMiningSheet/${editingRowId}`), current)
        .then(() => toast({ title: "Record saved" }))
        .catch((err) => {
          console.error("Failed to save Accounts Mining Sheet record:", err);
          toast({
            title: "Failed to save record",
            description: err instanceof Error ? err.message : undefined,
            variant: "destructive",
          });
        });
    }
    setEditingRowId(null);
  };

  const handleDeleteRow = async (rowId: string) => {
    const row = rows[rowId];
    try {
      const deleted = await softDeleteCrmRecord(
        "accountsMiningSheet",
        row?.companyName || rowId,
        "crm/accountsMiningSheet",
        rowId,
        user,
      );
      if (!deleted) {
        // Already gone (e.g. deleted from another tab/session moments earlier) — say so instead
        // of leaving the confirm dialog close with zero feedback either way.
        toast({ title: "Record was already removed" });
        return;
      }
      await writeCrmAuditLog({
        action: "record_deleted",
        entityType: "accountsMiningSheet",
        entityId: rowId,
        details: `Accounts Mining Sheet record "${row?.companyName || rowId}" moved to Recycle Bin`,
        by: currentUser,
        at: Date.now(),
      });
      toast({ title: "Record deleted" });
    } catch (err) {
      console.error("Failed to delete Accounts Mining Sheet row:", err);
      toast({
        title: "Failed to delete record",
        description: err instanceof Error ? err.message : undefined,
        variant: "destructive",
      });
      throw err;
    }
  };

  /**
   * Promotes a mined account into the Leads sheet — the funnel step the audit found completely
   * disconnected (Account Mining had no programmatic link to Leads/Accounts). Carries source
   * metadata through (`sourceMiningRowId`) so the full Mining → Lead → Account → Opportunity
   * chain stays traceable, and marks the mining row so it can't be promoted twice.
   */
  const handlePromoteToLead = async (rowId: string) => {
    const row = rows[rowId];
    if (!row || row.promotedToLeadRowId || promotingRowIds.has(rowId)) return;
    setPromotingRowIds((prev) => new Set(prev).add(rowId));
    try {
      const leadPayload: LeadsRow = {
        meetingStatus: "",
        month: "",
        date: new Date().toISOString().slice(0, 10),
        meetingScheduled: "",
        companyName: row.companyName,
        domain: row.domain,
        hq: row.hq,
        prospectName: row.keyDecisionMakers || "",
        title: row.title || "",
        contactNumber: row.contactNumber || "",
        email: row.email || "",
        areaOfInterest: row.notes || "",
        comments: "",
        leadStatus: "NEW",
        priority: row.priority || "Medium",
        assignedTo: row.assignedTo || currentUser,
        leadSource: "Accounts Mining",
        website: row.website || "",
        industry: row.industry || "",
        numberOfEmployees: row.numberOfEmployees || "",
        city: row.city || "",
        state: row.state || "",
        country: row.country || "",
        sourceMiningRowId: rowId,
        createdAt: Date.now(),
        createdBy: currentUser,
      };
      const newLeadRef = push(ref(database, "crm/leads"));
      if (!newLeadRef.key) throw new Error("Failed to allocate a new Lead id.");
      await set(newLeadRef, leadPayload);
      await set(
        ref(database, `crm/accountsMiningSheet/${rowId}/promotedToLeadRowId`),
        newLeadRef.key,
      );
      await writeCrmAuditLog({
        action: "mining_promoted_to_lead",
        entityType: "lead",
        entityId: newLeadRef.key,
        companyKey: newLeadRef.key,
        companyName: row.companyName,
        details: `"${row.companyName}" promoted from Accounts Mining Sheet to a Lead`,
        by: currentUser,
        at: Date.now(),
      });
      toast({
        title: "Promoted to Lead",
        description: `"${row.companyName}" is now in the Leads tab.`,
      });
      celebrateCrm("mining.promoted");
    } catch (err) {
      console.error("Failed to promote mining row to Lead:", err);
      toast({
        title: "Failed to promote to Lead",
        description: err instanceof Error ? err.message : undefined,
        variant: "destructive",
      });
    } finally {
      setPromotingRowIds((prev) => {
        const next = new Set(prev);
        next.delete(rowId);
        return next;
      });
    }
  };

  const toggleColumn = (key: ColumnKey) => {
    setVisibleColumns((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const editingRow = editingRowId
    ? rows[editingRowId] || emptyRow()
    : emptyRow();
  const viewingRow = viewingRowId
    ? rows[viewingRowId] || emptyRow()
    : emptyRow();

  // Custom Fields section only appears once Bulk Import has actually discovered one for this sheet.
  const miningFormSections: PanelSectionDef<AccountsMiningRow>[] =
    useMemo(() => {
      if (customFieldDefs.length === 0) return SECTIONS;
      return [
        ...SECTIONS,
        {
          id: "custom-fields",
          title: "Additional Fields (from Import)",
          description:
            "Discovered automatically from an imported Excel column with no matching built-in field.",
          icon: Sparkles,
          tone: "brand" as const,
          fields: customFieldDefs.map((d) => ({
            custom: true as const,
            key: d.key,
            label: d.label,
          })),
        },
      ];
    }, [customFieldDefs]);

  const exportRecords = order.map((id) => rows[id] || emptyRow());

  const commitImport = async (
    importRows: MappedImportRow[],
    strategy: DuplicateStrategy,
  ) => {
    const summary = await commitFirebaseImport(
      PATH,
      importRows,
      strategy,
      (row) => ({ ...emptyRow(), ...row.data }),
    );
    await logBulkImportAudit(
      "accountsMiningSheet",
      "Accounts Mining Sheet",
      summary,
      currentUser,
    );
    return summary;
  };

  const visibleColumnCount =
    COLUMN_META.filter((c) => visibleColumns.has(c.key)).length +
    customFieldDefs.length;
  // The Actions column needs a guaranteed pixel width (not a percentage) so it always has room
  // for View + Edit + Promote to Lead + Delete without clipping or spilling outside the table,
  // no matter how narrow the viewport gets. Data columns then share whatever space is left.
  const actionsColWidth = visibleColumnCount === 0 ? "100%" : "400px";
  const dataColWidthStyle =
    visibleColumnCount === 0
      ? "0"
      : `calc((100% - 400px) / ${visibleColumnCount})`;

  const backButton = fromDashboard ? (
    <BackToDashboardButton />
  ) : (
    <Button
      size="sm"
      variant="ghost"
      className="rounded-xl gap-1.5 -ml-2"
      onClick={() => setViewingRowId(null)}
    >
      <ArrowLeft className="h-3.5 w-3.5" /> Back to Account Mining Sheet
    </Button>
  );
  const backButtonEdit = fromDashboard ? (
    <BackToDashboardButton />
  ) : (
    <Button
      size="sm"
      variant="ghost"
      className="rounded-xl gap-1.5 -ml-2"
      onClick={handleSaveAndClose}
    >
      <ArrowLeft className="h-3.5 w-3.5" /> Back to Account Mining Sheet
    </Button>
  );

  if (viewingRowId) {
    return (
      <div className="space-y-6 pb-8">
        {backButton}
        <DetailPageBoxes<AccountsMiningRow>
          heading={viewingRow.companyName || "Record Details"}
          subheading="Accounts Mining Sheet — View Only"
          sections={miningFormSections}
          values={viewingRow}
          onFieldChange={() => {}}
          onFieldBlur={() => {}}
          readOnly
          emphasized
        />
      </div>
    );
  }

  if (editingRowId) {
    return (
      <div className="space-y-6 pb-8">
        {backButtonEdit}
        <DetailPageBoxes<AccountsMiningRow>
          heading={editingRow.companyName || "New Record"}
          subheading="Accounts Mining Sheet"
          sections={miningFormSections}
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
              <Button
                type="button"
                className="rounded-xl gap-1.5"
                onClick={handleSaveAndClose}
              >
                Save &amp; Close
              </Button>
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
        <CardHeader className="crm-panel-header relative overflow-hidden p-5 border-b border-brand-200/50 bg-gradient-to-br from-white via-brand-100/70 to-blue-100/50 flex flex-row items-center justify-between gap-4 flex-wrap">
          <span
            aria-hidden
            className="pointer-events-none absolute -left-16 -top-20 h-48 w-48 rounded-full bg-brand-300/40 blur-3xl"
          />
          <span
            aria-hidden
            className="pointer-events-none absolute right-10 -bottom-20 h-48 w-48 rounded-full bg-blue-300/35 blur-3xl"
          />
          <div className="relative">
            <CardTitle className="text-lg font-extrabold text-slate-900">
              Accounts Mining Sheet
            </CardTitle>
            <CardDescription className="text-sm text-slate-500">
              Track mined accounts and decision-maker contact details. Click
              Edit to view and update full details.
            </CardDescription>
          </div>
          <div className="relative flex items-center gap-2 flex-wrap">
            <ImportExportBar
              moduleLabel="Accounts Mining Sheet"
              fields={IMPORT_EXPORT_FIELDS}
              allRecords={exportRecords}
              fileBaseName="crm-accounts-mining-sheet"
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
              commitImport={commitImport}
            />
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  size="sm"
                  variant="outline"
                  className="rounded-xl gap-1.5 h-9 shrink-0"
                >
                  <Settings2 className="h-3.5 w-3.5" /> Columns
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-56 rounded-2xl">
                <p className="text-xs font-extrabold uppercase tracking-wider text-slate-400 mb-2">
                  Show / Hide Columns
                </p>
                <div className="space-y-2">
                  {COLUMN_META.map((col) => (
                    <label
                      key={col.key}
                      className="flex items-center gap-2 text-sm cursor-pointer"
                    >
                      <Checkbox
                        checked={visibleColumns.has(col.key)}
                        onCheckedChange={() => toggleColumn(col.key)}
                      />
                      {col.label}
                    </label>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
            <Button
              size="sm"
              className="rounded-xl gap-1.5 shrink-0"
              onClick={handleAddRow}
            >
              <Plus className="h-4 w-4" />
              Add
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="text-center py-16 text-slate-400 text-sm">
              Loading Accounts Mining Sheet…
            </div>
          ) : (
            <div className="overflow-x-auto crm-tracker-scroll">
              <Table className="table-fixed w-full min-w-[1080px]">
                <TableHeader
                  style={{
                    background:
                      "linear-gradient(135deg, #4D9F4B 0%, #72B84A 50%, #9FCA48 100%)",
                  }}
                  className="text-white"
                >
                  <TableRow className="hover:bg-transparent border-none">
                    {visibleColumns.has("company") && (
                      <TableHead
                        style={{ width: dataColWidthStyle }}
                        className="text-center font-black text-sm uppercase tracking-wider text-white py-2.5 px-3"
                      >
                        Company
                      </TableHead>
                    )}
                    {visibleColumns.has("decisionMaker") && (
                      <TableHead
                        style={{ width: dataColWidthStyle }}
                        className="text-center font-black text-sm uppercase tracking-wider text-white py-2.5 px-3"
                      >
                        Decision Maker
                      </TableHead>
                    )}
                    {visibleColumns.has("contactNumber") && (
                      <TableHead
                        style={{ width: dataColWidthStyle }}
                        className="text-center font-black text-sm uppercase tracking-wider text-white py-2.5 px-3"
                      >
                        Contact Number
                      </TableHead>
                    )}
                    {visibleColumns.has("followUpStatus") && (
                      <TableHead
                        style={{ width: dataColWidthStyle }}
                        className="text-center font-black text-sm uppercase tracking-wider text-white py-2.5 px-3"
                      >
                        Follow-up Status
                      </TableHead>
                    )}
                    {customFieldDefs.map((d) => (
                      <TableHead
                        key={d.key}
                        style={{ width: dataColWidthStyle }}
                        className="text-center font-black text-sm uppercase tracking-wider text-white py-2.5 px-3"
                      >
                        {d.label}
                      </TableHead>
                    ))}
                    <TableHead
                      style={{ width: actionsColWidth }}
                      className="text-center font-black text-sm uppercase tracking-wider text-white py-2.5 px-3"
                    >
                      Actions
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="[&_tr:last-child]:border-b [&_tr:last-child]:border-brand-200">
                  {order.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={visibleColumnCount + 1}
                        className="text-center py-10 text-slate-400 text-sm"
                      >
                        No rows yet. Click &quot;+ Add&quot; to get started.
                      </TableCell>
                    </TableRow>
                  ) : (
                    order.map((rowId) => {
                      const row = rows[rowId] || emptyRow();
                      return (
                        <TableRow
                          key={rowId}
                          className="border-b border-brand-200 last:border-b-0 hover:bg-emerald-50/40"
                        >
                          {visibleColumns.has("company") && (
                            <TableCell className="px-3 py-1 align-middle text-center">
                              <p className="text-sm font-semibold text-slate-800 truncate">
                                {row.companyName || "—"}
                              </p>
                              <p className="text-sm text-slate-400 truncate">
                                {row.domain}
                              </p>
                            </TableCell>
                          )}
                          {visibleColumns.has("decisionMaker") && (
                            <TableCell className="px-3 py-1 align-middle text-center text-base text-slate-600 truncate">
                              {row.keyDecisionMakers || "—"}
                            </TableCell>
                          )}
                          {visibleColumns.has("contactNumber") && (
                            <TableCell className="px-3 py-1 align-middle text-center text-base text-slate-600 truncate">
                              {row.contactNumber || "—"}
                            </TableCell>
                          )}
                          {visibleColumns.has("followUpStatus") && (
                            <TableCell className="px-3 py-1 align-middle text-center text-base text-slate-600 truncate">
                              {row.followUpStatus || "—"}
                            </TableCell>
                          )}
                          {customFieldDefs.map((d) => (
                            <TableCell
                              key={d.key}
                              className="px-3 py-1 align-middle text-center text-base text-slate-600 truncate"
                            >
                              {row.customFields?.[d.key] || "—"}
                            </TableCell>
                          ))}
                          <TableCell
                            style={{ width: actionsColWidth }}
                            className="px-3 py-1 align-middle text-center overflow-hidden"
                          >
                            <div className="grid grid-cols-[64px_64px_132px_96px] items-center justify-items-center gap-0 mx-auto w-fit">
                              <Button
                                size="sm"
                                variant="outline"
                                className="rounded-lg gap-1 h-8 text-xs shrink-0 justify-self-end border-blue-200 text-blue-600 bg-blue-50/50 hover:text-blue-700 hover:border-blue-400 hover:bg-blue-100"
                                onClick={() => setViewingRowId(rowId)}
                              >
                                <Eye className="h-3.5 w-3.5" /> View
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="rounded-lg gap-1 h-8 text-xs shrink-0 justify-self-end"
                                onClick={() => setEditingRowId(rowId)}
                              >
                                <Pencil className="h-3.5 w-3.5" /> Edit
                              </Button>
                              <div className="flex items-center justify-center">
                                {row.promotedToLeadRowId ? (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="rounded-lg gap-1 h-8 text-xs shrink-0 text-slate-600 border-slate-300 bg-slate-50"
                                    disabled
                                    title="Already promoted to a Lead"
                                  >
                                    <ArrowUpRight className="h-3.5 w-3.5" />{" "}
                                    Promoted
                                  </Button>
                                ) : (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="rounded-lg gap-1 h-8 text-xs shrink-0 text-brand-700 border-brand-200 bg-brand-50/50 hover:bg-brand-100"
                                    disabled={promotingRowIds.has(rowId)}
                                    onClick={() => handlePromoteToLead(rowId)}
                                  >
                                    <ArrowUpRight className="h-3.5 w-3.5" />{" "}
                                    {promotingRowIds.has(rowId)
                                      ? "Promoting…"
                                      : "Promote to Lead"}
                                  </Button>
                                )}
                              </div>
                              <div className="flex items-center justify-center -ml-8">
                                {isCrmAdmin(user) && (
                                  <DeleteConfirmDialog
                                    trigger={
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        className="rounded-lg gap-1 h-8 text-xs shrink-0 border-red-200 text-red-600 bg-red-50/50 hover:text-red-700 hover:border-red-400 hover:bg-red-100"
                                      >
                                        <Trash2 className="h-3.5 w-3.5" />{" "}
                                        Delete
                                      </Button>
                                    }
                                    title="Delete this record?"
                                    description={`"${row.companyName || "This record"}" will be moved to the CRM Recycle Bin.`}
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
          )}
        </CardContent>
      </Card>
    </div>
  );
}
