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
import { useImportEmployees } from "../hooks";
import type { EmployeeImportReport } from "../types";

/** The columns POST /hr/employees/import reads (employee-csv.ts on the API).
 * Masters are matched by name; "Reports To" is an employee code. */
const TEMPLATE_HEADERS = [
  "Full Name",
  "Work Email",
  "Phone",
  "Team",
  "Department",
  "Designation",
  "Employment Type",
  "Work Location",
  "Reports To",
  "Date of Joining",
  "Probation End Date",
  "Confirmation Date",
  "Referred By",
  "Work Domain",
];
const TEMPLATE_EXAMPLE = [
  "Asha Verma",
  "asha.verma@texawave.com",
  "9840012345",
  "Software",
  "",
  "Software Engineer",
  "Permanent",
  "",
  "",
  "2026-11-01",
  "2027-05-01",
  "",
  "",
  "",
];

/** Mirrors the API limits: 2 MB, 500 rows (the server re-checks both). */
const MAX_BYTES = 2 * 1024 * 1024;

function describeImportError(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.isPermissionError)
      return "You don't have permission to import employees.";
    if (error.isValidationError && error.fieldErrors.length > 0)
      return error.fieldErrors.join(" ");
    return error.message;
  }
  return "Could not read the file. Try again.";
}

/**
 * Bulk create from CSV. A "Check file" dry run runs every rule — including
 * the database checks — and saves nothing; "Import" then commits all rows in
 * one go. If any row fails, nothing is created and every problem is listed
 * against its file row (the header is row 1).
 */
export function ImportEmployeesDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [report, setReport] = useState<EmployeeImportReport | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const mutation = useImportEmployees();
  const { toast } = useToast();
  const busy = mutation.isPending;

  const checked = report?.dryRun === true && report.errors.length === 0;

  function chooseFile(next: File | null) {
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
      if (!dryRun && result.created.length > 0) {
        toast({
          title: `${result.created.length} employee${result.created.length === 1 ? "" : "s"} imported`,
          variant: "success",
        });
      }
    } catch (error) {
      setReport(null);
      setServerError(describeImportError(error));
    }
  }

  const committed =
    report !== null && !report.dryRun && report.created.length > 0;

  return (
    <Dialog open={open} onClose={onClose} title="Import employees" size="2xl">
      <div className="flex flex-col gap-4">
        <p className="text-theme-sm text-gray-600 dark:text-gray-400">
          Upload a CSV (Excel: <em>Save as → CSV UTF-8</em>), up to 500 rows.
          Team, department, designation, employment type and work location are
          matched by name; <strong>Reports To</strong> is an employee code.
          Dates use YYYY-MM-DD. Either every row is imported or none is.
        </p>

        <div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() =>
              downloadText(
                "employees-import-template.csv",
                `${TEMPLATE_HEADERS.join(",")}\r\n${TEMPLATE_EXAMPLE.join(",")}\r\n`,
              )
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
                onChange={(e) => chooseFile(e.target.files?.[0] ?? null)}
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
              title={`${report.errors.length} problem${report.errors.length === 1 ? "" : "s"} found — nothing was ${report.dryRun ? "checked as ready" : "imported"}`}
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
            All {report.totalRows} row{report.totalRows === 1 ? "" : "s"} passed
            every check. Nothing has been saved yet.
          </Alert>
        ) : null}

        {committed ? (
          <Alert variant="success" title="Import complete">
            Created {report.created.length} employee
            {report.created.length === 1 ? "" : "s"}:{" "}
            {report.created.map((c) => c.employeeCode).join(", ")}.
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
              Import {report.totalRows} employee
              {report.totalRows === 1 ? "" : "s"}
            </Button>
          ) : null}
        </div>
      </div>
    </Dialog>
  );
}
