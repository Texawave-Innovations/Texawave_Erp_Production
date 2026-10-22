"use client";

import type {
  CrmRecycleBinEntityType,
  CrmRecycleBinItem,
} from "@texawave-erp/api-types";
import { ApiError } from "@texawave-erp/core";
import { Badge } from "@/components/legacy-ui/badge";
import { Button } from "@/components/legacy-ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/legacy-ui/card";
import { Input } from "@/components/legacy-ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/legacy-ui/table";
import { BackToDashboardButton } from "@/features/crm/legacy-ui/BackToDashboardButton";
import {
  DeleteConfirmDialog,
  EmptyState,
} from "@/features/crm/legacy-ui/CrmCommon";
import { PaginationFooter } from "@/features/crm/legacy-ui/Pagination";
import { usePermission } from "@/hooks/usePermission";
import {
  ArrowLeft,
  CalendarClock,
  Eye,
  FileText,
  Inbox,
  RotateCcw,
  Search,
  ShieldAlert,
  Trash2,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import {
  usePurgeRecycleBinItem,
  useRecycleBin,
  useRecycleBinSummary,
  useRestoreRecycleBinItem,
} from "../hooks";

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.message : fallback;
}

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

const HEAD = "font-black text-sm uppercase tracking-wider text-white py-2.5";

/** Legacy `RecycleBin.tsx`: every soft-deleted CRM record, restorable (an
 * Account restore brings its cascade back) and permanently deletable behind
 * an explicit confirmation. Viewing needs `crm.recyclebin.read`;
 * restore/permanent delete need `crm.recyclebin.write` (admin only). The API
 * returns a summary (type / name / details / deleted-at), not the full
 * deleted-record snapshot, so the View screen shows that summary. */
