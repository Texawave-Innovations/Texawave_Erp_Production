"use client";

import { ApiError } from "@texawave-erp/core";
import {
  Alert,
  Button,
  Card,
  FormField,
  Select,
  useToast,
} from "@texawave-erp/ui-kit";
import { useState } from "react";
import { usePermission } from "@/hooks/usePermission";
import { describeError, recentFinancialYears, timestamp } from "../format";
import { useMyDeclarations, useSaveMyDeclaration } from "../hooks";
import {
  MY_FORM16_READ,
  MY_TAX_DECLARATION_READ,
  MY_TAX_DECLARATION_WRITE,
} from "../permissions";
import type { TaxDeclaration } from "../types";
import { ServerError } from "./DialogParts";
import { StatusPill } from "./PayrollStatusBadge";
import { QueryState } from "./QueryState";
import {
  DeclarationFields,
  declarationAmounts,
  declarationDraft,
  Form16View,
} from "./TaxDeclarationParts";

const EDITABLE = new Set(["DRAFT", "REJECTED"]);

function DeclarationForm({
  financialYear,
  current,
}: {
  financialYear: string;
  current: TaxDeclaration | null;
}) {
  const canWrite = usePermission(MY_TAX_DECLARATION_WRITE);
  const save = useSaveMyDeclaration();
  const { toast } = useToast();
  const [draft, setDraft] = useState(() => declarationDraft(current));
  const [error, setError] = useState<string | null>(null);
  const editable = canWrite && (!current || EDITABLE.has(current.status));

  async function run(submit: boolean) {
    const parsed = declarationAmounts(draft);
    if ("error" in parsed) {
      setError(parsed.error);
      return;
    }
    setError(null);
    try {
      await save.mutateAsync({
        financialYear,
        body: {
          version: current?.version ?? 0,
          regime: draft.regime,
          ...parsed.amounts,
          submit,
        },
      });
      toast({
        title: submit
          ? "Declaration submitted for verification"
          : "Declaration saved as a draft",
        variant: "success",
      });
    } catch (err) {
      setError(describeError(err));
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {current ? (
        <div className="flex flex-wrap items-center gap-2 text-theme-sm text-gray-700 dark:text-gray-300">
          <StatusPill status={current.status} />
          {current.submittedAt
            ? `Submitted ${timestamp(current.submittedAt)}`
            : null}
          {current.verifier
            ? ` · ${current.status === "REJECTED" ? "rejected" : "verified"} by ${current.verifier.fullName}`
            : null}
        </div>
      ) : null}
      {current?.status === "REJECTED" && current.verificationNote ? (
        <Alert variant="warning" title="Returned by HR">
          {current.verificationNote} — correct it and submit again.
        </Alert>
      ) : null}
      {current && !EDITABLE.has(current.status) ? (
        <Alert variant="info" title="Locked">
          A {current.status.toLowerCase()} declaration can no longer be changed.
          Ask HR if something is wrong.
        </Alert>
      ) : null}
      <DeclarationFields
        draft={draft}
        onChange={setDraft}
        disabled={!editable}
      />
      <ServerError message={error} />
      {editable ? (
        <div className="flex justify-end gap-2">
          <Button
            variant="secondary"
            disabled={save.isPending}
            onClick={() => void run(false)}
          >
            Save draft
          </Button>
          <Button loading={save.isPending} onClick={() => void run(true)}>
            Submit for verification
          </Button>
        </div>
      ) : null}
    </div>
  );
}

/**
 * Portal → My tax: the employee's own income-tax declaration per financial
 * year and their Form 16 (Docs/PAYROLL_AND_COMPLIANCE.md §4.13, §4.14).
 * Self-service codes only; the API returns only the caller's own records.
 */
export function MyTaxView() {
  const canRead = usePermission(MY_TAX_DECLARATION_READ);
  const canForm16 = usePermission(MY_FORM16_READ);
  const years = recentFinancialYears(4);
  const [financialYear, setFinancialYear] = useState(years[0] ?? "");
  const query = useMyDeclarations(canRead);
  const current =
    query.data?.find((d) => d.financialYear === financialYear) ?? null;

  if (!canRead && !canForm16) {
    return (
      <Alert variant="warning" title="No access">
        Ask HR for access to your tax declaration and Form 16.
      </Alert>
    );
  }
  if (
    query.error instanceof ApiError &&
    query.error.errorCode === "NOT_AN_EMPLOYEE"
  ) {
    return (
      <Alert variant="info" title="No employee record">
        Your account is not linked to an employee record.
      </Alert>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-theme-xl font-semibold text-gray-900 dark:text-white/90">
          My tax
        </h1>
        <p className="text-theme-sm text-gray-600 dark:text-gray-400">
          Declare your investments and other income so the right TDS is deducted
          from your salary, and download your Form 16.
        </p>
      </header>
      <Card>
        <FormField label="Financial year">
          {(f) => (
            <Select
              {...f}
              className="w-36"
              value={financialYear}
              onChange={(e) => setFinancialYear(e.target.value)}
            >
              {years.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </Select>
          )}
        </FormField>
      </Card>
      {canRead ? (
        <section
          aria-labelledby="my-declaration-heading"
          className="flex flex-col gap-3"
        >
          <h2
            id="my-declaration-heading"
            className="text-theme-lg font-semibold text-gray-900 dark:text-white/90"
          >
            Tax declaration
          </h2>
          <QueryState query={query} area="your tax declaration" />
          {query.isSuccess ? (
            <Card>
              {/* Remount per year and version so the form starts from what is saved. */}
              <DeclarationForm
                key={`${financialYear}-${current?.version ?? 0}`}
                financialYear={financialYear}
                current={current}
              />
            </Card>
          ) : null}
        </section>
      ) : null}
      {canForm16 ? (
        <section
          aria-labelledby="my-form16-heading"
          className="flex flex-col gap-3"
        >
          <h2
            id="my-form16-heading"
            className="text-theme-lg font-semibold text-gray-900 dark:text-white/90"
          >
            Form 16
          </h2>
          <Card>
            <Form16View financialYear={financialYear} employeeId={null} />
          </Card>
        </section>
      ) : null}
    </div>
  );
}
