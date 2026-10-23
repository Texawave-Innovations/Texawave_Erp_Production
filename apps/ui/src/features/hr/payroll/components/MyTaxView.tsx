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
import { HrPageHeader } from "@/features/hr/components";
import { Calendar, Download, FileText, ShieldCheck } from "lucide-react";
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

  const metricCards = [
    {
      label: "Financial Year",
      value: financialYear,
      subtext: "Assessment cycle",
      Icon: Calendar,
      color: "text-brand-500 bg-sky-50 dark:bg-sky-950/40",
    },
    {
      label: "Tax Regime",
      value: current?.regime
        ? current.regime === "NEW"
          ? "New Regime"
          : "Old Regime"
        : "Not Selected",
      subtext: current ? "Active election" : "Set in declaration",
      Icon: ShieldCheck,
      color: "text-emerald-500 bg-emerald-50 dark:bg-emerald-950/40",
    },
    {
      label: "Declaration Status",
      value: current
        ? current.status === "VERIFIED"
          ? "Verified"
          : current.status === "SUBMITTED"
            ? "Pending Review"
            : current.status === "REJECTED"
              ? "Action Required"
              : "Draft"
        : "Not Started",
      subtext: current?.submittedAt ? "Submitted" : "Needs submission",
      Icon: FileText,
      color: "text-amber-500 bg-amber-50 dark:bg-amber-950/40",
    },
    {
      label: "Form 16 Certificate",
      value: canForm16 ? "Available" : "Restricted",
      subtext: "Annual tax proof",
      Icon: Download,
      color: "text-cyan-600 bg-cyan-50 dark:bg-cyan-950/40",
    },
  ];

  return (
    <div className="flex flex-col gap-6 animate-reveal pb-12">
      {/* 1. Standard Page Header with 3D Compliance Hero */}
      <HrPageHeader
        title="My Tax & Declarations"
        description="Declare tax-saving investments, choose between Old and New regimes, and download annual Form 16 certificates."
        icon3d="compliance"
      />

      {/* 2. Interactive Status Metric Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {metricCards.map((card, idx) => (
          <div
            key={idx}
            className="flex items-center gap-3.5 rounded-2xl border border-sky-200/90 bg-white p-4 text-left shadow-2xs dark:border-slate-700/80 dark:bg-slate-850"
          >
            <div
              className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${card.color}`}
            >
              <card.Icon className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <span className="block text-xs font-semibold text-slate-500 dark:text-slate-400">
                {card.label}
              </span>
              <span className="text-xl font-bold tracking-tight text-[#0a3271] dark:text-white">
                {card.value}
              </span>
              <span className="block text-[11px] font-medium text-slate-400 truncate">
                {card.subtext}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* 3. Compact Financial Year Selector Toolbar */}
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-sky-200/90 bg-white p-3.5 shadow-2xs dark:border-slate-700/80 dark:bg-slate-850">
        <span className="text-xs font-bold text-slate-700 dark:text-slate-200">
          Financial Year:
        </span>
        <div className="w-48">
          <Select
            aria-label="Financial year"
            value={financialYear}
            onChange={(e) => setFinancialYear(e.target.value)}
          >
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </Select>
        </div>
      </div>

      {canRead ? (
        <section
          aria-labelledby="my-declaration-heading"
          className="flex flex-col gap-3"
        >
          <div className="flex items-center justify-between">
            <h2
              id="my-declaration-heading"
              className="text-theme-lg font-bold text-[#0a3271] dark:text-white"
            >
              Tax Declaration ({financialYear})
            </h2>
          </div>
          <QueryState query={query} area="your tax declaration" />
          {query.isSuccess ? (
            <div className="rounded-2xl border border-sky-200/90 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900">
              {/* Remount per year and version so the form starts from what is saved. */}
              <DeclarationForm
                key={`${financialYear}-${current?.version ?? 0}`}
                financialYear={financialYear}
                current={current}
              />
            </div>
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
            className="text-theme-lg font-bold text-[#0a3271] dark:text-white"
          >
            Form 16 Certificate ({financialYear})
          </h2>
          <div className="rounded-2xl border border-sky-200/90 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900">
            <Form16View financialYear={financialYear} employeeId={null} />
          </div>
        </section>
      ) : null}
    </div>
  );
}
