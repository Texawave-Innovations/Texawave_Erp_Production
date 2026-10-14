"use client";

import { useState } from "react";
import { Download, FileSpreadsheet } from "lucide-react";
import { ApiError } from "@texawave-erp/core";
import {
  Alert,
  Button,
  DataTable,
  Dialog,
  FormField,
  Input,
  useToast,
} from "@texawave-erp/ui-kit";
import { downloadText } from "@/features/hr/payroll/download";
import { useImportAttendance } from "../hooks";
import type { AttendanceImportReport } from "../types";

/** Mirrors the API limits (attendance-csv.ts): 2 MB, 5,000 rows. */
const MAX_BYTES = 2 * 1024 * 1024;

const TEMPLATE =
  "Employee Code,Date,Check In,Check Out\r\nEMP-0001,2026-09-01,10:00,18:30\r\nEMP-0001,2026-09-02,09:55,13:00\r\nEMP-0001,2026-09-02,14:00,18:40\r\n";

function describe(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.isPermissionError)
      return "You don't have permission to import attendance.";
    if (error.isValidationError && error.fieldErrors.length > 0)
      return error.fieldErrors.join(" ");
    return error.message;
  }
  return "Could not read the file. Try again.";
}

/**
 * Punch import from a CSV or a biometric export (POST /hr/attendance/import).
 * "Check file" runs every rule — including overlaps with stored punches and
 * locked months — and saves nothing; "Import" then adds every row or none.
 */
export function ImportAttendanceDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [report, setReport] = useState<AttendanceImportReport | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const mutation = useImportAttendance();
  const { toast } = useToast();
  const busy = mutation.isPending;

  const checked = report?.dryRun === true && report.errors.length === 0;
  const toAdd = report ? report.validRows - report.duplicates : 0;
  const committed =
    report !== null && !report.dryRun && report.errors.length === 0;

  function choose(next: File | null) {
    setReport(null);
    setServerError(null);
    setFileError(null);
    if (next && next.size > MAX_BYTES) {
      setFile(null);
      setFileError("The file is larger than 2 MB.");
      return;
    }
    setFile(next);
  }

  async function run(dryRun: boolean) {
    if (!file) {
      setFileError("Choose a CSV file first.");
      return;
    }
    setServerError(null);
    try {
      const result = await mutation.mutateAsync({ file, dryRun });
      setReport(result);
      if (!dryRun && result.errors.length === 0) {
        toast({
          title: `${result.imported} session${result.imported === 1 ? "" : "s"} imported`,
          variant: "success",
        });
      }
    } catch (error) {
      setReport(null);
      setServerError(describe(error));
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title="Import punches" size="2xl">
      <div className="flex flex-col gap-4">
        <p className="text-theme-sm text-gray-600 dark:text-gray-400">
          One row per punch pair:{" "}
          <strong>Employee Code, Date, Check In, Check Out</strong>. Column
          names from most biometric exports (
          <em>Emp Code, In Time, Out Time</em>) are recognised. Dates as
          YYYY-MM-DD or DD-MM-YYYY, times as 24-hour HH:mm or 9:30 AM. Up to
          5,000 rows; either every row is imported or none is. Rows that match
          punches already recorded are skipped, so importing a file twice is
          safe.
        </p>
        <div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() =>
              downloadText("attendance-import-template.csv", TEMPLATE)
            }
          >
            <Download className="mr-1.5 h-3.5 w-3.5" />
            Download template
          </Button>
        </div>

        {!committed ? (
          <FormField
            label="CSV file"
            required
            error={fileError ?? undefined}
            hint={
              file
                ? `${file.name} · ${Math.ceil(file.size / 1024)} KB`
                : undefined
            }
          >
            {(f) => (
              <Input
                {...f}
                type="file"
                accept=".csv,text/csv"
                invalid={f.invalid}
                disabled={busy}
                onChange={(e) => choose(e.target.files?.[0] ?? null)}
              />
            )}
          </FormField>
        ) : null}

        {serverError ? (
          <Alert variant="error" title="The file was not accepted">
            {serverError}
          </Alert>
        ) : null}

        {report && report.errors.length > 0 ? (
          <div className="flex flex-col gap-2">
            <Alert
              variant="error"
              title={`${report.errors.length} problem${report.errors.length === 1 ? "" : "s"} found — nothing was ${report.dryRun ? "saved" : "imported"}`}
            >
              {report.validRows} of {report.totalRows} rows are fine. Fix the
              rows below and check the file again.
            </Alert>
            <div className="max-h-64 overflow-auto rounded-lg border border-gray-200 dark:border-gray-800">
              <DataTable
                caption="Import problems"
                rows={report.errors}
                getRowKey={(e) => `${e.row}-${e.field ?? ""}-${e.message}`}
                columns={[
                  {
                    header: "Row",
                    cell: (e) => <span className="font-mono">{e.row}</span>,
                  },
                  { header: "Column", cell: (e) => e.field ?? "—" },
                  { header: "Problem", cell: (e) => e.message },
                ]}
              />
            </div>
          </div>
        ) : null}

        {checked ? (
          <Alert variant="success" title="Ready to import">
            {toAdd} new punch pair{toAdd === 1 ? "" : "s"} will be added
            {report.duplicates > 0
              ? `; ${report.duplicates} already recorded will be skipped`
              : ""}
            . Nothing has been saved yet.
          </Alert>
        ) : null}

        {committed ? (
          <Alert variant="success" title="Import complete">
            Added {report.imported} punch pair{report.imported === 1 ? "" : "s"}
            {report.duplicates > 0
              ? `; skipped ${report.duplicates} already recorded`
              : ""}
            .
          </Alert>
        ) : null}

        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="secondary"
            onClick={onClose}
            disabled={busy}
          >
            {committed ? "Close" : "Cancel"}
          </Button>
          {!committed && !checked ? (
            <Button
              type="button"
              loading={busy}
              disabled={!file}
              onClick={() => void run(true)}
            >
              <FileSpreadsheet className="mr-1.5 h-4 w-4" />
              Check file
            </Button>
          ) : null}
          {checked ? (
            <Button
              type="button"
              loading={busy}
              disabled={toAdd === 0}
              onClick={() => void run(false)}
            >
              Import {toAdd} punch pair{toAdd === 1 ? "" : "s"}
            </Button>
          ) : null}
        </div>
      </div>
    </Dialog>
  );
}
