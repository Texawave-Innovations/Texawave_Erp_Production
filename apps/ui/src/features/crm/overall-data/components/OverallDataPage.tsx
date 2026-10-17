"use client";

// Port of legacy `OverallData.tsx` (design, layout and feature set). Live daily activity tracker:
// 9 fixed disposition rows x each day of the month, click a count to see the real records behind
// it. Counts come from the server's derivation, so the grid and drill-down always agree.
import type {
  CrmOverallActivityRecord,
  CrmOverallRowKey,
} from "@texawave-erp/api-types";
import { ApiError } from "@texawave-erp/core";
import {
  CalendarCheck,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Eye,
  FileDown,
  ListChecks,
  Mail,
  PhoneCall,
  Search,
  Trash2,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
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
import { cn } from "@/components/legacy-ui/utils";
import { useDeleteActivity } from "@/features/crm/activities/hooks";
import { useDeleteColdCallingEntry } from "@/features/crm/cold-calling/hooks";
import { BackToDashboardButton } from "@/features/crm/legacy-ui/BackToDashboardButton";
import {
  DeleteConfirmDialog,
  EmptyState,
} from "@/features/crm/legacy-ui/CrmCommon";
import { useDeleteMeeting } from "@/features/crm/meetings/hooks";
import { useDeleteMiningRow } from "@/features/crm/mining-rows/hooks";
import { usePermission } from "@/hooks/usePermission";
import { downloadOverallDataWorkbook } from "../export-workbook";
import {
  useInvalidateOverallData,
  useOverallDataMonth,
  useOverallDataRecords,
} from "../hooks";

type DetailKey = keyof CrmOverallActivityRecord;

/** Extra drill-down columns per disposition (legacy ROW_DETAIL_COLUMNS) —
 * Time + Account + Owner are always shown. */
const ROW_DETAIL_COLUMNS: Record<
  CrmOverallRowKey,
  { key: DetailKey; label: string }[]
> = {
  accountsMined: [
    { key: "contactName", label: "Contact Found" },
    { key: "status", label: "Mining Status" },
    { key: "source", label: "Source" },
    { key: "notes", label: "Notes" },
  ],
  emailsSent: [
    { key: "contactName", label: "Contact" },
    { key: "action", label: "Subject" },
    { key: "status", label: "Status" },
    { key: "notes", label: "Notes" },
  ],
  meetingsScheduled: [
    { key: "contactName", label: "Contact" },
    { key: "dueDate", label: "Meeting Date/Time" },
    { key: "status", label: "Status" },
    { key: "notes", label: "Notes" },
  ],
  meetingsCompleted: [
    { key: "contactName", label: "Contact" },
    { key: "dueDate", label: "Meeting Date/Time" },
    { key: "completedDate", label: "Completed" },
    { key: "notes", label: "Outcome" },
  ],
  meetingsCancelled: [
    { key: "contactName", label: "Contact" },
    { key: "dueDate", label: "Meeting Date/Time" },
    { key: "completedDate", label: "Cancelled" },
    { key: "notes", label: "Reason" },
  ],
  sendInfoCallBacks: [
    { key: "action", label: "Action" },
    { key: "dueDate", label: "Due" },
    { key: "status", label: "Status" },
    { key: "notes", label: "Notes" },
  ],
  followUp: [
    { key: "action", label: "Follow-up Type" },
    { key: "dueDate", label: "Due" },
    { key: "status", label: "Status" },
    { key: "notes", label: "Notes" },
  ],
  notInterested: [
    { key: "contactName", label: "Contact" },
    { key: "notes", label: "Reason" },
  ],
  callsMade: [
    { key: "contactName", label: "Contact" },
    { key: "action", label: "Outcome" },
    { key: "notes", label: "Notes" },
  ],
};

/** Weekly/Monthly Report cards (legacy SUMMARY_ROWS). */
const SUMMARY_ROWS: {
  label: string;
  key: CrmOverallRowKey;
  icon: LucideIcon;
  accent: string;
}[] = [
  {
    label: "Total Number of Accounts Mined",
    key: "accountsMined",
    icon: Users,
    accent: "from-brand-400 to-brand-600",
  },
  {
    label: "Total Number of e-mails",
    key: "emailsSent",
    icon: Mail,
    accent: "from-sky-400 to-sky-600",
  },
  {
    label: "Total Number of Meetings Scheduled",
    key: "meetingsScheduled",
    icon: CalendarCheck,
    accent: "from-violet-400 to-violet-600",
  },
  {
    label: "Completed Meetings",
    key: "meetingsCompleted",
    icon: CheckCircle2,
    accent: "from-amber-400 to-amber-600",
  },
  {
    label: "Total Number of Calls made",
    key: "callsMade",
    icon: PhoneCall,
    accent: "from-rose-400 to-rose-600",
  },
];

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function formatDay(day: string): string {
  const [y, m, d] = day.split("-").map(Number) as [number, number, number];
  return `${String(d).padStart(2, "0")} ${MONTH_NAMES[m - 1]?.slice(0, 3)} ${y}`;
}

const GREEN_HEADER_STYLE = {
  background: "linear-gradient(90deg, #2454e8 0%, #1769f5 50%, #12cfe3 100%)",
};

export function OverallDataPage() {
  const router = useRouter();
  const today = new Date();
  const [ym, setYm] = useState({
    year: today.getFullYear(),
    month: today.getMonth() + 1,
  });
  const [drill, setDrill] = useState<{
    row: CrmOverallRowKey;
    label: string;
    day: string;
  } | null>(null);
  const [filter, setFilter] = useState("");
  const [exporting, setExporting] = useState(false);
  const drillRef = useRef<HTMLDivElement>(null);
  const canExport = usePermission("crm.export.read");

  const grid = useOverallDataMonth(ym);
  const records = useOverallDataRecords(
    drill ? { ...ym, row: drill.row, day: drill.day } : null,
  );
  const invalidate = useInvalidateOverallData();

  useEffect(() => {
    if (drill)
      drillRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [drill]);

  const canDeleteMining = usePermission("crm.miningrow.delete");
  const canDeleteCold = usePermission("crm.coldcalling.delete");
  const canDeleteActivity = usePermission("crm.activity.delete");
  const canDeleteMeeting = usePermission("crm.meeting.delete");
  const deleteMining = useDeleteMiningRow();
  const deleteCold = useDeleteColdCallingEntry();
  const deleteActivity = useDeleteActivity();
  const deleteMeeting = useDeleteMeeting();

  const canDelete = (r: CrmOverallActivityRecord): boolean => {
    switch (r.recordType) {
      case "mining_row":
        return canDeleteMining;
      case "cold_calling_entry":
        return canDeleteCold;
      case "activity":
        return canDeleteActivity;
      case "meeting":
        return canDeleteMeeting;
      default:
        return false; // audit-derived rows are never deletable (legacy)
    }
  };

  // Deletes the real underlying CRM record a drill-down row represents, through its owning
  // entity's own delete endpoint (same permission rules as every other CRM tab).
  async function deleteRecord(r: CrmOverallActivityRecord) {
    switch (r.recordType) {
      case "mining_row":
        await deleteMining.mutateAsync(r.recordId);
        break;
      case "cold_calling_entry":
        await deleteCold.mutateAsync(r.recordId);
        break;
      case "activity":
        await deleteActivity.mutateAsync(r.recordId);
        break;
      case "meeting":
        await deleteMeeting.mutateAsync(r.recordId);
        break;
      default:
        return;
    }
    invalidate();
    toast.success("Record deleted");
  }

  async function exportWorkbook() {
    if (!grid.data) return;
    setExporting(true);
    try {
      await downloadOverallDataWorkbook(grid.data);
    } catch {
      toast.error("Failed to export — please try again.");
    } finally {
      setExporting(false);
    }
  }

  const shift = (delta: number) => {
    setDrill(null);
    setFilter("");
    setYm(({ year, month }) => {
      const idx = year * 12 + (month - 1) + delta;
      return { year: Math.floor(idx / 12), month: (idx % 12) + 1 };
    });
  };

  const shown = useMemo(() => {
    const list = records.data ?? [];
    const q = filter.trim().toLowerCase();
    if (!q) return list;
    return list.filter((r) =>
      [r.owner, r.accountName, r.contactName, r.action, r.status]
        .filter(Boolean)
        .some((f) => (f as string).toLowerCase().includes(q)),
    );
  }, [records.data, filter]);

  const monthLabel = `${MONTH_NAMES[ym.month - 1]} ${ym.year}`;
  const columns = drill ? ROW_DETAIL_COLUMNS[drill.row] : [];
  const recordCount = records.data?.length ?? 0;

  return (
    <div className="space-y-6">
      <BackToDashboardButton />

      {/* Month Navigator */}
      <Card className="crm-panel-frame relative rounded-3xl overflow-hidden bg-gradient-to-br from-white via-brand-100/70 to-blue-100/50">
        <span
          aria-hidden
          className="pointer-events-none absolute -left-10 -top-16 h-40 w-40 rounded-full bg-brand-300/25 blur-3xl"
        />
        <span
          aria-hidden
          className="pointer-events-none absolute -right-10 -bottom-16 h-40 w-40 rounded-full bg-blue-300/20 blur-3xl"
        />
        <CardContent className="relative p-4 flex items-center justify-between gap-4">
          <Button
            size="icon"
            className="rounded-xl h-9 w-9 shrink-0 border border-brand-200 bg-brand-50 text-brand-700 hover:bg-brand-100 shadow-none"
            onClick={() => shift(-1)}
            title="Previous month"
            aria-label="Previous month"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="text-center">
            <p className="text-lg font-bold text-slate-900 tracking-tight">
              {monthLabel}
            </p>
            <p className="text-sm text-slate-400">Daily disposition tracking</p>
          </div>
          <Button
            size="icon"
            className="rounded-xl h-9 w-9 shrink-0 border border-brand-200 bg-brand-50 text-brand-700 hover:bg-brand-100 shadow-none"
            onClick={() => shift(1)}
            title="Next month"
            aria-label="Next month"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </CardContent>
      </Card>

      {/* Main Daily Tracking Table */}
      <Card className="crm-panel-frame rounded-3xl overflow-hidden bg-white">
        <CardHeader className="crm-panel-header p-5 border-b border-brand-100 bg-gradient-to-br from-white via-brand-50/60 to-blue-50/30 flex flex-row items-center justify-between gap-4 flex-wrap">
          <div>
            <CardTitle className="text-lg font-extrabold text-slate-900">
              Daily Activity Tracker
            </CardTitle>
            <CardDescription className="text-sm text-slate-500">
              Live counts computed from CRM activity for each disposition —
              click a number to see the actual records. Scroll horizontally to
              see all dates.
            </CardDescription>
          </div>
          {canExport && (
            <Button
              size="sm"
              variant="outline"
              className="rounded-xl gap-1.5 h-9 shrink-0"
              disabled={exporting || !grid.data}
              onClick={() => {
                void exportWorkbook();
              }}
            >
              <FileDown className="h-3.5 w-3.5" />{" "}
              {exporting ? "Exporting…" : "Export Excel"}
            </Button>
          )}
        </CardHeader>
        <CardContent className="p-0">
          {grid.isPending ? (
            <div className="text-center py-16 text-slate-400 text-sm">
              Loading CRM data…
            </div>
          ) : grid.isError ? (
            <div className="text-center py-16 text-slate-400 text-sm">
              {grid.error instanceof ApiError &&
              grid.error.isPermissionError ? (
                <p>
                  You don&apos;t have access to Overall Data. Ask an
                  administrator for the crm.overalldata.read permission.
                </p>
              ) : (
                <>
                  <p>Could not load Overall Data.</p>
                  <Button
                    size="sm"
                    variant="outline"
                    className="mt-3 rounded-xl"
                    onClick={() => void grid.refetch()}
                  >
                    Retry
                  </Button>
                </>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto crm-tracker-scroll">
              <Table>
                <TableHeader className="text-white">
                  <TableRow
                    className="hover:bg-transparent border-none"
                    style={GREEN_HEADER_STYLE}
                  >
                    <TableHead className="sticky left-0 z-20 text-left font-black text-xs uppercase tracking-wider text-white py-3.5 px-4 min-w-[220px] bg-brand-500">
                      Disposition\Date
                    </TableHead>
                    {grid.data.days.map((day) => (
                      <TableHead
                        key={day}
                        className="text-center font-black text-xs uppercase tracking-wider text-white py-3.5 px-2 min-w-[76px] bg-transparent"
                      >
                        {day.slice(8)}-{MONTH_NAMES[ym.month - 1]?.slice(0, 3)}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {grid.data.rows.map((row) => (
                    <TableRow
                      key={row.key}
                      className="border-b border-slate-100 hover:bg-emerald-50/40"
                    >
                      <TableCell className="sticky left-0 z-10 bg-white text-left font-bold text-sm text-slate-800 py-2.5 px-4 border-r border-slate-200 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.08)] min-w-[220px]">
                        {row.label}
                      </TableCell>
                      {grid.data.days.map((day) => {
                        const value = grid.data.daily[row.key][day] ?? 0;
                        return (
                          <TableCell
                            key={day}
                            className="p-1.5 text-center min-w-[76px]"
                          >
                            <button
                              type="button"
                              disabled={value === 0}
                              aria-label={`${row.label} on ${formatDay(day)}: ${value}`}
                              title={value > 0 ? "View records" : undefined}
                              onClick={() => {
                                setFilter("");
                                setDrill({
                                  row: row.key,
                                  label: row.label,
                                  day,
                                });
                              }}
                              className={cn(
                                "w-14 h-8 mx-auto flex items-center justify-center text-xs font-semibold rounded-lg border transition-colors",
                                value > 0
                                  ? "border-brand-200 bg-brand-50 text-brand-700 hover:bg-brand-100 cursor-pointer"
                                  : "border-slate-200 bg-slate-50 text-slate-400 cursor-default",
                              )}
                            >
                              {value}
                            </button>
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Inline Activity Details — the records behind the clicked (disposition, date) cell. */}
      {drill && (
        <div
          ref={drillRef}
          className="crm-panel-frame rounded-3xl bg-white overflow-hidden"
        >
          <div className="crm-panel-header relative overflow-hidden p-5 border-b border-brand-200/50 bg-gradient-to-br from-white via-brand-100/70 to-blue-100/50 flex items-center justify-between gap-3 flex-wrap">
            <span
              aria-hidden
              className="pointer-events-none absolute -left-16 -top-20 h-48 w-48 rounded-full bg-brand-300/40 blur-3xl"
            />
            <span
              aria-hidden
              className="pointer-events-none absolute right-10 -bottom-20 h-48 w-48 rounded-full bg-blue-300/35 blur-3xl"
            />
            <div className="relative flex items-center gap-2.5">
              <span className="h-8 w-8 rounded-xl flex items-center justify-center shrink-0 bg-gradient-to-br from-brand-400 to-brand-600 shadow-sm">
                <ListChecks className="h-4 w-4 text-white" />
              </span>
              <div>
                <h3 className="text-lg font-bold text-slate-900">
                  {drill.label} — {formatDay(drill.day)}
                </h3>
                <p className="text-sm text-slate-500">
                  {recordCount} record{recordCount === 1 ? "" : "s"}
                </p>
              </div>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="relative rounded-xl gap-1.5 h-9 shrink-0 border-brand-300 text-brand-700 hover:bg-brand-50 hover:text-brand-800"
              onClick={() => setDrill(null)}
            >
              <X className="h-3.5 w-3.5" /> Close
            </Button>
          </div>

          <div className="p-5 space-y-4">
            {recordCount > 0 && (
              <div className="relative max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                <Input
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                  placeholder="Filter by owner, account, contact, status…"
                  className="pl-8 h-9 rounded-xl border-brand-300 shadow-[0_0_0_3px_rgba(77,159,75,0.12)] focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-brand-400 focus-visible:shadow-[0_0_0_3px_rgba(77,159,75,0.18)] transition-shadow"
                />
              </div>
            )}

            {records.isPending ? (
              <div className="text-center py-10 text-slate-400 text-sm">
                Loading records…
              </div>
            ) : records.isError ? (
              <div className="text-center py-10">
                <EmptyState icon={ListChecks} title="Could not load records." />
                <Button
                  size="sm"
                  variant="outline"
                  className="rounded-xl"
                  onClick={() => void records.refetch()}
                >
                  Retry
                </Button>
              </div>
            ) : recordCount === 0 ? (
              <EmptyState icon={ListChecks} title="No records for this date." />
            ) : shown.length === 0 ? (
              <EmptyState
                icon={Search}
                title={`No records match "${filter}"`}
              />
            ) : (
              <div className="rounded-2xl border border-brand-200 shadow-[0_4px_16px_-4px_rgba(100,116,139,0.18)] overflow-hidden">
                <div className="overflow-x-auto crm-tracker-scroll">
                  <Table>
                    <TableHeader className="text-white">
                      <TableRow
                        className="hover:bg-transparent border-none"
                        style={GREEN_HEADER_STYLE}
                      >
                        <TableHead className="font-black text-sm uppercase tracking-wider text-white py-2.5">
                          Time
                        </TableHead>
                        <TableHead className="font-black text-sm uppercase tracking-wider text-white py-2.5">
                          Account
                        </TableHead>
                        <TableHead className="font-black text-sm uppercase tracking-wider text-white py-2.5">
                          Owner
                        </TableHead>
                        {columns.map((col) => (
                          <TableHead
                            key={col.label}
                            className="font-black text-sm uppercase tracking-wider text-white py-2.5"
                          >
                            {col.label}
                          </TableHead>
                        ))}
                        <TableHead className="font-black text-sm uppercase tracking-wider text-white text-center w-40 py-2.5">
                          Action
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {shown.map((r) => (
                        <TableRow
                          key={r.id}
                          className="border-b border-brand-200 last:border-b-0 hover:bg-brand-50/40"
                        >
                          <TableCell className="py-1 text-base text-slate-600 whitespace-nowrap">
                            {r.time}
                          </TableCell>
                          <TableCell className="py-1 text-base font-semibold text-slate-800">
                            {r.accountName || "—"}
                          </TableCell>
                          <TableCell className="py-1 text-base text-slate-600">
                            {r.owner || "—"}
                          </TableCell>
                          {columns.map((col) => (
                            <TableCell
                              key={col.label}
                              className="py-1 text-base text-slate-600 max-w-[220px] truncate"
                              title={String(r[col.key] ?? "")}
                            >
                              {String(r[col.key] ?? "") || "—"}
                            </TableCell>
                          ))}
                          <TableCell className="py-1.5">
                            <div className="flex items-center justify-center gap-1.5 flex-nowrap">
                              {r.viewPath && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 px-2 gap-1 rounded-lg text-xs border-blue-200 text-blue-600 bg-blue-50/50 hover:text-blue-700 hover:border-blue-400 hover:bg-blue-100 shrink-0 whitespace-nowrap"
                                  title="Open Account"
                                  onClick={() =>
                                    router.push(r.viewPath as string)
                                  }
                                >
                                  <Eye className="h-3.5 w-3.5" /> View
                                </Button>
                              )}
                              {canDelete(r) && (
                                <DeleteConfirmDialog
                                  trigger={
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="h-7 px-2 gap-1 rounded-lg text-xs border-red-200 text-red-600 bg-red-50/50 hover:text-red-700 hover:border-red-400 hover:bg-red-100 shrink-0 whitespace-nowrap"
                                    >
                                      <Trash2 className="h-3.5 w-3.5" /> Delete
                                    </Button>
                                  }
                                  title={`Delete this ${drill.label} record?`}
                                  description="This record will be moved to the CRM Recycle Bin."
                                  onConfirm={() => deleteRecord(r)}
                                />
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Weekly / Monthly Report */}
      {grid.data && (
        <div>
          <h2 className="text-lg font-extrabold text-slate-900 mb-3 px-1">
            Weekly/Monthly Report
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-5">
            {SUMMARY_ROWS.map((s) => {
              const Icon = s.icon;
              return (
                <Card
                  key={s.key}
                  className="crm-panel-frame relative rounded-3xl overflow-hidden bg-white hover:shadow-xl transition-all duration-200 group"
                >
                  <span
                    aria-hidden
                    className={cn(
                      "pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r",
                      s.accent,
                    )}
                  />
                  <CardHeader className="crm-panel-header flex flex-row items-center justify-between pb-2 bg-slate-50/50 p-5 border-b border-slate-100">
                    <CardTitle className="text-xs font-extrabold uppercase tracking-wider text-slate-700 leading-tight">
                      {s.label}
                    </CardTitle>
                    <div className="p-3 rounded-2xl bg-brand-50 text-brand-600 group-hover:scale-110 transition-transform shrink-0">
                      <Icon className="h-5 w-5" />
                    </div>
                  </CardHeader>
                  <CardContent className="p-5 pt-4">
                    <div className="w-full text-2xl font-extrabold text-slate-900 tracking-tight">
                      {grid.data.monthTotals[s.key] ?? 0}
                    </div>
                    <p className="text-sm text-slate-600 font-medium mt-1">
                      {monthLabel}
                    </p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
