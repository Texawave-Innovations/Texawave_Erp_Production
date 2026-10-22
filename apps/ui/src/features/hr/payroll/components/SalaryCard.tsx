"use client";

import { useMemo, useState } from "react";
import {
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Coins,
  Edit2,
  FileText,
  Layers,
  TrendingUp,
} from "lucide-react";
import { Button } from "@texawave-erp/ui-kit";
import { money } from "../format";
import type { Salary } from "../types";

export interface SalaryCardProps {
  salary: Salary;
  canWrite: boolean;
  onEdit: (salary: Salary) => void;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
}

function formatHumanDate(dateStr: string | null | undefined): string {
  if (!dateStr || dateStr === "—") return "—";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return dateStr;
  }
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0 || !parts[0]) return "—";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  const first = parts[0][0] ?? "";
  const last = parts[parts.length - 1]?.[0] ?? "";
  return `${first}${last}`.toUpperCase();
}

export function SalaryCard({
  salary,
  canWrite,
  onEdit,
  isExpanded: externalIsExpanded,
  onToggleExpand: externalToggle,
}: SalaryCardProps) {
  const [internalExpanded, setInternalExpanded] = useState(false);
  const isExpanded = externalIsExpanded ?? internalExpanded;
  const toggleExpand = externalToggle ?? (() => setInternalExpanded((v) => !v));

  const todayStr = new Date().toISOString().slice(0, 10);
  const isInForce =
    salary.effectiveFrom <= todayStr &&
    (!salary.effectiveTo || salary.effectiveTo >= todayStr);

  const isFuture = salary.effectiveFrom > todayStr;

  const { earnings, deductions, totalDeductions, estimatedNet } =
    useMemo(() => {
      const sorted = [...salary.components].sort(
        (a, b) => a.component.displayOrder - b.component.displayOrder,
      );
      const earn = sorted.filter((c) => c.component.kind === "EARNING");
      const ded = sorted.filter((c) => c.component.kind === "DEDUCTION");
      const dedTotal = ded.reduce(
        (acc, c) => acc + Number(c.monthlyAmount || 0),
        0,
      );
      const gross = Number(salary.grossMonthly || 0);
      const net = Math.max(0, gross - dedTotal);

      return {
        earnings: earn,
        deductions: ded,
        totalDeductions: dedTotal,
        estimatedNet: net,
      };
    }, [salary]);

  const arrearsNumber = Number(salary.arrearsSalary || 0);
  const hasArrears = arrearsNumber > 0;
  const isArrearsPaid = Boolean(salary.arrearsPaidPeriodId);

  return (
    <div
      className={`rounded-2xl transition-all duration-200 ${
        isExpanded
          ? "border-2 border-brand-500/80 bg-white shadow-lg ring-4 ring-brand-500/10 dark:border-brand-400 dark:bg-slate-900"
          : "border border-slate-200/90 bg-white shadow-2xs hover:border-brand-300 hover:shadow-md dark:border-slate-800 dark:bg-slate-900/90"
      }`}
    >
      {/* Main Header / Summary Row */}
      <div className="flex flex-col gap-4 p-4 sm:p-5 lg:flex-row lg:items-center lg:justify-between">
        {/* 1. Employee Identity (Avatar, Name, Code, and Status Badge) */}
        <div className="flex min-w-0 items-center gap-3.5 lg:w-[32%]">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-sky-200/80 bg-sky-50 font-bold text-sm text-[#0a3271] shadow-2xs dark:border-sky-800 dark:bg-sky-950/60 dark:text-sky-300">
            {getInitials(salary.employee.fullName)}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-bold text-gray-900 truncate dark:text-white">
                {salary.employee.fullName}
              </h3>
              {isInForce ? (
                <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  In Force
                </span>
              ) : isFuture ? (
                <span className="inline-flex items-center gap-1 rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 text-[10px] font-bold text-brand-700 dark:border-sky-800 dark:bg-sky-950/50 dark:text-sky-300">
                  <Clock className="h-3 w-3" />
                  Scheduled
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">
                  Historical
                </span>
              )}
            </div>
            <p className="mt-0.5 text-xs font-semibold text-slate-500 dark:text-slate-400">
              {salary.employee.employeeCode}
            </p>
          </div>
        </div>

        {/* 2. Validity Dates & Structure Information */}
        <div className="flex flex-col gap-1.5 lg:w-[30%]">
          <div className="flex items-center gap-1.5 text-xs text-slate-700 dark:text-slate-300">
            <Calendar className="h-3.5 w-3.5 text-brand-500 shrink-0" />
            <span className="font-bold text-gray-800 dark:text-gray-200">
              {formatHumanDate(salary.effectiveFrom)}
            </span>
            <span className="text-slate-400">to</span>
            <span className="font-bold text-gray-800 dark:text-gray-200">
              {salary.effectiveTo
                ? formatHumanDate(salary.effectiveTo)
                : "Present (Open)"}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-[11px]">
            {salary.salaryTemplate ? (
              <span className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 font-medium text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                <FileText className="h-3 w-3 text-brand-500" />
                {salary.salaryTemplate.name}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-md bg-slate-50 px-2 py-0.5 text-[11px] font-medium text-slate-500 dark:bg-slate-800/80 dark:text-slate-400">
                Custom structure
              </span>
            )}

            {salary.revisionLetter ? (
              <span className="inline-flex items-center gap-1 rounded-md bg-sky-50 px-2 py-0.5 text-brand-700 dark:bg-sky-950 dark:text-sky-300 font-medium">
                Doc: {salary.revisionLetter.documentNo}
              </span>
            ) : null}

            {hasArrears ? (
              <span
                className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 font-semibold ${
                  isArrearsPaid
                    ? "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                    : "bg-amber-50 text-amber-800 border border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-900"
                }`}
              >
                <Coins className="h-3 w-3" />
                Arrears: {money(salary.arrearsSalary)}{" "}
                {isArrearsPaid ? "(Paid)" : "(Pending)"}
              </span>
            ) : null}
          </div>
        </div>

        {/* 3. Gross Monthly & CTC */}
        <div className="flex flex-col items-start lg:items-end lg:w-[18%]">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
            Gross Monthly
          </span>
          <span className="text-lg font-extrabold text-[#0a3271] dark:text-white leading-tight">
            {money(salary.grossMonthly)}
          </span>
          <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
            CTC: {money(Number(salary.grossMonthly) * 12)} / yr
          </span>
        </div>

        {/* 4. Action Buttons */}
        <div className="flex items-center justify-between lg:justify-end gap-2 shrink-0 border-t border-slate-100 pt-3 lg:border-t-0 lg:pt-0 lg:w-[20%] dark:border-slate-800">
          <button
            type="button"
            onClick={toggleExpand}
            aria-expanded={isExpanded}
            className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold transition-all active:scale-95 ${
              isExpanded
                ? "bg-brand-500 text-white shadow-xs hover:bg-brand-600"
                : "border border-sky-200 bg-sky-50 text-[#0a3271] hover:bg-sky-100 hover:text-[#0a3271] dark:border-sky-800 dark:bg-slate-800 dark:text-sky-200 dark:hover:bg-slate-700"
            }`}
          >
            <span>{isExpanded ? "Hide Breakdown" : "View Breakdown"}</span>
            {isExpanded ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </button>

          {canWrite ? (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => onEdit(salary)}
              className="rounded-xl font-semibold border-sky-200 hover:bg-sky-50 text-xs px-3"
            >
              <Edit2 className="mr-1 h-3.5 w-3.5 text-brand-600" />
              Edit
            </Button>
          ) : null}
        </div>
      </div>

      {/* Expanded Salary Components Breakdown */}
      {isExpanded ? (
        <div className="space-y-4 rounded-b-2xl border-t border-slate-100 bg-slate-50/50 p-4 sm:p-6 dark:border-slate-800 dark:bg-slate-900/50">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {/* Earnings Breakdown */}
            <div className="rounded-xl border border-emerald-200/80 bg-white p-4 shadow-2xs dark:border-emerald-900/60 dark:bg-slate-800/80">
              <div className="flex items-center justify-between border-b border-emerald-100 pb-2.5 dark:border-emerald-900/40">
                <div className="flex items-center gap-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400">
                    <TrendingUp className="h-4 w-4" />
                  </div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-300">
                    Earnings Components
                  </h4>
                </div>
                <span className="text-xs font-extrabold text-emerald-700 dark:text-emerald-400">
                  {money(salary.grossMonthly)}
                </span>
              </div>

              <div className="mt-3 divide-y divide-slate-100 dark:divide-slate-700/60">
                {earnings.length > 0 ? (
                  earnings.map((c) => (
                    <div
                      key={c.component.id}
                      className="flex items-center justify-between py-2 text-xs"
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-800 dark:text-gray-200">
                          {c.component.name}
                        </span>
                        <span className="rounded-sm bg-slate-100 px-1.5 py-0.2 text-[10px] font-semibold text-slate-500 dark:bg-slate-700 dark:text-slate-400">
                          {c.component.code}
                        </span>
                      </div>
                      <span className="font-bold text-gray-900 dark:text-white">
                        {money(c.monthlyAmount)}
                      </span>
                    </div>
                  ))
                ) : (
                  <p className="py-2 text-xs text-slate-400">
                    No individual earning components specified.
                  </p>
                )}
              </div>
            </div>

            {/* Deductions Breakdown */}
            <div className="rounded-xl border border-sky-200/80 bg-white p-4 shadow-2xs dark:border-sky-900/60 dark:bg-slate-800/80">
              <div className="flex items-center justify-between border-b border-sky-100 pb-2.5 dark:border-sky-900/40">
                <div className="flex items-center gap-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-sky-50 text-brand-600 dark:bg-sky-950 dark:text-sky-300">
                    <Layers className="h-4 w-4" />
                  </div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-[#0a3271] dark:text-sky-300">
                    Deductions & Statutory
                  </h4>
                </div>
                <span className="text-xs font-extrabold text-rose-600 dark:text-rose-400">
                  − {money(totalDeductions)}
                </span>
              </div>

              <div className="mt-3 divide-y divide-slate-100 dark:divide-slate-700/60">
                {deductions.length > 0 ? (
                  deductions.map((c) => (
                    <div
                      key={c.component.id}
                      className="flex items-center justify-between py-2 text-xs"
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-800 dark:text-gray-200">
                          {c.component.name}
                        </span>
                        <span className="rounded-sm bg-slate-100 px-1.5 py-0.2 text-[10px] font-semibold text-slate-500 dark:bg-slate-700 dark:text-slate-400">
                          {c.component.code}
                        </span>
                      </div>
                      <span className="font-bold text-rose-600 dark:text-rose-400">
                        {money(c.monthlyAmount)}
                      </span>
                    </div>
                  ))
                ) : (
                  <p className="py-3 text-xs text-slate-400">
                    No fixed deduction lines (statutory PF/ESI calculated during
                    payroll run).
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Bottom Net Estimate Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3.5 dark:border-slate-800 dark:bg-slate-800">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-brand-500" />
              <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
                Estimated Net Take-Home (excluding variable attendance & taxes):
              </span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-slate-500">
                Gross: <strong>{money(salary.grossMonthly)}</strong>
              </span>
              <span className="text-xs text-rose-500">
                Ded: <strong>−{money(totalDeductions)}</strong>
              </span>
              <span className="rounded-lg bg-emerald-50 px-2.5 py-1 text-xs font-extrabold text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
                Net: {money(estimatedNet)} / mo
              </span>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