export function RecycleBinPage() {
  const canWrite = usePermission("crm.recyclebin.write");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [search, setSearch] = useState("");
  const [entityType, setEntityType] = useState<
    CrmRecycleBinEntityType | undefined
  >(undefined);
  const [viewing, setViewing] = useState<CrmRecycleBinItem | null>(null);
  const [restoringKey, setRestoringKey] = useState<string | null>(null);

  const summary = useRecycleBinSummary();
  const query = useRecycleBin({
    page,
    limit: pageSize,
    entityType,
    search: search || undefined,
  });
  const restore = useRestoreRecycleBinItem();
  const purge = usePurgeRecycleBinItem();

  const keyOf = (i: CrmRecycleBinItem) => `${i.entityType}-${i.id}`;

  async function handleRestore(item: CrmRecycleBinItem) {
    setRestoringKey(keyOf(item));
    try {
      await restore.mutateAsync({ entityType: item.entityType, id: item.id });
      toast.success(`${item.entityTypeLabel} restored`, {
        description: item.label,
      });
    } catch (error) {
      toast.error("Failed to restore record", {
        description: errorMessage(error, `Could not restore "${item.label}"`),
      });
    } finally {
      setRestoringKey(null);
    }
  }

  async function handlePurge(item: CrmRecycleBinItem) {
    try {
      await purge.mutateAsync({ entityType: item.entityType, id: item.id });
    } catch (error) {
      throw new Error(errorMessage(error, `Could not delete "${item.label}"`));
    }
    toast.success(`${item.entityTypeLabel} permanently deleted`, {
      description: item.label,
    });
  }

  const types = (summary.data?.types ?? []).filter((t) => t.count > 0);
  const rows = query.data?.data ?? [];
  const meta = query.data?.meta;

  if (
    query.isError &&
    query.error instanceof ApiError &&
    query.error.isPermissionError
  ) {
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

  if (viewing) {
    const entry = viewing;
    const busy = restoringKey === keyOf(entry);
    return (
      <div className="space-y-6 pb-8">
        <div className="flex items-center gap-2 flex-wrap">
          <BackToDashboardButton />
          <Button
            size="sm"
            variant="ghost"
            className="rounded-xl gap-1.5 -ml-2"
            onClick={() => setViewing(null)}
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back to Recycle Bin
          </Button>
        </div>

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
              {entry.entityTypeLabel}
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
            {[
              ["Entity Type", entry.entityTypeLabel],
              ["Deleted At", fmtDate(entry.deletedAt)],
              ...(entry.deletedBy !== null
                ? [
                    [
                      "Deleted By",
                      entry.deletedByName ?? `User #${entry.deletedBy}`,
                    ],
                  ]
                : []),
              ...(entry.relatedCount
                ? [
                    [
                      "Related Records",
                      `${entry.relatedCount} related record${entry.relatedCount === 1 ? "" : "s"} will also be restored together`,
                    ],
                  ]
                : []),
            ].map(([label, value]) => (
              <div key={label} className="space-y-1.5">
                <p className="text-sm font-bold text-black">{label}</p>
                <p className="min-h-9 rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-sm text-slate-800">
                  {value}
                </p>
              </div>
            ))}
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
            <div className="space-y-1.5">
              <p className="text-sm font-bold text-black">Name</p>
              <p className="min-h-9 rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-sm text-slate-800 whitespace-pre-wrap break-words">
                {entry.label}
              </p>
            </div>
            <div className="space-y-1.5">
              <p className="text-sm font-bold text-black">Details</p>
              <p className="min-h-9 rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-sm text-slate-800 whitespace-pre-wrap break-words">
                {entry.subtitle || "—"}
              </p>
            </div>
            {Object.entries(entry.data ?? {}).map(([key, value]) => (
              <div key={key} className="space-y-1.5">
                <p className="text-sm font-bold text-black">
                  {key
                    .replace(/([a-z])([A-Z])/g, "$1 $2")
                    .replace(/^./, (c) => c.toUpperCase())}
                </p>
                <p className="min-h-9 rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-sm text-slate-800 whitespace-pre-wrap break-words">
                  {value === null || value === undefined || value === ""
                    ? "—"
                    : typeof value === "object"
                      ? JSON.stringify(value)
                      : String(value)}
                </p>
              </div>
            ))}
          </div>
        </div>

        {canWrite && (
          <div className="rounded-3xl border border-slate-200/80 bg-white shadow-xl p-4 flex items-center justify-between flex-wrap gap-3">
            <div className="text-sm text-slate-600">
              Restore puts this record back exactly where it was.
            </div>
            <div className="flex justify-end gap-2 flex-wrap">
              <Button
                variant="outline"
                className="rounded-xl gap-1.5"
                disabled={busy}
                onClick={() => {
                  void handleRestore(entry);
                  setViewing(null);
                }}
              >
                <RotateCcw className="h-3.5 w-3.5" />{" "}
                {busy ? "Restoring…" : "Restore"}
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
                  await handlePurge(entry);
                  setViewing(null);
                }}
              />
            </div>
          </div>
        )}
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
          <div className="relative flex items-start justify-between gap-4 flex-wrap">
            <div>
              <CardTitle className="text-lg font-extrabold text-slate-900 flex items-center gap-2">
                <Trash2 className="h-4 w-4 text-brand-600" /> CRM Recycle Bin
              </CardTitle>
              <CardDescription className="text-sm text-slate-500">
                Deleted CRM records land here first — restore them or
                permanently delete them for good. Admin-only.
              </CardDescription>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
              <Input
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                placeholder="Search deleted records…"
                className="pl-8 h-9 rounded-xl w-56 border-brand-300 shadow-[0_0_0_3px_rgba(77,159,75,0.12)] focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-brand-400 focus-visible:shadow-[0_0_0_3px_rgba(77,159,75,0.18)] transition-shadow"
              />
            </div>
          </div>
          <div className="relative flex flex-wrap items-center gap-2 pt-3">
            <Button
              size="sm"
              variant={entityType === undefined ? "default" : "outline"}
              className="rounded-xl h-8 text-xs"
              onClick={() => {
                setEntityType(undefined);
                setPage(1);
              }}
            >
              All ({summary.data?.total ?? 0})
            </Button>
            {types.map((t) => (
              <Button
                key={t.entityType}
                size="sm"
                variant={entityType === t.entityType ? "default" : "outline"}
                className="rounded-xl h-8 text-xs"
                onClick={() => {
                  setEntityType(t.entityType);
                  setPage(1);
                }}
              >
                {t.entityTypeLabel} ({t.count})
              </Button>
            ))}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {query.isPending ? (
            <div className="text-center py-16 text-slate-400 text-xs">
              Loading Recycle Bin…
            </div>
          ) : query.isError ? (
            <div className="text-center py-16 text-xs text-red-500">
              Could not load the Recycle Bin.{" "}
              <button
                type="button"
                className="underline"
                onClick={() => void query.refetch()}
              >
                Retry
              </button>
            </div>
          ) : rows.length === 0 ? (
            <EmptyState
              icon={Inbox}
              title="Recycle Bin is empty"
              description="Deleted CRM records will show up here, ready to restore or permanently delete."
            />
          ) : (
            <div className="overflow-x-auto crm-tracker-scroll">
              <Table>
                <TableHeader
                  style={{
                    background:
                      "linear-gradient(90deg, #2454e8 0%, #1769f5 50%, #12cfe3 100%)",
                  }}
                >
                  <TableRow className="hover:bg-transparent border-b-0">
                    <TableHead className={HEAD}>Type</TableHead>
                    <TableHead className={HEAD}>Record</TableHead>
                    <TableHead className={HEAD}>Deleted</TableHead>
                    <TableHead
                      className={`${HEAD} text-center w-[340px] whitespace-nowrap`}
                    >
                      Action
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="[&_tr:last-child]:border-b [&_tr:last-child]:border-brand-200">
                  {rows.map((entry) => {
                    const busy = restoringKey === keyOf(entry);
                    return (
                      <TableRow
                        key={keyOf(entry)}
                        className="border-b border-brand-200 last:border-b-0"
                      >
                        <TableCell className="py-1">
                          <Badge variant="outline" className="text-xs">
                            {entry.entityTypeLabel}
                          </Badge>
                        </TableCell>
                        <TableCell className="py-1 text-base font-semibold text-slate-800">
                          {entry.label}
                          {entry.subtitle && (
                            <p className="text-sm text-slate-400 font-normal">
                              {entry.subtitle}
                            </p>
                          )}
                          {entry.relatedCount ? (
                            <p className="text-sm text-slate-400 font-normal">
                              +{entry.relatedCount} related record
                              {entry.relatedCount === 1 ? "" : "s"}
                            </p>
                          ) : null}
                        </TableCell>
                        <TableCell className="py-1 text-base text-slate-600">
                          {fmtDate(entry.deletedAt)}
                        </TableCell>
                        <TableCell className="py-1">
                          <div className="flex items-center justify-center gap-1.5">
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 px-2 gap-1 text-xs font-semibold text-blue-600 border-blue-200 bg-blue-50/50 hover:text-blue-700 hover:border-blue-400 hover:bg-blue-100 rounded-lg"
                              title="View record"
                              onClick={() => setViewing(entry)}
                            >
                              <Eye className="h-3.5 w-3.5" /> View
                            </Button>
                            {canWrite && (
                              <>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-8 px-2 gap-1 text-xs font-semibold rounded-lg"
                                  disabled={busy}
                                  onClick={() => void handleRestore(entry)}
                                >
                                  <RotateCcw className="h-3.5 w-3.5" />{" "}
                                  {busy ? "Restoring…" : "Restore"}
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
                                  onConfirm={() => handlePurge(entry)}
                                />
                              </>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
          <PaginationFooter
            page={meta?.page ?? page}
            setPage={setPage}
            pageSize={pageSize}
            setPageSize={(n) => {
              setPageSize(n);
              setPage(1);
            }}
            totalPages={meta?.totalPages ?? 1}
            total={meta?.total ?? 0}
          />
        </CardContent>
      </Card>
    </div>
  );
}
