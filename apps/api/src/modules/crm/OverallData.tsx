import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  eachDayOfInterval,
  endOfMonth,
  format,
  startOfMonth,
  addMonths,
} from "date-fns";
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
  ChevronLeft,
  ChevronRight,
  Users,
  Mail,
  CalendarCheck,
  CheckCircle2,
  PhoneCall,
  FileDown,
  Eye,
  Search,
  ListChecks,
  Trash2,
  X,
} from "lucide-react";
import ExcelJS from "exceljs";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";
import { OverallActivityRecord, TrackingRowDef, TrackingRowKey } from "./types";
import { BackToDashboardButton } from "./components/BackToDashboardButton";
import { useOverallDataLive } from "./useOverallDataLive";
import { EmptyState, DeleteConfirmDialog } from "./intelligence/components";
import { isCrmAdmin } from "./domain/roles";
import { softDeleteCrmRecord } from "./domain/recycleBinService";
import { deleteCrmActivity } from "./domain/activitiesService";
import { deleteCrmMeeting } from "./domain/meetingsService";

// First tab of the CRM module. The daily disposition rows below are fixed —
// exact names/order as required; do not add, remove, or reorder them.
const TRACKING_ROWS: TrackingRowDef[] = [
  { key: "accountsMined", label: "Accounts Mined" },
  { key: "emailsSent", label: "E-mails sent for the day" },
  { key: "meetingsScheduled", label: "Meeting Scheduled" },
  { key: "meetingsCompleted", label: "Meeting Completed" },
  { key: "meetingsCancelled", label: "Meeting Cancelled" },
  { key: "sendInfoCallBacks", label: "Send Info / Call Backs" },
  { key: "followUp", label: "Follow-up (Keep in Touch)" },
  { key: "notInterested", label: "Not Interested" },
  { key: "callsMade", label: "Calls made for the Day" },
];

// Weekly/Monthly Report — live totals for the selected month, derived from the same Core CRM
// activity as the Daily Activity Tracker above (see useOverallDataLive).
const SUMMARY_ROWS: {
  label: string;
  sourceKey: TrackingRowDef["key"];
  icon: React.ElementType;
  accent: string;
}[] = [
  {
    label: "Total Number of Accounts Mined",
    sourceKey: "accountsMined",
    icon: Users,
    accent: "from-brand-400 to-brand-600",
  },
  {
    label: "Total Number of e-mails",
    sourceKey: "emailsSent",
    icon: Mail,
    accent: "from-sky-400 to-sky-600",
  },
  {
    label: "Total Number of Meetings Scheduled",
    sourceKey: "meetingsScheduled",
    icon: CalendarCheck,
    accent: "from-violet-400 to-violet-600",
  },
  {
    label: "Completed Meetings",
    sourceKey: "meetingsCompleted",
    icon: CheckCircle2,
    accent: "from-amber-400 to-amber-600",
  },
  {
    label: "Total Number of Calls made",
    sourceKey: "callsMade",
    icon: PhoneCall,
    accent: "from-rose-400 to-rose-600",
  },
];

/** Which OverallActivityRecord fields to show as columns in the drill-down table, per disposition
 *  — "the exact columns should adapt to the activity type" (e.g. a mined account has no Due Date,
 *  a cancelled meeting has no Outcome). Time + Account + Owner are always shown by the table
 *  itself; this only controls the extra columns after them. */
const ROW_DETAIL_COLUMNS: Record<
  TrackingRowKey,
  { key: keyof OverallActivityRecord; label: string }[]
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

const EXPORT_HEADER = [
  "Date",
  "Time",
  "Disposition",
  "Owner",
  "Account",
  "Contact",
  "Activity Type",
  "Status",
  "Due Date",
  "Completed Date",
  "Deal/Stage",
  "Source",
  "Notes/Outcome",
  "Record ID",
  "Summary Reference",
  "Summary Count",
];

/** Dispositions backed by a real, admin-deletable CRM Core Domain record (Accounts Mining row /
 *  Activity / Meeting). Send Info-Call Backs, Follow-up, and Not Interested are derived from the
 *  audit trail instead (`account_status_tag_changed`), which is intentionally never deletable —
 *  same rule every other CRM audit log follows — so no Delete action is offered for those three. */
const DELETABLE_ROWS: ReadonlySet<TrackingRowKey> = new Set<TrackingRowKey>([
  "accountsMined",
  "emailsSent",
  "callsMade",
  "meetingsScheduled",
  "meetingsCompleted",
  "meetingsCancelled",
]);

