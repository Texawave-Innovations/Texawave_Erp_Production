"use client";

import {
  Calendar,
  CheckCircle2,
  Clock,
  Coins,
  FileText,
  User,
  XCircle,
} from "lucide-react";
import { Button } from "@texawave-erp/ui-kit";
import { isoDate, money, periodLabel } from "../format";
import type { Bonus, BonusType } from "../types";
import { StatusPill } from "./PayrollStatusBadge";

export interface BonusCardProps {
  bonus: Bonus;
  mayDecide: boolean;
  canApprove: boolean;
  onApprove: (bonus: Bonus) => void;
  onReject: (bonus: Bonus) => void;
}

const TYPE_LABEL: Record<BonusType, string> = {
  FESTIVAL: "Festival Bonus",
  PERFORMANCE: "Performance Bonus",
  STATUTORY: "Statutory Bonus",
  ANNUAL: "Annual Bonus",
  SPOT: "Spot Award",
  GRATUITY: "Gratuity Settlement",
};

const TYPE_BADGE_STYLE: Record<BonusType, string> = {
  FESTIVAL:
    "border-sky-200 bg-sky-50 text-[#0284c7] dark:border-sky-800 dark:bg-sky-950/50 dark:text-sky-300",
  PERFORMANCE:
    "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300",
  STATUTORY:
    "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950/50 dark:text-blue-300",
  ANNUAL:
    "border-cyan-200 bg-cyan-50 text-cyan-800 dark:border-cyan-800 dark:bg-cyan-950/50 dark:text-cyan-300",
  SPOT: "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-300",
  GRATUITY:
    "border-slate-300 bg-slate-100 text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200",
};

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0 || !parts[0]) return "—";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  const first = parts[0][0] ?? "";
  const last = parts[parts.length - 1]?.[0] ?? "";
  return `${first}${last}`.toUpperCase();
}

export function BonusCard({
  bonus,
  mayDecide,
  canApprove,
  onApprove,
  onReject,
}: BonusCardProps) {
  const badgeStyle =
    TYPE_BADGE_STYLE[bonus.bonusType] ??
    "border-slate-200 bg-slate-50 text-slate-700";

  return (
    <div className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-2xs transition-all hover:border-brand-300 hover:shadow-md sm:p-5 dark:border-slate-800 dark:bg-slate-900/90">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        {/* 1. Employee Identity */}
        <div className="flex min-w-0 items-center gap-3.5 lg:w-[30%]">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-sky-200/80 bg-sky-50 text-sm font-bold text-[#0a3271] shadow-2xs dark:border-sky-800 dark:bg-sky-950/60 dark:text-sky-300">
            {getInitials(bonus.employee.fullName)}
          </div>

          <div className="min-w-0 flex-1">
            <h3 className="truncate text-sm font-bold text-gray-900 dark:text-white">
              {bonus.employee.fullName}
            </h3>
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              {bonus.employee.employeeCode}
            </p>
          </div>
        </div>

        {/* 2. Bonus Category & Payment Period */}
        <div className="flex flex-col gap-1.5 lg:w-[28%]">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-bold ${badgeStyle}`}
            >
              <Coins className="h-3 w-3" />
              {TYPE_LABEL[bonus.bonusType] ?? bonus.bonusType}
            </span>

            <StatusPill status={bonus.status} />
          </div>

          <div className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400">
            <Calendar className="h-3.5 w-3.5 text-slate-400 shrink-0" />
            <span>
              {bonus.payrollPeriod ? (
                <>
                  Paid with{" "}
                  <strong className="font-semibold text-gray-800 dark:text-gray-200">
                    {periodLabel(bonus.payrollPeriod)}
                  </strong>
                </>
              ) : (
                <span className="text-slate-400 italic">
                  No period assigned
                </span>
              )}
            </span>
          </div>

          {bonus.reason ? (
            <p
              className="line-clamp-1 text-[11px] text-slate-500 dark:text-slate-400"
              title={bonus.reason}
            >
              Note: {bonus.reason}
            </p>
          ) : null}
        </div>

        {/* 3. Bonus Amount & Approver Metadata */}
        <div className="flex flex-col items-start lg:items-end lg:w-[20%]">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
            Bonus Amount
          </span>
          <span className="text-lg font-extrabold text-[#0a3271] dark:text-white leading-tight">
            {money(bonus.amount)}
          </span>

          {bonus.approver ? (
            <span className="text-[11px] text-slate-500 dark:text-slate-400">
              Decided by {bonus.approver.fullName}
              {bonus.approvedAt ? ` · ${isoDate(bonus.approvedAt)}` : ""}
            </span>
          ) : (
            <span className="text-[11px] text-amber-600 dark:text-amber-400 font-medium">
              Awaiting decision
            </span>
          )}
        </div>

        {/* 4. Maker-Checker Decisions & Actions */}
        <div className="flex items-center justify-between lg:justify-end gap-2 shrink-0 border-t border-slate-100 pt-3 lg:border-t-0 lg:pt-0 lg:w-[22%] dark:border-slate-800">
          {mayDecide ? (
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                onClick={() => onApprove(bonus)}
                className="rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs px-3 shadow-2xs"
              >
                <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
                Approve
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={() => onReject(bonus)}
                className="rounded-xl text-xs px-3"
              >
                <XCircle className="mr-1 h-3.5 w-3.5" />
                Reject
              </Button>
            </div>
          ) : canApprove && bonus.status === "PENDING" ? (
            <span className="rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300">
              Maker-checker: need another approver
            </span>
          ) : (
            <span className="text-xs text-slate-400">
              {bonus.status === "PAID" ? "Disbursed with payslip" : "Recorded"}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
