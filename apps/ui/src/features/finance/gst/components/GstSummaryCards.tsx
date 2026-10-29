"use client";

import { useMemo } from "react";
import { ArrowDownLeft, ArrowUpRight, CheckCircle2, Scale } from "lucide-react";
import { formatMoney } from "../../shared/format";
import { useGstReconciliationSummary, useGstr3bSummary } from "../hooks";

export interface GstSummaryCardsProps {
  period: string;
}

export function GstSummaryCards({ period }: GstSummaryCardsProps) {
  const gstr3bQuery = useGstr3bSummary(period);
  const reconQuery = useGstReconciliationSummary(period);

  const gstr3b = gstr3bQuery.data;
  const recon = reconQuery.data;

  const outwardTax = Number(
    gstr3b?.outwardTaxableSupplies?.totalTaxAmount ?? 0,
  );
  const outwardTaxable = Number(
    gstr3b?.outwardTaxableSupplies?.taxableAmount ?? 0,
  );
  const itcTax = Number(gstr3b?.eligibleItc?.totalTaxAmount ?? 0);
  const itcTaxable = Number(gstr3b?.eligibleItc?.taxableAmount ?? 0);
  const netPayable = Number(gstr3b?.netTaxPayable?.totalTaxAmount ?? 0);

  const reconPercentage = useMemo(() => {
    if (recon?.reconciliationPercentage !== undefined) {
      return Math.round(recon.reconciliationPercentage);
    }
    if (recon && recon.totalEntries > 0) {
      return Math.round((recon.reconciledCount / recon.totalEntries) * 100);
    }
    return 100;
  }, [recon]);

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 relative focus-within:z-30">
      {/* 1. Outward Tax Liability */}
      <div className="flex flex-col gap-2 rounded-2xl border border-blue-200/80 bg-linear-to-br from-blue-50/80 via-white to-sky-50/40 p-5 shadow-xs dark:border-blue-900/50 dark:from-blue-950/30 dark:via-gray-900 dark:to-sky-950/20">
        <div className="flex items-center justify-between">
          <span className="text-theme-xs font-semibold tracking-wider text-gray-500 uppercase dark:text-gray-400">
            Outward Tax Liability
          </span>
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 text-white shadow-xs">
            <ArrowUpRight className="h-4.5 w-4.5" aria-hidden="true" />
          </div>
        </div>
        <div className="flex flex-col">
          <span className="text-2xl font-extrabold tracking-tight text-gray-900 dark:text-white">
            {formatMoney(outwardTax)}
          </span>
          <span className="text-theme-xs text-gray-500 dark:text-gray-400 mt-1">
            Taxable supplies: {formatMoney(outwardTaxable)}
          </span>
        </div>
      </div>

      {/* 2. Eligible Input Tax Credit (ITC) */}
      <div className="flex flex-col gap-2 rounded-2xl border border-sky-200/80 bg-linear-to-br from-sky-50/80 via-white to-blue-50/40 p-5 shadow-xs dark:border-sky-900/50 dark:from-sky-950/30 dark:via-gray-900 dark:to-blue-950/20">
        <div className="flex items-center justify-between">
          <span className="text-theme-xs font-semibold tracking-wider text-gray-500 uppercase dark:text-gray-400">
            Eligible Input Tax Credit
          </span>
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#0284c7] text-white shadow-xs">
            <ArrowDownLeft className="h-4.5 w-4.5" aria-hidden="true" />
          </div>
        </div>
        <div className="flex flex-col">
          <span className="text-2xl font-extrabold tracking-tight text-gray-900 dark:text-white">
            {formatMoney(itcTax)}
          </span>
          <span className="text-theme-xs text-gray-500 dark:text-gray-400 mt-1">
            Inward base: {formatMoney(itcTaxable)}
          </span>
        </div>
      </div>

      {/* 3. Net Tax Payable / Liability */}
      <div className="flex flex-col gap-2 rounded-2xl border border-blue-200/80 bg-linear-to-br from-blue-50/80 via-white to-sky-50/40 p-5 shadow-xs dark:border-blue-900/50 dark:from-blue-950/30 dark:via-gray-900 dark:to-sky-950/20">
        <div className="flex items-center justify-between">
          <span className="text-theme-xs font-semibold tracking-wider text-gray-500 uppercase dark:text-gray-400">
            Net Tax Payable
          </span>
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#1769F5] text-white shadow-xs">
            <Scale className="h-4.5 w-4.5" aria-hidden="true" />
          </div>
        </div>
        <div className="flex flex-col">
          <span
            className={`text-2xl font-extrabold tracking-tight ${
              netPayable > 0
                ? "text-blue-700 dark:text-sky-300"
                : "text-emerald-600 dark:text-emerald-400"
            }`}
          >
            {formatMoney(netPayable)}
          </span>
          <span className="text-theme-xs text-gray-500 dark:text-gray-400 mt-1">
            {netPayable > 0
              ? "Payable post ITC set-off"
              : "Nil liability / credit surplus"}
          </span>
        </div>
      </div>

      {/* 4. ITC Reconciliation Status */}
      <div className="flex flex-col gap-2 rounded-2xl border border-teal-200/80 bg-linear-to-br from-teal-50/80 via-white to-sky-50/40 p-5 shadow-xs dark:border-teal-900/50 dark:from-teal-950/30 dark:via-gray-900 dark:to-sky-950/20">
        <div className="flex items-center justify-between">
          <span className="text-theme-xs font-semibold tracking-wider text-gray-500 uppercase dark:text-gray-400">
            ITC Reconciliation Rate
          </span>
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-teal-600 text-white shadow-xs">
            <CheckCircle2 className="h-4.5 w-4.5" aria-hidden="true" />
          </div>
        </div>
        <div className="flex flex-col">
          <span className="text-2xl font-extrabold tracking-tight text-gray-900 dark:text-white">
            {reconPercentage}%
          </span>
          <span className="text-theme-xs text-gray-500 dark:text-gray-400 mt-1">
            {recon
              ? `${recon.reconciledCount} of ${recon.totalEntries} entries verified`
              : "Period GSTR-2B compliance"}
          </span>
        </div>
      </div>
    </div>
  );
}
