// Cold Calling Status — additive CRM tab. Logs raw cold-calling call outcomes (as they come out of
// the source spreadsheet: SINO / Date / Company Name / Prospect Name / Designation / Status) ahead
// of a human routing each row into the existing Interested / Not Interested / Keep in Touch /
// Call Back-Send Info disposition queues. Isolated Firebase path (`crm/coldCallingStatus`) — it
// does not replace or write into any of those queues on its own; "Route to CRM Status" below is
// the only bridge, and only when a person explicitly picks a disposition via the existing
// `StatusTagDialog` (the exact same control the Account 360 page and Accounts list already use).
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
import { Input } from "@/components/ui/input";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Plus,
  Pencil,
  Eye,
  Trash2,
  Search as SearchIcon,
  Link2,
  ExternalLink,
  PhoneCall,
  Sparkles,
  ArrowLeft,
} from "lucide-react";
import { Link } from "react-router-dom";
import { ColdCallingRow, ColdCallingSheetData } from "./types";
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
import { useCrmDomainData } from "./domain/useCrmDomainData";
import {
  createCrmAccount,
  findPossibleDuplicateAccount,
} from "./domain/accountsService";
import { StatusTagDialog, STATUS_TAG_STYLE } from "./domain/StatusTagDialog";
import { CrmStatusTag } from "./domain/types";

const SECTIONS: PanelSectionDef<ColdCallingRow>[] = [
  {
    id: "call",
    title: "Cold Calling Details",
    description:
      "Serial number, date and the original call outcome — exactly as logged.",
    icon: PhoneCall,
    tone: "amber",
    fields: [
      { key: "serialNo", label: "Serial No (SINO)" },
      { key: "date", label: "Date", type: "date" },
      { key: "status", label: "Status", type: "textarea", span: 2 },
    ],
  },
  {
    id: "company",
    title: "Company & Prospect",
    description: "Who was called.",
    icon: PhoneCall,
    tone: "blue",
    fields: [
      { key: "companyName", label: "Company Name" },
      { key: "prospectName", label: "Prospect Name" },
      { key: "designation", label: "Designation" },
    ],
  },
];

export const emptyRow = (): ColdCallingRow => ({
  serialNo: "",
  date: "",
  companyName: "",
  prospectName: "",
  designation: "",
  status: "",
});

export const IMPORT_EXPORT_FIELDS: FieldSchema<ColdCallingRow>[] = [
  { key: "serialNo", label: "Serial No", aliases: ["SINO", "S.No", "Sl No"] },
  { key: "date", label: "Date" },
  {
    key: "companyName",
    label: "Company Name",
    required: true,
    aliases: ["Name of the Company", "Company"],
  },
  { key: "prospectName", label: "Prospect Name" },
  { key: "designation", label: "Designation", aliases: ["Title"] },
  {
    key: "status",
    label: "Status",
    aliases: ["Cold Calling Status", "Call Status"],
  },
];

export const PATH = "crm/coldCallingStatus";

