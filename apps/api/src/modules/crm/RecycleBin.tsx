// CRM Core Domain — Recycle Bin. Admin-only tab listing every CRM record (Accounts, Leads,
// Contacts, Opportunities, Products, Quotations, Meetings, Follow-ups, Activities, Tasks,
// Documents, Notes, Pipeline Stages, Quotas, Account Mining rows, Deal Products) currently
// deleted-but-recoverable in `crm/recycleBin`. Restore puts a record back exactly where it was
// (including any related records for a cascade delete); Permanently Delete removes it for good.
// Both actions — and this whole page — are Admin-only, matching every other CRM delete surface.
import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import {
  Trash2,
  RotateCcw,
  Inbox,
  ShieldAlert,
  Eye,
  ArrowLeft,
  FileText,
  CalendarClock,
  type LucideIcon,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { useAuth } from "@/context/AuthContext";
import { toast } from "@/hooks/use-toast";
import { isCrmAdmin } from "./domain/roles";
import {
  CrmRecycleBinEntry,
  permanentlyDeleteCrmRecycleBinEntry,
  restoreCrmRecycleBinEntry,
  subscribeCrmRecycleBin,
} from "./domain/recycleBinService";
import { DeleteConfirmDialog, EmptyState } from "./intelligence/components";
import { BackToDashboardButton } from "./components/BackToDashboardButton";

/** Turns a camelCase field name into a readable label, e.g. `unitPrice` -> `Unit Price`. */
function fieldLabel(key: string): string {
  return key
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/^./, (c) => c.toUpperCase());
}

/** Renders one field value from a deleted record's snapshot for the View dialog — primitives
 *  as plain text, arrays/objects as compact JSON since their shape varies by entity type. */
function fieldValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

const ENTITY_LABEL: Record<string, string> = {
  account: "Account",
  lead: "Lead",
  contact: "Contact",
  opportunity: "Deal",
  product: "Product",
  quotation: "Quotation",
  meeting: "Meeting",
  followup: "Follow-up",
  activity: "Activity",
  task: "Task",
  document: "Document",
  note: "Note",
  pipelineStage: "Pipeline Stage",
  quota: "Quota",
  dealProduct: "Deal Product",
  accountsMiningSheet: "Account Mining Row",
};

function entityLabel(entityType: string): string {
  return ENTITY_LABEL[entityType] || entityType;
}

