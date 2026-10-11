"use client";

import { useState } from "react";
import { Download } from "lucide-react";
import {
  Alert,
  Button,
  DateRangePicker,
  Dialog,
  useToast,
} from "@texawave-erp/ui-kit";
import { exportAttendanceCsv } from "../api";

const MAX_DAYS = 62;

function today(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(
    new Date(),
  );
}

function monthStart(): string {
  return `${today().slice(0, 7)}-01`;
}

/**
 * CSV of every employee in the caller's export scope for each day in the
 * range — unmarked days included — with derived status, first in / last out
 * and hours (GET /hr/attendance/export). Limits mirror the API: 62 days,
 * 50,000 rows.
 */
export function ExportAttendanceDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [range, setRange] = useState({ from: monthStart(), to: today() });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const days =
    range.from && range.to
      ? Math.round(
          (Date.parse(range.to) - Date.parse(range.from)) / 86_400_000,
        ) + 1
      : 0;
  const rangeProblem =
    !range.from || !range.to
      ? "Choose both dates."
      : range.from > range.to
        ? "The start date must be on or before the end date."
        : days > MAX_DAYS
          ? `Export at most ${MAX_DAYS} days at a time.`
          : null;

  async function run() {
    setBusy(true);
    setError(null);
    try {
      await exportAttendanceCsv(range);
      toast({ title: "Attendance exported", variant: "success" });
      onClose();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "The export failed. Try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title="Export attendance" size="md">
      <div className="flex flex-col gap-4">
        <p className="text-theme-sm text-gray-600 dark:text-gray-400">
          One row per employee per day in your scope, including days with no
          punches. Opens in Excel.
        </p>
        <DateRangePicker
          value={range}
          onChange={(r) => setRange({ from: r.from, to: r.to })}
          onClear={() => setRange({ from: "", to: "" })}
          fromAriaLabel="Export from"
          toAriaLabel="Export to"
        />
        {rangeProblem ? (
          <p className="text-theme-xs text-error-600">{rangeProblem}</p>
        ) : null}
        {error ? (
          <Alert variant="error" title="Export failed">
            {error}
          </Alert>
        ) : null}
        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="secondary"
            onClick={onClose}
            disabled={busy}
          >
            Cancel
          </Button>
          <Button
            type="button"
            loading={busy}
            disabled={rangeProblem !== null}
            onClick={() => void run()}
          >
            <Download className="mr-1.5 h-4 w-4" />
            Download CSV
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
