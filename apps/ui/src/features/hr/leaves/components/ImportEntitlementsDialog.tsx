"use client";

import { useState } from "react";
import { Download, FileSpreadsheet } from "lucide-react";
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
import { leaveErrorMessage } from "../errors";
import { useImportLeaveEntitlements } from "../hooks";
import type { EntitlementImportReport } from "../types";

/** Mirrors the API limits (leave-csv.ts): 2 MB, 5,000 rows. */
const MAX_BYTES = 2 * 1024 * 1024;

const template = (year: number) =>
  `Employee Code,Leave Type Code,Year,Annual Entitlement\r\nEMP-000001,CASUAL,${year},12\r\nEMP-000001,SICK,${year},\r\n`;

/**
 * Bulk allotment from a CSV (POST /hr/leave-entitlements/import). "Check
 * file" runs every rule and saves nothing; "Import" then saves every row or
 * none. A blank entitlement puts the employee back on the type default.
 */
export function ImportEntitlementsDialog({
  open,
  onClose,
  year,
}: {
  open: boolean;
  onClose: () => void;
  year: number;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [report, setReport] = useState<EntitlementImportReport | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const mutation = useImportLeaveEntitlements();
  const { toast } = useToast();
  const busy = mutation.isPending;

  const checked = report?.dryRun === true && report.errors.length === 0;
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
          title: `${result.imported} entitlement${result.imported === 1 ? "" : "s"} saved`,
          variant: "success",
        });
      }
    } catch (error) {
      setReport(null);
      setServerError(
        leaveErrorMessage(
          error,
          "You don't have permission to import entitlements.",
        ),
      );
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title="Import allotment" size="2xl">
      <div className="flex flex-col gap-4">
        <p className="text-theme-sm text-gray-600 dark:text-gray-400">
          One row per employee and leave type:{" "}
          <strong>
            Employee Code, Leave Type Code, Year, Annual Entitlement
          </strong>
          . Leave the entitlement blank to go back to the leave type default. Up
          to 5,000 rows; either every row is saved or none is.
        </p>
        <div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() =>
              downloadText("leave-allotment-template.csv", template(year))
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
              title={`${report.errors.length} problem${report.errors.length === 1 ? "" : "s"} found — nothing was saved`}
            >
              {report.validRows} of {report.totalRows} rows are fine. Fix the
              rows below and check the file again.
            </Alert>
            <div className="max-h-64 overflow-auto rounded-lg border border-gray-200 dark:border-gray-800">
              <DataTable
                caption="Import problems"
                rows={report.errors}
                getRowKey={(e) => `${e.row}-${e.message}`}
                columns={[
                  {
                    header: "Row",
                    cell: (e) => <span className="font-semibold text-slate-700 dark:text-slate-300">{e.row}</span>,
                  },
                  { header: "Problem", cell: (e) => e.message },
                ]}
              />
            </div>
          </div>
        ) : null}

        {checked ? (
          <Alert variant="success" title="Ready to import">
            {report.validRows} row{report.validRows === 1 ? "" : "s"} will be
            saved. Nothing has been saved yet.
          </Alert>
        ) : null}

        {committed ? (
          <Alert variant="success" title="Import complete">
            Saved {report.imported} entitlement
            {report.imported === 1 ? "" : "s"}.
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
              onClick={() => void run(false)}
            >
              Import {report.validRows} row{report.validRows === 1 ? "" : "s"}
            </Button>
          ) : null}
        </div>
      </div>
    </Dialog>
  );
}
