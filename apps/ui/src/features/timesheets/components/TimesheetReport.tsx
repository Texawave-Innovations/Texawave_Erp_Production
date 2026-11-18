"use client";

import { useState } from "react";
import { Download } from "lucide-react";
import { businessToday } from "@texawave-erp/core";
import {
  Button,
  EmptyState,
  ErrorState,
  Input,
  Skeleton,
  useToast,
} from "@texawave-erp/ui-kit";
import { usePermission } from "@/hooks/usePermission";
import { downloadReportCsv } from "../api";
import { useEmployeeReport } from "../hooks";
import { REVIEW_EXPORT_ANY_SCOPE } from "../permissions";
import { formatMinutes } from "./MyTimesheetView";

/** First day of the month that holds `date` (`YYYY-MM-DD`). */
function monthStart(date: string): string {
  return `${date.slice(0, 7)}-01`;
}

/**
 * Per-employee report over a date range: recorded hours (tasks and other
 * activities) and how many days are not submitted, submitted, approved or
 * returned. The API scopes the people to the caller's `hr.timesheet.read`
 * reach and caps a range at 62 days. CSV downloads need the export permission.
 */
export function TimesheetReport() {
  const today = businessToday();
  const [from, setFrom] = useState(monthStart(today));
  const [to, setTo] = useState(today);
  const canExport = usePermission(REVIEW_EXPORT_ANY_SCOPE);
  const { toast } = useToast();
  const [downloading, setDownloading] = useState<"employees" | "days" | null>(
    null,
  );

  const valid = from !== "" && to !== "" && from <= to;
  const { data, isLoading, isError, error, refetch } = useEmployeeReport(
    valid ? { from, to } : null,
  );

  async function download(kind: "employees" | "days") {
    setDownloading(kind);
    try {
      await downloadReportCsv(kind, { from, to });
    } catch (err) {
      toast({
        title:
          err instanceof Error && err.message
            ? err.message
            : "Could not download the report",
        variant: "error",
      });
    } finally {
      setDownloading(null);
    }
  }

  return (
    <section aria-label="Timesheet report" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-xs font-semibold text-gray-600 dark:text-gray-300">
          From
          <Input
            type="date"
            aria-label="Report from"
            value={from}
            max={to || undefined}
            onChange={(e) => setFrom(e.target.value)}
            className="w-44"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs font-semibold text-gray-600 dark:text-gray-300">
          To
          <Input
            type="date"
            aria-label="Report to"
            value={to}
            min={from || undefined}
            onChange={(e) => setTo(e.target.value)}
            className="w-44"
          />
        </label>
        {canExport ? (
          <div className="ml-auto flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="secondary"
              onClick={() => void download("employees")}
              loading={downloading === "employees"}
              disabled={!valid || downloading !== null}
            >
              <Download className="h-3.5 w-3.5" />
              CSV by employee
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => void download("days")}
              loading={downloading === "days"}
              disabled={!valid || downloading !== null}
            >
              <Download className="h-3.5 w-3.5" />
              CSV by day
            </Button>
          </div>
        ) : null}
      </div>

      {!valid ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Choose a start date that is not after the end date.
        </p>
      ) : isLoading ? (
        <Skeleton className="h-40 w-full rounded-2xl" />
      ) : isError ? (
        <ErrorState
          title="Could not load the report"
          {...(error instanceof Error && error.message
            ? { description: error.message }
            : {})}
          onRetry={() => void refetch()}
        />
      ) : !data || data.lines.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-300 bg-white py-6 dark:border-gray-800 dark:bg-gray-900">
          <EmptyState
            title="No timesheets in this range"
            description="Days with recorded work appear here, one line per employee."
          />
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-b border-gray-200 text-xs font-bold uppercase tracking-wide text-gray-500 dark:border-gray-800 dark:text-gray-400">
              <tr>
                <th className="px-4 py-3">Employee</th>
                <th className="px-3 py-3 text-right">Days</th>
                <th className="px-3 py-3 text-right">Task time</th>
                <th className="px-3 py-3 text-right">Other</th>
                <th className="px-3 py-3 text-right">Total</th>
                <th className="px-3 py-3 text-right">Not submitted</th>
                <th className="px-3 py-3 text-right">Submitted</th>
                <th className="px-3 py-3 text-right">Approved</th>
                <th className="px-3 py-3 text-right">Returned</th>
              </tr>
            </thead>
            <tbody>
              {data.lines.map((line) => (
                <tr
                  key={line.employee.id}
                  className="border-b border-gray-100 last:border-0 dark:border-gray-800"
                >
                  <td className="px-4 py-3">
                    <p className="font-semibold text-gray-900 dark:text-white">
                      {line.employee.name}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {line.employee.code} · {line.employee.team}
                    </p>
                  </td>
                  <td className="px-3 py-3 text-right">{line.daysRecorded}</td>
                  <td className="px-3 py-3 text-right">
                    {formatMinutes(line.taskMinutes)}
                  </td>
                  <td className="px-3 py-3 text-right">
                    {formatMinutes(line.customMinutes)}
                  </td>
                  <td className="px-3 py-3 text-right font-bold">
                    {formatMinutes(line.totalMinutes)}
                  </td>
                  <td className="px-3 py-3 text-right">
                    {line.notSubmittedDays}
                  </td>
                  <td className="px-3 py-3 text-right">{line.submittedDays}</td>
                  <td className="px-3 py-3 text-right">{line.approvedDays}</td>
                  <td className="px-3 py-3 text-right">{line.returnedDays}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