/** Builds one Activity Details row — including the "Summary Reference"/"Summary Count" columns
 *  that tie it straight back to its exact Sheet 1 cell (same disposition, same date). `summaryCount`
 *  is always `list.length` for that (row, day) group in `records`, i.e. the exact same number
 *  Sheet 1 shows for that cell — never independently computed, so the two can never disagree. */
function exportRow(
  row: TrackingRowDef,
  dayKey: string,
  r: OverallActivityRecord,
  summaryCount: number,
): (string | number)[] {
  return [
    dayKey,
    r.time,
    row.label,
    r.owner,
    r.accountName || "—",
    r.contactName || "—",
    r.action,
    r.status || "",
    r.dueDate || "",
    r.completedDate || "",
    r.dealStage || "",
    r.source || "",
    r.notes || "",
    r.recordId,
    `${row.label} — ${format(new Date(dayKey), "dd-MMM-yyyy")}`,
    summaryCount,
  ];
}

// --- Excel export styling — mirrors the CRM's own green header gradient/theme so the workbook
// reads as an extension of the on-screen tracker, not a generic spreadsheet dump. ---
const HEADER_GRADIENT: ExcelJS.Fill = {
  type: "gradient",
  gradient: "angle",
  degree: 0,
  stops: [
    { position: 0, color: { argb: "FF4D9F4B" } },
    { position: 0.5, color: { argb: "FF72B84A" } },
    { position: 1, color: { argb: "FF9FCA48" } },
  ],
};
const THIN_BORDER: Partial<ExcelJS.Borders> = {
  top: { style: "thin", color: { argb: "FFE2E8F0" } },
  left: { style: "thin", color: { argb: "FFE2E8F0" } },
  bottom: { style: "thin", color: { argb: "FFE2E8F0" } },
  right: { style: "thin", color: { argb: "FFE2E8F0" } },
};

/** Bolds/colors/fills row 1 as the sheet's header band, borders every used cell, freezes the
 *  header row, and turns on autofilter across the full header width. Shared by every sheet below
 *  so the workbook reads as one consistent, professional document. */
function styleSheet(
  sheet: ExcelJS.Worksheet,
  columnCount: number,
  rowCount: number,
) {
  const headerRow = sheet.getRow(1);
  headerRow.height = 22;
  headerRow.eachCell({ includeEmpty: true }, (cell) => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 11 };
    cell.fill = HEADER_GRADIENT;
    cell.alignment = {
      horizontal: "center",
      vertical: "middle",
      wrapText: true,
    };
    cell.border = THIN_BORDER;
  });
  for (let r = 2; r <= rowCount; r++) {
    sheet.getRow(r).eachCell({ includeEmpty: true }, (cell) => {
      cell.border = THIN_BORDER;
    });
  }
  sheet.views = [{ state: "frozen", ySplit: 1 }];
  const lastCol = sheet.getColumn(columnCount).letter;
  sheet.autoFilter = { from: "A1", to: `${lastCol}1` };
}

/** Triggers a browser download of an in-memory workbook — ExcelJS has no Node-style `writeFile`
 *  in the browser, so the buffer is wrapped in a Blob and downloaded via a throwaway <a>. */