export default function RecycleBin() {
  const { user } = useAuth();
  const location = useLocation();
  const fromDashboard = (
    location.state as { fromCrmDashboard?: boolean } | null
  )?.fromCrmDashboard;
  const admin = isCrmAdmin(user);
  const [entries, setEntries] = useState<CrmRecycleBinEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [viewingEntry, setViewingEntry] = useState<CrmRecycleBinEntry | null>(
    null,
  );

  useEffect(() => {
    if (!admin) return undefined;
    setLoading(true);
    const unsub = subscribeCrmRecycleBin((items) => {
      setEntries(items);
      setLoading(false);
    });
    return unsub;
  }, [admin]);

  if (!admin) {
    return (
      <div className="crm-panel-frame rounded-3xl bg-white p-10 text-center">
        <ShieldAlert className="h-10 w-10 mx-auto mb-3 text-slate-300" />
        <p className="text-sm font-semibold text-slate-700">
          Admin access required
        </p>
        <p className="text-sm text-slate-400 mt-1">
          The CRM Recycle Bin is only available to CRM Admins.
        </p>
      </div>
    );
  }

  const handleRestore = async (entry: CrmRecycleBinEntry) => {
    setRestoringId(entry.id);
    try {
      await restoreCrmRecycleBinEntry(entry.id, user);
      toast({
        title: `${entityLabel(entry.entityType)} restored`,
        description: entry.label,
      });
    } catch (err) {
      console.error("Failed to restore record:", err);
      toast({
        title: "Failed to restore record",
        description: err instanceof Error ? err.message : undefined,
        variant: "destructive",
      });
    } finally {
      setRestoringId(null);
    }
  };

  const handlePermanentDelete = async (entry: CrmRecycleBinEntry) => {
    await permanentlyDeleteCrmRecycleBinEntry(entry.id, user);
    toast({
      title: `${entityLabel(entry.entityType)} permanently deleted`,
      description: entry.label,
    });
  };

  if (viewingEntry) {
    const entry = viewingEntry;
    const dataFields = Object.entries(
      (entry.data as Record<string, unknown>) || {},
    );
    return (
      <div className="space-y-6 pb-8">
        {fromDashboard ? (
          <BackToDashboardButton />
        ) : (
          <Button
            size="sm"
            variant="ghost"
            className="rounded-xl gap-1.5 -ml-2"
            onClick={() => setViewingEntry(null)}
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back to Recycle Bin
          </Button>
        )}

        <div className="relative overflow-hidden rounded-3xl border border-slate-200/80 shadow-xl p-6 space-y-1 bg-gradient-to-br from-white via-brand-100/70 to-blue-100/50">
          <span
            aria-hidden
            className="pointer-events-none absolute -left-16 -top-20 h-48 w-48 rounded-full bg-brand-300/40 blur-3xl"
          />
          <span
            aria-hidden
            className="pointer-events-none absolute right-10 -bottom-20 h-48 w-48 rounded-full bg-blue-300/35 blur-3xl"
          />
          <div className="relative flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <span className="p-2.5 bg-brand-50 text-brand-600 rounded-2xl border border-brand-200">
                <Trash2 className="h-5 w-5" />
              </span>
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  {entry.label}
                </h2>
                <p className="text-sm text-slate-600">
                  Deleted record — restore it or permanently delete it below.
                </p>
              </div>
            </div>
            <Badge variant="outline" className="text-sm px-3 py-1">
              {entityLabel(entry.entityType)}
            </Badge>
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200/80 bg-white shadow-xl p-6 space-y-4">
          <div className="flex items-center gap-2.5">
            <span className="p-2 bg-brand-50 text-brand-600 rounded-xl border border-brand-200">
              <CalendarClock className="h-4 w-4" />
            </span>
            <h3 className="text-base font-bold text-slate-900">
              Deletion Info
            </h3>
          </div>
          <div className="grid md:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <p className="text-sm font-bold text-black">Entity Type</p>
              <p className="min-h-9 rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-sm text-slate-800">
                {entityLabel(entry.entityType)}
              </p>
            </div>
            <div className="space-y-1.5">
              <p className="text-sm font-bold text-black">Deleted At</p>
              <p className="min-h-9 rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-sm text-slate-800">
                {new Date(entry.deletedAt).toLocaleString("en-IN", {
                  day: "2-digit",
                  month: "short",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
            </div>
            <div className="space-y-1.5">
              <p className="text-sm font-bold text-black">Deleted By</p>
              <p className="min-h-9 rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-sm text-slate-800">
                {entry.deletedBy}
              </p>
            </div>
            {entry.related && (
              <div className="space-y-1.5 md:col-span-3">
                <p className="text-sm font-bold text-black">Related Records</p>
                <p className="min-h-9 rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-sm text-slate-800">
                  {entry.related.length} related record
                  {entry.related.length === 1 ? "" : "s"} will also be restored
                  together
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200/80 bg-white shadow-xl p-6 space-y-4">
          <div className="flex items-center gap-2.5">
            <span className="p-2 bg-brand-50 text-brand-600 rounded-xl border border-brand-200">
              <FileText className="h-4 w-4" />
            </span>
            <h3 className="text-base font-bold text-slate-900">
              Record Details
            </h3>
          </div>
          <div className="grid md:grid-cols-3 gap-3">
            {dataFields.length === 0 ? (
              <p className="text-sm text-slate-400 md:col-span-3">
                No additional fields on this record.
              </p>
            ) : (
              dataFields.map(([key, value]) => (
                <div key={key} className="space-y-1.5">
                  <p className="text-sm font-bold text-black">
                    {fieldLabel(key)}
                  </p>
                  <p className="min-h-9 rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-sm text-slate-800 whitespace-pre-wrap break-words">
                    {fieldValue(value)}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200/80 bg-white shadow-xl p-4 flex items-center justify-between flex-wrap gap-3">
          <div className="text-sm text-slate-600">
            Restore puts this record back exactly where it was.
          </div>
          <div className="flex justify-end gap-2 flex-wrap">
            <Button
              variant="outline"
              className="rounded-xl gap-1.5"
              disabled={restoringId === entry.id}
              onClick={() => {
                handleRestore(entry);
                setViewingEntry(null);
              }}
            >
              <RotateCcw className="h-3.5 w-3.5" />{" "}
              {restoringId === entry.id ? "Restoring…" : "Restore"}
            </Button>
            <DeleteConfirmDialog
              trigger={
                <Button
                  className="rounded-xl gap-1.5 text-red-700 border border-red-200 bg-red-50/50 hover:text-red-800 hover:border-red-400 hover:bg-red-100"
                  variant="outline"
                >
                  <Trash2 className="h-3.5 w-3.5" /> Delete Permanently
                </Button>
              }
              title={`Permanently delete "${entry.label}"?`}
              description="This record will be permanently removed and can never be restored."
              confirmLabel="Delete Permanently"
              onConfirm={async () => {
                await handlePermanentDelete(entry);
                setViewingEntry(null);
              }}
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <BackToDashboardButton />
      <Card className="crm-panel-frame rounded-3xl overflow-hidden bg-white">
        <CardHeader className="crm-panel-header relative overflow-hidden p-5 border-b border-brand-200/50 bg-gradient-to-br from-white via-brand-100/70 to-blue-100/50">
          <span
            aria-hidden
            className="pointer-events-none absolute -left-16 -top-20 h-48 w-48 rounded-full bg-brand-300/40 blur-3xl"
          />
          <span
            aria-hidden
            className="pointer-events-none absolute right-10 -bottom-20 h-48 w-48 rounded-full bg-blue-300/35 blur-3xl"
          />
          <div className="relative">
            <CardTitle className="text-lg font-extrabold text-slate-900 flex items-center gap-2">
              <Trash2 className="h-4 w-4 text-brand-600" /> CRM Recycle Bin
            </CardTitle>
            <CardDescription className="text-sm text-slate-500">
              Deleted CRM records land here first — restore them or permanently
              delete them for good. Admin-only.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="text-center py-16 text-slate-400 text-xs">
              Loading Recycle Bin…
            </div>
          ) : entries.length === 0 ? (
            <EmptyState
              icon={Inbox as LucideIcon}
              title="Recycle Bin is empty"
              description="Deleted CRM records will show up here, ready to restore or permanently delete."
            />
          ) : (
            <div className="overflow-x-auto crm-tracker-scroll">
              <Table>
                <TableHeader
                  style={{
                    background:
                      "linear-gradient(90deg, #4D9F4B 0%, #72B84A 50%, #9FCA48 100%)",
                  }}
                >
                  <TableRow className="hover:bg-transparent border-b-0">
                    <TableHead className="font-black text-sm uppercase tracking-wider text-white py-2.5">
                      Type
                    </TableHead>
                    <TableHead className="font-black text-sm uppercase tracking-wider text-white py-2.5">
                      Record
                    </TableHead>
                    <TableHead className="font-black text-sm uppercase tracking-wider text-white py-2.5">
                      Deleted
                    </TableHead>
                    <TableHead className="font-black text-sm uppercase tracking-wider text-white py-2.5">
                      Deleted By
                    </TableHead>
                    <TableHead className="font-black text-sm uppercase tracking-wider text-white text-center w-[340px] whitespace-nowrap py-2.5">
                      Action
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="[&_tr:last-child]:border-b [&_tr:last-child]:border-brand-200">
                  {entries.map((entry) => (
                    <TableRow
                      key={entry.id}
                      className="border-b border-brand-200 last:border-b-0"
                    >
                      <TableCell className="py-1">
                        <Badge variant="outline" className="text-xs">
                          {entityLabel(entry.entityType)}
                        </Badge>
                      </TableCell>
                      <TableCell className="py-1 text-base font-semibold text-slate-800">
                        {entry.label}
                        {entry.related && (
                          <p className="text-sm text-slate-400 font-normal">
                            +{entry.related.length} related record
                            {entry.related.length === 1 ? "" : "s"}
                          </p>
                        )}
                      </TableCell>
                      <TableCell className="py-1 text-base text-slate-600">
                        {new Date(entry.deletedAt).toLocaleString("en-IN", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </TableCell>
                      <TableCell className="py-1 text-base text-slate-600">
                        {entry.deletedBy}
                      </TableCell>
                      <TableCell className="py-1">
                        <div className="flex items-center justify-center gap-1.5">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 px-2 gap-1 text-xs font-semibold text-blue-600 border-blue-200 bg-blue-50/50 hover:text-blue-700 hover:border-blue-400 hover:bg-blue-100 rounded-lg"
                            title="View record"
                            onClick={() => setViewingEntry(entry)}
                          >
                            <Eye className="h-3.5 w-3.5" /> View
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 px-2 gap-1 text-xs font-semibold rounded-lg"
                            disabled={restoringId === entry.id}
                            onClick={() => handleRestore(entry)}
                          >
                            <RotateCcw className="h-3.5 w-3.5" />{" "}
                            {restoringId === entry.id
                              ? "Restoring…"
                              : "Restore"}
                          </Button>
                          <DeleteConfirmDialog
                            trigger={
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-8 px-2 gap-1 text-xs font-semibold text-red-700 border-red-200 bg-red-50/50 hover:text-red-800 hover:border-red-400 hover:bg-red-100 rounded-lg"
                              >
                                <Trash2 className="h-3.5 w-3.5" /> Delete
                                Permanently
                              </Button>
                            }
                            title={`Permanently delete "${entry.label}"?`}
                            description="This record will be permanently removed and can never be restored."
                            confirmLabel="Delete Permanently"
                            onConfirm={() => handlePermanentDelete(entry)}
                          />
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
