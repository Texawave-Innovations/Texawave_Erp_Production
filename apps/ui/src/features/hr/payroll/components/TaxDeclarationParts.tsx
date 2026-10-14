"use client";

import {
  Alert,
  Button,
  DataTable,
  FormField,
  Input,
  Select,
} from "@texawave-erp/ui-kit";
import { useState } from "react";
import { downloadForm16 } from "../api";
import { downloadBlob } from "../download";
import { describeError, money, periodLabel } from "../format";
import { useForm16 } from "../hooks";
import {
  DECLARATION_FIELDS,
  type DeclarationField,
  TAX_REGIMES,
  type TaxDeclaration,
  type TaxRegime,
} from "../types";
import { ServerError } from "./DialogParts";

export type DeclarationDraft = { regime: TaxRegime } & Record<
  DeclarationField,
  string
>;

export function declarationDraft(d: TaxDeclaration | null): DeclarationDraft {
  const out = { regime: d?.regime ?? "NEW" } as DeclarationDraft;
  for (const [k] of DECLARATION_FIELDS) {
    out[k] = d ? String(Number(d[k])) : "0";
  }
  return out;
}

/** Validates the draft; an error message or the amounts. */
export function declarationAmounts(
  draft: DeclarationDraft,
): { error: string } | { amounts: Record<DeclarationField, number> } {
  const amounts = {} as Record<DeclarationField, number>;
  for (const [k, label] of DECLARATION_FIELDS) {
    const text = draft[k].trim();
    const n = text === "" ? 0 : Number(text);
    if (!Number.isFinite(n) || n < 0) return { error: `${label}: ₹0 or more` };
    amounts[k] = n;
  }
  return { amounts };
}

/** The declaration fields (annual amounts) — shared by HR and the portal. */
export function DeclarationFields({
  draft,
  onChange,
  disabled = false,
}: {
  draft: DeclarationDraft;
  onChange: (d: DeclarationDraft) => void;
  disabled?: boolean;
}) {
  return (
    <fieldset disabled={disabled} className="flex flex-col gap-4">
      <FormField
        label="Tax regime"
        hint="The new regime allows only the standard deduction; the old one also counts the deductions below."
      >
        {(f) => (
          <Select
            {...f}
            value={draft.regime}
            onChange={(e) =>
              onChange({ ...draft, regime: e.target.value as TaxRegime })
            }
          >
            {TAX_REGIMES.map((r) => (
              <option key={r} value={r}>
                {r === "NEW" ? "New regime" : "Old regime"}
              </option>
            ))}
          </Select>
        )}
      </FormField>
      <div className="grid gap-4 sm:grid-cols-2">
        {DECLARATION_FIELDS.map(([k, label]) => (
          <FormField key={k} label={`${label} (₹ / year)`}>
            {(f) => (
              <Input
                {...f}
                type="number"
                min={0}
                inputMode="decimal"
                value={draft[k]}
                onChange={(e) => onChange({ ...draft, [k]: e.target.value })}
              />
            )}
          </FormField>
        ))}
      </div>
    </fieldset>
  );
}

/**
 * Form 16 Part B for a year (Docs/PAYROLL_AND_COMPLIANCE.md §4.14), with a
 * PDF download. `employeeId` null = the caller's own.
 */
export function Form16View({
  financialYear,
  employeeId,
}: {
  financialYear: string;
  employeeId: number | null;
}) {
  const query = useForm16(financialYear, employeeId);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const f = query.data;

  async function download() {
    if (!f) return;
    setDownloading(true);
    setError(null);
    try {
      downloadBlob(
        `Form16-${f.employee.employeeCode}-${financialYear}.pdf`,
        await downloadForm16(financialYear, employeeId),
      );
    } catch (err) {
      setError(describeError(err));
    } finally {
      setDownloading(false);
    }
  }

  if (query.isPending) {
    return (
      <p
        role="status"
        className="text-theme-sm text-gray-600 dark:text-gray-400"
      >
        Loading Form 16…
      </p>
    );
  }
  if (query.isError) {
    return (
      <Alert variant="info" title="No Form 16 yet">
        {describeError(query.error)}
      </Alert>
    );
  }
  if (!f) return null;
  const t = f.totals;
  return (
    <div className="flex flex-col gap-3">
      <p className="text-theme-sm text-gray-700 dark:text-gray-300">
        {f.employee.fullName} ({f.employee.employeeCode}) · PAN{" "}
        {f.employee.pan ?? "—"} · {f.regime} regime · employer{" "}
        {f.employer.name ?? "—"} (TAN {f.employer.tan ?? "—"})
      </p>
      <DataTable
        caption={`Form 16 months ${financialYear}`}
        rows={f.months}
        getRowKey={(r) => `${r.year}-${r.month}`}
        columns={[
          { header: "Month", cell: (r) => periodLabel(r) },
          {
            header: "Gross",
            cell: (r) => money(r.grossEarnings),
            className: "text-right",
            headerClassName: "text-right",
          },
          {
            header: "Taxable",
            cell: (r) => money(r.taxableEarnings),
            className: "text-right",
            headerClassName: "text-right",
          },
          {
            header: "TDS",
            cell: (r) => money(r.tds),
            className: "text-right",
            headerClassName: "text-right",
          },
        ]}
      />
      <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {(
          [
            ["Taxable salary", money(t.taxableSalary)],
            ["Deductions", money(t.deductions)],
            ["Taxable income", money(t.taxableIncome)],
            ["Tax payable", t.taxPayable === null ? "—" : money(t.taxPayable)],
            ["TDS deducted", money(t.tdsDeducted)],
            ["Previous employer TDS", money(t.previousEmployerTds)],
          ] as const
        ).map(([label, value]) => (
          <div
            key={label}
            className="rounded-lg bg-gray-50 px-3 py-2 dark:bg-gray-800"
          >
            <dt className="text-theme-xs text-gray-500 dark:text-gray-400">
              {label}
            </dt>
            <dd className="text-theme-sm font-medium text-gray-900 dark:text-white/90">
              {value}
            </dd>
          </div>
        ))}
      </dl>
      <p className="text-theme-xs text-gray-500 dark:text-gray-400">
        Part B only — Part A (the TDS certificate) comes from TRACES.
      </p>
      <ServerError message={error} />
      <div>
        <Button
          variant="secondary"
          loading={downloading}
          onClick={() => void download()}
        >
          Download Form 16 (PDF)
        </Button>
      </div>
    </div>
  );
}