async function downloadWorkbook(wb: ExcelJS.Workbook, fileName: string) {
  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export default function OverallData() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [monthDate, setMonthDate] = useState<Date>(startOfMonth(new Date()));
  const { loading, daily, monthTotals, records } =
    useOverallDataLive(monthDate);
  const [drill, setDrill] = useState<{
    row: TrackingRowDef;
    dayKey: string;
  } | null>(null);
  const [drillQuery, setDrillQuery] = useState("");
  const drillRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (drill)
      drillRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [drill]);

  const monthKey = format(monthDate, "yyyy-MM");
  const days = useMemo(
    () =>
      eachDayOfInterval({
        start: startOfMonth(monthDate),
        end: endOfMonth(monthDate),
      }),
    [monthDate],
  );

  const getValue = (rowKey: string, dateKey: string): number =>
    daily[rowKey as TrackingRowDef["key"]]?.[dateKey] ?? 0;

  const getReportValue = (rowKey: string): number =>
    monthTotals[rowKey as TrackingRowDef["key"]] ?? 0;

  const drillRecords = useMemo(() => {
    if (!drill) return [];
    const list = records[drill.row.key]?.[drill.dayKey] || [];
    const q = drillQuery.trim().toLowerCase();
    if (!q) return list;
    return list.filter((r) =>
      [r.owner, r.accountName, r.contactName, r.action, r.status]
        .filter(Boolean)
        .some((f) => (f as string).toLowerCase().includes(q)),
    );
  }, [drill, records, drillQuery]);

  const openDrill = (row: TrackingRowDef, dateKey: string) => {
    if (getValue(row.key, dateKey) === 0) return;
    setDrillQuery("");
    setDrill({ row, dayKey: dateKey });
  };

  // Deletes the real underlying CRM record a drill-down row represents — routed through the same
  // Admin-only, Recycle-Bin-backed delete services every other CRM tab uses, per row type.
  // `records`/`daily` update live off the same subscriptions, so the row and its count disappear
  // on their own the moment the delete lands — nothing here needs to be manually refetched.
  const deleteDrillRecord = async (
    row: TrackingRowDef,
    r: OverallActivityRecord,
  ) => {
    if (row.key === "accountsMined") {
      // `softDeleteCrmRecord` reports whether it actually deleted anything (`false` when the row
      // was already gone — e.g. removed from another tab/session moments earlier) — show that
      // instead of unconditionally claiming success for what may have been a no-op.
      const deleted = await softDeleteCrmRecord(
        "accountsMiningSheet",
        r.accountName || r.recordId,
        "crm/accountsMiningSheet",
        r.recordId,
        user,
      );
      toast.success(deleted ? "Record deleted" : "Record was already removed");
      return;
    }
    if (row.key === "emailsSent" || row.key === "callsMade") {
      await deleteCrmActivity(r.recordId, r.action, user);
    } else {
      await deleteCrmMeeting(r.recordId, user);
    }
    toast.success("Record deleted");
  };

  const [exporting, setExporting] = useState(false);

  const handleExport = async () => {
    setExporting(true);
    try {
      const wb = new ExcelJS.Workbook();
      wb.creator = "TexaWave CRM";
      wb.created = new Date();

      // Precomputed, in the exact order Sheet 3 below inserts rows in, the Excel row number each
      // (disposition, day) group of records starts at — lets every non-zero Sheet 1 count cell
      // link straight to its matching rows in Activity Details, so "3" is never just a number.
      const detailStartRow: Partial<
        Record<TrackingRowKey, Record<string, number>>
      > = {};
      {
        let runningRow = 2; // row 1 is the Activity Details header
        TRACKING_ROWS.forEach((row) => {
          const byDay = records[row.key] || {};
          Object.keys(byDay)
            .sort()
            .forEach((dayKey) => {
              const count = byDay[dayKey].length;
              if (count === 0) return;
              (detailStartRow[row.key] ||= {})[dayKey] = runningRow;
              runningRow += count;
            });
        });
      }

      // --- Sheet 1: Daily Activity Summary — the existing count-based tracker, unchanged data,
      //     now with the same green header theme and borders as the rest of the workbook, and
      //     every non-zero count hyperlinked to its exact matching rows in Activity Details. ---
      const summarySheet = wb.addWorksheet("Daily Activity Summary");
      const dailyHeader = [
        "Disposition",
        ...days.map((d) => format(d, "dd-MMM-yyyy")),
      ];
      summarySheet.addRow(dailyHeader);
      TRACKING_ROWS.forEach((row) => {
        const excelRow = summarySheet.addRow([
          row.label,
          ...days.map((d) => getValue(row.key, format(d, "yyyy-MM-dd"))),
        ]);
        days.forEach((d, i) => {
          const dayKey = format(d, "yyyy-MM-dd");
          const count = getValue(row.key, dayKey);
          const targetRow =
            count > 0 ? detailStartRow[row.key]?.[dayKey] : undefined;
          if (targetRow) {
            const cell = excelRow.getCell(i + 2); // +2: column 1 is Disposition, dates start at 2
            cell.value = {
              text: String(count),
              hyperlink: `#'Activity Details'!A${targetRow}`,
            };
            cell.font = { color: { argb: "FF1D4ED8" }, underline: true };
          }
        });
      });
      summarySheet.getColumn(1).width = 34;
      for (let i = 2; i <= dailyHeader.length; i++)
        summarySheet.getColumn(i).width = 11;
      summarySheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return;
        row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
          cell.alignment =
            colNumber === 1
              ? { horizontal: "left", vertical: "middle" }
              : { horizontal: "center", vertical: "middle" };
          if (colNumber === 1) cell.font = { bold: true };
        });
      });
      styleSheet(summarySheet, dailyHeader.length, TRACKING_ROWS.length + 1);

      // --- Sheet 2: Weekly-Monthly Report — the existing summary-card totals, unchanged data. ---
      const reportSheet = wb.addWorksheet("Weekly-Monthly Report");
      reportSheet.addRow(["Metric", "Value"]);
      SUMMARY_ROWS.forEach((s) =>
        reportSheet.addRow([s.label, getReportValue(s.sourceKey)]),
      );
      reportSheet.getColumn(1).width = 42;
      reportSheet.getColumn(2).width = 14;
      reportSheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return;
        row.getCell(2).alignment = { horizontal: "center", vertical: "middle" };
      });
      styleSheet(reportSheet, 2, SUMMARY_ROWS.length + 1);

      // --- Sheet 3: Activity Details — the actual CRM records behind every count above, from the
      //     exact same `records` data the UI's drill-down reads, so the counts on Sheet 1 and the
      //     row count here can never disagree. ---
      const detailSheet = wb.addWorksheet("Activity Details");
      detailSheet.addRow(EXPORT_HEADER);
      let detailRowCount = 0;
      TRACKING_ROWS.forEach((row) => {
        const byDay = records[row.key] || {};
        Object.keys(byDay)
          .sort()
          .forEach((dayKey) => {
            const list = byDay[dayKey];
            list.forEach((r) => {
              detailSheet.addRow(exportRow(row, dayKey, r, list.length));
              detailRowCount += 1;
            });
          });
      });
      // Date/Time/Disposition/Owner/Account/Contact/Type/Status/Due/Completed/Stage/Source/Notes/ID/SummaryRef/SummaryCount
      detailSheet.columns.forEach((col, i) => {
        col.width =
          [12, 10, 22, 16, 22, 18, 20, 12, 16, 16, 16, 16, 44, 18, 32, 14][i] ??
          16;
      });
      const notesCol = EXPORT_HEADER.indexOf("Notes/Outcome") + 1;
      const countCol = EXPORT_HEADER.indexOf("Summary Count") + 1;
      detailSheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return;
        row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
          cell.alignment =
            colNumber === notesCol
              ? { horizontal: "left", vertical: "top", wrapText: true }
              : colNumber === countCol
                ? { horizontal: "center", vertical: "middle" }
                : { horizontal: "left", vertical: "middle" };
        });
      });
      styleSheet(detailSheet, EXPORT_HEADER.length, detailRowCount + 1);

      await downloadWorkbook(wb, `crm-overall-data_${monthKey}.xlsx`);
    } catch (err) {
      console.error("Failed to export Overall Data workbook:", err);
      toast.error("Failed to export — please try again.");
    } finally {
      setExporting(false);
    }
  };

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
            onClick={() => setMonthDate((d) => startOfMonth(addMonths(d, -1)))}
            title="Previous month"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="text-center">
            <p className="text-lg font-bold text-slate-900 tracking-tight">
              {format(monthDate, "MMMM yyyy")}
            </p>
            <p className="text-sm text-slate-400">Daily disposition tracking</p>
          </div>
          <Button
            size="icon"
            className="rounded-xl h-9 w-9 shrink-0 border border-brand-200 bg-brand-50 text-brand-700 hover:bg-brand-100 shadow-none"
            onClick={() => setMonthDate((d) => startOfMonth(addMonths(d, 1)))}
            title="Next month"
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
          <Button
            size="sm"
            variant="outline"
            className="rounded-xl gap-1.5 h-9 shrink-0"
            disabled={exporting}
            onClick={() => {
              void handleExport();
            }}
          >
            <FileDown className="h-3.5 w-3.5" />{" "}
            {exporting ? "Exporting…" : "Export Excel"}
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="text-center py-16 text-slate-400 text-sm">
              Loading CRM data…
            </div>
          ) : (
            <div className="overflow-x-auto crm-tracker-scroll">
              <Table>
                <TableHeader className="text-white">
                  <TableRow
                    className="hover:bg-transparent border-none"
                    style={{
                      background:
                        "linear-gradient(90deg, #4D9F4B 0%, #72B84A 50%, #9FCA48 100%)",
                    }}
                  >
                    <TableHead className="sticky left-0 z-20 text-left font-black text-xs uppercase tracking-wider text-white py-3.5 px-4 min-w-[220px] bg-brand-500">
                      Disposition\Date
                    </TableHead>
                    {days.map((day) => (
                      <TableHead
                        key={day.toISOString()}
                        className="text-center font-black text-xs uppercase tracking-wider text-white py-3.5 px-2 min-w-[76px] bg-transparent"
                      >
                        {format(day, "dd-MMM")}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {TRACKING_ROWS.map((row) => (
                    <TableRow
                      key={row.key}
                      className="border-b border-slate-100 hover:bg-emerald-50/40"
                    >
                      <TableCell className="sticky left-0 z-10 bg-white text-left font-bold text-sm text-slate-800 py-2.5 px-4 border-r border-slate-200 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.08)] min-w-[220px]">
                        {row.label}
                      </TableCell>
                      {days.map((day) => {
                        const dateKey = format(day, "yyyy-MM-dd");
                        const value = getValue(row.key, dateKey);
                        return (
                          <TableCell
                            key={dateKey}
                            className="p-1.5 text-center min-w-[76px]"
                          >
                            <button
                              type="button"
                              onClick={() => openDrill(row, dateKey)}
                              title={value > 0 ? "View records" : undefined}
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

      {/* Inline Activity Details — the actual records behind whichever (disposition, date) cell was
          clicked. Rendered in-page (no modal/overlay/new tab), directly below the Daily Activity
          Tracker, same enterprise card style as the rest of the CRM — collapses back to the normal
          Overall Data view via the Close control. */}
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
                  {drill.row.label} —{" "}
                  {format(new Date(drill.dayKey), "dd MMM yyyy")}
                </h3>
                <p className="text-sm text-slate-500">
                  {records[drill.row.key]?.[drill.dayKey]?.length || 0} record
                  {(records[drill.row.key]?.[drill.dayKey]?.length || 0) === 1
                    ? ""
                    : "s"}
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
            {(records[drill.row.key]?.[drill.dayKey]?.length || 0) > 0 && (
              <div className="relative max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                <Input
                  value={drillQuery}
                  onChange={(e) => setDrillQuery(e.target.value)}
                  placeholder="Filter by owner, account, contact, status…"
                  className="pl-8 h-9 rounded-xl border-brand-300 shadow-[0_0_0_3px_rgba(77,159,75,0.12)] focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-brand-400 focus-visible:shadow-[0_0_0_3px_rgba(77,159,75,0.18)] transition-shadow"
                />
              </div>
            )}

            {(records[drill.row.key]?.[drill.dayKey]?.length || 0) === 0 ? (
              <EmptyState icon={ListChecks} title="No records for this date." />
            ) : drillRecords.length === 0 ? (
              <EmptyState
                icon={Search}
                title={`No records match "${drillQuery}"`}
              />
            ) : (
              <div className="rounded-2xl border border-brand-200 shadow-[0_4px_16px_-4px_rgba(100,116,139,0.18)] overflow-hidden">
                <div className="overflow-x-auto crm-tracker-scroll">
                  <Table>
                    <TableHeader className="text-white">
                      <TableRow
                        className="hover:bg-transparent border-none"
                        style={{
                          background:
                            "linear-gradient(90deg, #4D9F4B 0%, #72B84A 50%, #9FCA48 100%)",
                        }}
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
                        {ROW_DETAIL_COLUMNS[drill.row.key].map((col) => (
                          <TableHead
                            key={String(col.key)}
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
                      {drillRecords.map((r) => (
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
                          {ROW_DETAIL_COLUMNS[drill.row.key].map((col) => (
                            <TableCell
                              key={String(col.key)}
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
                                    navigate(r.viewPath!, {
                                      state: {
                                        from: "/crm/overall-data",
                                        label: "Overall Data",
                                      },
                                    })
                                  }
                                >
                                  <Eye className="h-3.5 w-3.5" /> View
                                </Button>
                              )}
                              {isCrmAdmin(user) &&
                                DELETABLE_ROWS.has(drill.row.key) && (
                                  <DeleteConfirmDialog
                                    trigger={
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        className="h-7 px-2 gap-1 rounded-lg text-xs border-red-200 text-red-600 bg-red-50/50 hover:text-red-700 hover:border-red-400 hover:bg-red-100 shrink-0 whitespace-nowrap"
                                      >
                                        <Trash2 className="h-3.5 w-3.5" />{" "}
                                        Delete
                                      </Button>
                                    }
                                    title={`Delete this ${drill.row.label} record?`}
                                    description="This record will be moved to the CRM Recycle Bin."
                                    onConfirm={() =>
                                      deleteDrillRecord(drill.row, r)
                                    }
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
      <div>
        <h2 className="text-lg font-extrabold text-slate-900 mb-3 px-1">
          Weekly/Monthly Report
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-5">
          {SUMMARY_ROWS.map((s) => {
            const Icon = s.icon;
            return (
              <Card
                key={s.sourceKey}
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
                    {getReportValue(s.sourceKey)}
                  </div>
                  <p className="text-sm text-slate-600 font-medium mt-1">
                    {format(monthDate, "MMMM yyyy")}
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