export default function ColdCallingStatus() {
  const { user } = useAuth();
  const location = useLocation();
  const fromDashboard = (
    location.state as { fromCrmDashboard?: boolean } | null
  )?.fromCrmDashboard;
  const currentUser = user?.name || user?.username || "CRM User";
  const { accounts, tasks } = useCrmDomainData();
  const [rows, setRows] = useState<ColdCallingSheetData>({});
  const [order, setOrder] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingRowId, setEditingRowId] = useState<string | null>(null);
  const [viewingRowId, setViewingRowId] = useState<string | null>(null);
  const [linkingRowIds, setLinkingRowIds] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const customFieldDefs = useCrmCustomFields("coldCalling");

  useEffect(() => {
    setLoading(true);
    const sheetRef = ref(database, PATH);
    const unsub = onValue(sheetRef, (snap) => {
      const val: ColdCallingSheetData = snap.val() || {};
      setRows(val);
      setOrder(Object.keys(val).sort());
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const handleChange = (
    rowId: string,
    field: keyof ColdCallingRow,
    value: string,
  ) => {
    setRows((prev) => ({
      ...prev,
      [rowId]: { ...(prev[rowId] || emptyRow()), [field]: value },
    }));
  };

  const handleBlur = (rowId: string, field: keyof ColdCallingRow) => {
    const value = rows[rowId]?.[field] ?? "";
    set(ref(database, `${PATH}/${rowId}/${field}`), value).catch((err) =>
      console.error("Failed to save Cold Calling Status cell:", err),
    );
  };

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
    setCrmCustomFieldValue(PATH, rowId, key, value).catch((err) => {
      console.error("Failed to save Cold Calling Status custom field:", err);
      toast({
        title: "Failed to save change",
        description: err instanceof Error ? err.message : undefined,
        variant: "destructive",
      });
    });
  };

  const handleAddRow = () => {
    const newRef = push(ref(database, PATH));
    if (!newRef.key) return;
    const payload: ColdCallingRow = {
      ...emptyRow(),
      createdAt: Date.now(),
      createdBy: currentUser,
    };
    set(newRef, payload)
      .then(() => celebrateCrm("mining.recordCreated"))
      .catch((err) => {
        console.error("Failed to add Cold Calling Status row:", err);
        toast({
          title: "Failed to add row",
          description: err instanceof Error ? err.message : undefined,
          variant: "destructive",
        });
      });
    setEditingRowId(newRef.key);
  };

  const handleSaveAndClose = () => {
    if (editingRowId) {
      const current = rows[editingRowId] || emptyRow();
      set(ref(database, `${PATH}/${editingRowId}`), current)
        .then(() => toast({ title: "Record saved" }))
        .catch((err) => {
          console.error("Failed to save Cold Calling Status record:", err);
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
        "coldCallingStatus",
        row?.companyName || rowId,
        PATH,
        rowId,
        user,
      );
      if (!deleted) {
        toast({ title: "Record was already removed" });
        return;
      }
      await writeCrmAuditLog({
        action: "record_deleted",
        entityType: "coldCallingStatus",
        entityId: rowId,
        details: `Cold Calling Status record "${row?.companyName || rowId}" moved to Recycle Bin`,
        by: currentUser,
        at: Date.now(),
      });
      toast({ title: "Record deleted" });
    } catch (err) {
      console.error("Failed to delete Cold Calling Status row:", err);
      toast({
        title: "Failed to delete record",
        description: err instanceof Error ? err.message : undefined,
        variant: "destructive",
      });
      throw err;
    }
  };

  /** Matches (or, only on explicit click, creates) the Core CRM Account for this row's company —
   *  same matching order/logic Bulk Import already uses for Call Back/Not Interested/Keep in
   *  Touch/Yet to Happen rows (name -> website/domain -> email), so Cold Calling never creates a
   *  duplicate Account for a company that already exists. */
  const handleLinkAccount = async (rowId: string) => {
    const row = rows[rowId];
    if (!row || row.linkedAccountId || linkingRowIds.has(rowId)) return;
    const companyName = (row.companyName || "").trim();
    if (!companyName) {
      toast({ title: "Add a company name first", variant: "destructive" });
      return;
    }
    setLinkingRowIds((prev) => new Set(prev).add(rowId));
    try {
      const existing = findPossibleDuplicateAccount(accounts, {
        name: companyName,
      });
      let accountId: string;
      let accountName: string;
      if (existing) {
        accountId = existing.id;
        accountName = existing.name;
      } else {
        accountName = companyName;
        accountId = await createCrmAccount({
          name: accountName,
          createdBy: currentUser,
        });
      }
      await set(ref(database, `${PATH}/${rowId}/linkedAccountId`), accountId);
      await set(
        ref(database, `${PATH}/${rowId}/linkedAccountName`),
        accountName,
      );
      await writeCrmAuditLog({
        action: existing
          ? "coldCalling_linked_account"
          : "coldCalling_created_account",
        entityType: "account",
        entityId: accountId,
        companyName: accountName,
        details: existing
          ? `Cold Calling row for "${accountName}" linked to existing Account`
          : `Cold Calling row for "${accountName}" created a new Account`,
        by: currentUser,
        at: Date.now(),
      });
      toast({
        title: existing
          ? "Linked to existing Account"
          : "Account created and linked",
      });
    } catch (err) {
      console.error("Failed to link Cold Calling row to an Account:", err);
      toast({
        title: "Failed to link Account",
        description: err instanceof Error ? err.message : undefined,
        variant: "destructive",
      });
    } finally {
      setLinkingRowIds((prev) => {
        const next = new Set(prev);
        next.delete(rowId);
        return next;
      });
    }
  };

  const handleDispositionRecorded = (rowId: string, tag: CrmStatusTag) => {
    set(ref(database, `${PATH}/${rowId}/dispositionTag`), tag).catch(() => {});
    set(ref(database, `${PATH}/${rowId}/dispositionAt`), Date.now()).catch(
      () => {},
    );
  };

  const editingRow = editingRowId
    ? rows[editingRowId] || emptyRow()
    : emptyRow();
  const viewingRow = viewingRowId
    ? rows[viewingRowId] || emptyRow()
    : emptyRow();

  const formSections: PanelSectionDef<ColdCallingRow>[] = useMemo(() => {
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

  // Status values are free text (never a fixed enum — future outcomes must not require a code
  // change), so the filter dropdown is built from whatever distinct values actually exist.
  const distinctStatuses = useMemo(() => {
    const set = new Set<string>();
    order.forEach((id) => {
      const s = (rows[id]?.status || "").trim();
      if (s) set.add(s);
    });
    return Array.from(set).sort();
  }, [order, rows]);

  const filteredOrder = useMemo(() => {
    const q = search.trim().toLowerCase();
    return order.filter((id) => {
      const row = rows[id] || emptyRow();
      if (statusFilter !== "all" && row.status !== statusFilter) return false;
      if (dateFrom && (!row.date || row.date < dateFrom)) return false;
      if (dateTo && (!row.date || row.date > dateTo)) return false;
      if (q) {
        const hay =
          `${row.companyName} ${row.prospectName} ${row.designation} ${row.status}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [order, rows, search, statusFilter, dateFrom, dateTo]);

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
      "coldCallingStatus",
      "Cold Calling Status",
      summary,
      currentUser,
    );
    return summary;
  };

  const backButton = fromDashboard ? (
    <BackToDashboardButton />
  ) : (
    <Button
      size="sm"
      variant="ghost"
      className="rounded-xl gap-1.5 -ml-2"
      onClick={() => setViewingRowId(null)}
    >
      <ArrowLeft className="h-3.5 w-3.5" /> Back to Cold Calling Status
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
      <ArrowLeft className="h-3.5 w-3.5" /> Back to Cold Calling Status
    </Button>
  );

  if (viewingRowId) {
    return (
      <div className="space-y-6 pb-8">
        {backButton}
        <DetailPageBoxes<ColdCallingRow>
          heading={viewingRow.companyName || "Record Details"}
          subheading="Cold Calling Status — View Only"
          sections={formSections}
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
        <DetailPageBoxes<ColdCallingRow>
          heading={editingRow.companyName || "New Record"}
          subheading="Cold Calling Status"
          sections={formSections}
          values={editingRow}
          onFieldChange={(field, value) =>
            editingRowId && handleChange(editingRowId, field, value)
          }
          onFieldBlur={(field) =>
            editingRowId && handleBlur(editingRowId, field)
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
              Cold Calling Status
            </CardTitle>
            <CardDescription className="text-sm text-slate-500">
              Raw cold-calling outcomes, logged as-is. Link a row to its
              Account, then route it into the existing status queues when ready.
            </CardDescription>
          </div>
          <div className="relative flex items-center gap-2 flex-wrap">
            <ImportExportBar
              moduleLabel="Cold Calling Status"
              fields={IMPORT_EXPORT_FIELDS}
              allRecords={exportRecords}
              fileBaseName="crm-cold-calling-status"
              duplicate={{
                keys: ["companyName", "prospectName", "date"],
                findExisting: (mapped) => {
                  const company = String(mapped.companyName || "")
                    .trim()
                    .toLowerCase();
                  const prospect = String(mapped.prospectName || "")
                    .trim()
                    .toLowerCase();
                  const date = String(mapped.date || "").trim();
                  if (!company) return undefined;
                  const match = order.find((id) => {
                    const r = rows[id];
                    return (
                      r &&
                      r.companyName?.trim().toLowerCase() === company &&
                      (r.prospectName || "").trim().toLowerCase() ===
                        prospect &&
                      (r.date || "").trim() === date
                    );
                  });
                  return match
                    ? { id: match, label: rows[match].companyName || match }
                    : undefined;
                },
              }}
              commitImport={commitImport}
            />
            <Button
              size="sm"
              className="rounded-xl gap-1.5 shrink-0"
              onClick={handleAddRow}
            >
              <Plus className="h-4 w-4" /> Add
            </Button>
          </div>
        </CardHeader>

        <div className="flex flex-wrap items-center gap-2 p-4 border-b border-slate-100 bg-slate-50/40">
          <div className="relative flex-1 min-w-[220px]">
            <SearchIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search company, prospect, designation, status…"
              className="rounded-xl h-9 pl-8 text-sm"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="rounded-xl h-9 w-[220px] text-sm">
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {distinctStatuses.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="rounded-xl h-9 w-[150px] text-sm"
            title="From date"
          />
          <Input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="rounded-xl h-9 w-[150px] text-sm"
            title="To date"
          />
          {(search || statusFilter !== "all" || dateFrom || dateTo) && (
            <Button
              size="sm"
              variant="ghost"
              className="rounded-xl h-9 text-xs"
              onClick={() => {
                setSearch("");
                setStatusFilter("all");
                setDateFrom("");
                setDateTo("");
              }}
            >
              Clear filters
            </Button>
          )}
        </div>

        <CardContent className="p-0">
          {loading ? (
            <div className="text-center py-16 text-slate-400 text-sm">
              Loading Cold Calling Status…
            </div>
          ) : (
            <div className="overflow-x-auto crm-tracker-scroll">
              <Table className="table-fixed w-full min-w-[1280px]">
                <TableHeader
                  style={{
                    background:
                      "linear-gradient(135deg, #4D9F4B 0%, #72B84A 50%, #9FCA48 100%)",
                  }}
                  className="text-white"
                >
                  <TableRow className="hover:bg-transparent border-none">
                    <TableHead className="text-center font-black text-sm uppercase tracking-wider text-white py-2.5 px-3 w-[110px]">
                      Date
                    </TableHead>
                    <TableHead className="text-center font-black text-sm uppercase tracking-wider text-white py-2.5 px-3">
                      Company
                    </TableHead>
                    <TableHead className="text-center font-black text-sm uppercase tracking-wider text-white py-2.5 px-3">
                      Prospect
                    </TableHead>
                    <TableHead className="text-center font-black text-sm uppercase tracking-wider text-white py-2.5 px-3 w-[140px]">
                      Designation
                    </TableHead>
                    <TableHead className="text-center font-black text-sm uppercase tracking-wider text-white py-2.5 px-3">
                      Cold Calling Status
                    </TableHead>
                    <TableHead className="text-center font-black text-sm uppercase tracking-wider text-white py-2.5 px-3 w-[150px]">
                      CRM Disposition
                    </TableHead>
                    {customFieldDefs.map((d) => (
                      <TableHead
                        key={d.key}
                        className="text-center font-black text-sm uppercase tracking-wider text-white py-2.5 px-3"
                      >
                        {d.label}
                      </TableHead>
                    ))}
                    <TableHead className="text-center font-black text-sm uppercase tracking-wider text-white py-2.5 px-3 w-[480px]">
                      Actions
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="[&_tr:last-child]:border-b [&_tr:last-child]:border-brand-200">
                  {filteredOrder.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={7 + customFieldDefs.length}
                        className="text-center py-10 text-slate-400 text-sm"
                      >
                        {order.length === 0
                          ? 'No rows yet. Click "+ Add" to get started.'
                          : "No rows match the current filters."}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredOrder.map((rowId) => {
                      const row = rows[rowId] || emptyRow();
                      const linkedAccount = row.linkedAccountId
                        ? accounts.find((a) => a.id === row.linkedAccountId)
                        : undefined;
                      const openTasksForAccount = linkedAccount
                        ? tasks.filter(
                            (t) =>
                              t.relatedType === "account" &&
                              t.relatedId === linkedAccount.id,
                          )
                        : [];
                      return (
                        <TableRow
                          key={rowId}
                          className="border-b border-brand-200 last:border-b-0 hover:bg-emerald-50/40"
                        >
                          <TableCell className="px-3 py-1 align-middle text-center text-sm text-slate-600">
                            {row.date || "—"}
                          </TableCell>
                          <TableCell className="px-3 py-1 align-middle text-center text-sm font-semibold text-slate-800 truncate">
                            {row.companyName || "—"}
                          </TableCell>
                          <TableCell className="px-3 py-1 align-middle text-center text-sm text-slate-600 truncate">
                            {row.prospectName || "—"}
                          </TableCell>
                          <TableCell className="px-3 py-1 align-middle text-center text-sm text-slate-600 truncate">
                            {row.designation || "—"}
                          </TableCell>
                          <TableCell
                            className="px-3 py-1 align-middle text-center text-sm text-slate-600"
                            title={row.status}
                          >
                            <span className="line-clamp-2">
                              {row.status || "—"}
                            </span>
                          </TableCell>
                          <TableCell className="px-3 py-1 align-middle text-center">
                            {row.dispositionTag ? (
                              <Badge
                                variant="outline"
                                className={`text-xs ${STATUS_TAG_STYLE[row.dispositionTag as CrmStatusTag] || "bg-slate-50 text-slate-600 border-slate-200"}`}
                              >
                                {row.dispositionTag}
                              </Badge>
                            ) : (
                              <span className="text-xs text-slate-400">
                                Not routed
                              </span>
                            )}
                          </TableCell>
                          {customFieldDefs.map((d) => (
                            <TableCell
                              key={d.key}
                              className="px-3 py-1 align-middle text-center text-base text-slate-600 truncate"
                            >
                              {row.customFields?.[d.key] || "—"}
                            </TableCell>
                          ))}
                          <TableCell className="px-3 py-1 align-middle text-center">
                            <div className="flex flex-nowrap items-center justify-center gap-1.5 whitespace-nowrap">
                              <Button
                                size="sm"
                                variant="outline"
                                className="rounded-lg gap-1 h-8 text-xs shrink-0 border-blue-200 text-blue-600 bg-blue-50/50 hover:text-blue-700 hover:border-blue-400 hover:bg-blue-100"
                                onClick={() => setViewingRowId(rowId)}
                              >
                                <Eye className="h-3.5 w-3.5" /> View
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="rounded-lg gap-1 h-8 text-xs shrink-0"
                                onClick={() => setEditingRowId(rowId)}
                              >
                                <Pencil className="h-3.5 w-3.5" /> Edit
                              </Button>
                              {!row.linkedAccountId ? (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="rounded-lg gap-1 h-8 text-xs shrink-0 text-brand-700 border-brand-200 bg-brand-50/50 hover:bg-brand-100"
                                  disabled={linkingRowIds.has(rowId)}
                                  onClick={() => handleLinkAccount(rowId)}
                                >
                                  <Link2 className="h-3.5 w-3.5" />{" "}
                                  {linkingRowIds.has(rowId)
                                    ? "Linking…"
                                    : "Link Account"}
                                </Button>
                              ) : (
                                <>
                                  <Link
                                    to={`/crm/accounts/${row.linkedAccountId}`}
                                    className="inline-flex"
                                  >
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="rounded-lg gap-1 h-8 text-xs shrink-0"
                                    >
                                      <ExternalLink className="h-3.5 w-3.5" />{" "}
                                      {linkedAccount?.name ||
                                        row.linkedAccountName ||
                                        "Account"}
                                    </Button>
                                  </Link>
                                  {linkedAccount && (
                                    <StatusTagDialog
                                      account={linkedAccount}
                                      currentUser={currentUser}
                                      openTasks={openTasksForAccount}
                                      onChanged={(tag) =>
                                        handleDispositionRecorded(rowId, tag)
                                      }
                                      trigger={
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          className="rounded-lg gap-1 h-8 text-xs shrink-0"
                                        >
                                          Route Status
                                        </Button>
                                      }
                                    />
                                  )}
                                </>
                              )}
                              {isCrmAdmin(user) && (
                                <DeleteConfirmDialog
                                  trigger={
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="rounded-lg gap-1 h-8 text-xs shrink-0 border-red-200 text-red-600 bg-red-50/50 hover:text-red-700 hover:border-red-400 hover:bg-red-100"
                                    >
                                      <Trash2 className="h-3.5 w-3.5" /> Delete
                                    </Button>
                                  }
                                  title="Delete this record?"
                                  description={`"${row.companyName || "This record"}" will be moved to the CRM Recycle Bin.`}
                                  onConfirm={() => handleDeleteRow(rowId)}
                                />
                              )}
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
