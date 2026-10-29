"use client";

import React, { useState } from "react";
import { ComparisonResult, TaxRegime } from "../engine/types";
import { formatINR, formatPercentage } from "../engine/formatters";
import { TaxDonutChart } from "./TaxDonutChart";
import { TaxSlabRail } from "./TaxSlabRail";
import {
  Calendar,
  Edit3,
  Landmark,
  Zap,
  CheckCircle2,
  TrendingDown,
} from "lucide-react";

interface Props {
  comparison: ComparisonResult;
  onEditDetails: () => void;
}

export function TaxResultSection({ comparison, onEditDetails }: Props) {
  const [donutRegime, setDonutRegime] = useState<TaxRegime>("new");
  const { oldRegime, newRegime, taxDifference, lowerTaxRegime, financialYear } =
    comparison;

  const donutResult = donutRegime === "new" ? newRegime : oldRegime;

  return (
    <div id="results-section" className="mt-12 space-y-8 text-left">
      {/* Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h3 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100">
            Comparative Tax Computation Result
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Side-by-side comparison of Section 115BAC New Regime vs Chapter VI-A
            Old Regime.
          </p>
        </div>

        <div className="flex items-center gap-2.5 self-start sm:self-auto">
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300">
            <Calendar size={13} />
            <span>FY {financialYear}</span>
          </div>

          <button
            type="button"
            onClick={onEditDetails}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-750 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 transition-all cursor-pointer shadow-xs hover:border-blue-500"
          >
            <Edit3 size={13} />
            <span>Edit Inputs</span>
          </button>
        </div>
      </div>

      {/* Top Row: 3 Comparison Cards (Left) + Donut Chart (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Left Column: 3 Cards Grid (7 Cols on LG) */}
        <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Card 1: Recommended Regime */}
          <div className="rounded-2xl border border-emerald-300 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/20 p-5 flex flex-col items-center text-center justify-between shadow-xs">
            <div className="w-full flex flex-col items-center">
              {/* Header Badge */}
              <div className="h-9 flex items-center justify-center">
                <div className="inline-flex items-center justify-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-300 font-bold text-[10px] uppercase tracking-wider whitespace-nowrap">
                  <CheckCircle2
                    size={12}
                    className="text-emerald-600 dark:text-emerald-400"
                  />
                  <span>Optimal Regime</span>
                </div>
              </div>

              {/* Amount Group */}
              <div className="my-auto py-3">
                <span className="text-xs text-slate-600 dark:text-slate-400 font-medium block">
                  {lowerTaxRegime === "equal"
                    ? "Both Regimes Yield"
                    : "Tax Saved"}
                </span>
                <span className="font-extrabold text-2xl sm:text-3xl text-emerald-800 dark:text-emerald-300 tracking-tight mt-1.5 block">
                  {lowerTaxRegime === "equal"
                    ? "Equal Tax"
                    : formatINR(taxDifference)}
                </span>
              </div>
            </div>

            <div className="w-full text-center text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 mt-4 pt-3 border-t border-emerald-200 dark:border-emerald-900/50 flex items-center justify-center gap-1">
              <TrendingDown size={13} />
              <span>
                {lowerTaxRegime === "new"
                  ? "Lower with New Regime (115BAC)"
                  : lowerTaxRegime === "old"
                    ? "Lower with Old Regime (Chapter VI-A)"
                    : "Identical liability across regimes"}
              </span>
            </div>
          </div>

          {/* Card 2: Old Regime */}
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 flex flex-col items-center text-center justify-between shadow-xs">
            <div className="w-full flex flex-col items-center">
              {/* Header Badge */}
              <div className="h-9 flex items-center justify-center">
                <div className="inline-flex items-center justify-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-bold text-[10px] uppercase tracking-wider whitespace-nowrap">
                  <Landmark size={12} className="text-slate-500" />
                  <span>Old Regime</span>
                </div>
              </div>

              {/* Amount Group */}
              <div className="my-auto py-3">
                <span className="text-xs text-slate-500 font-medium block">
                  Total Tax Payable
                </span>
                <span className="font-extrabold text-2xl sm:text-3xl text-slate-900 dark:text-slate-100 tracking-tight mt-1.5 block">
                  {formatINR(oldRegime.totalTaxLiability)}
                </span>
              </div>
            </div>

            <div className="w-full text-center text-[11px] text-slate-500 mt-4 pt-3 border-t border-slate-200 dark:border-slate-800">
              Effective Rate:{" "}
              <strong className="text-slate-800 dark:text-slate-200">
                {formatPercentage(oldRegime.effectiveTaxRate)}
              </strong>
            </div>
          </div>

          {/* Card 3: New Regime */}
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 flex flex-col items-center text-center justify-between shadow-xs">
            <div className="w-full flex flex-col items-center">
              {/* Header Badge */}
              <div className="h-9 flex items-center justify-center">
                <div className="inline-flex items-center justify-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 font-bold text-[10px] uppercase tracking-wider whitespace-nowrap">
                  <Zap size={12} className="text-blue-600" />
                  <span>New Regime (115BAC)</span>
                </div>
              </div>

              {/* Amount Group */}
              <div className="my-auto py-3">
                <span className="text-xs text-slate-500 font-medium block">
                  Total Tax Payable
                </span>
                <span className="font-extrabold text-2xl sm:text-3xl text-slate-900 dark:text-slate-100 tracking-tight mt-1.5 block">
                  {formatINR(newRegime.totalTaxLiability)}
                </span>
              </div>
            </div>

            <div className="w-full text-center text-[11px] text-slate-500 mt-4 pt-3 border-t border-slate-200 dark:border-slate-800">
              Effective Rate:{" "}
              <strong className="text-slate-800 dark:text-slate-200">
                {formatPercentage(newRegime.effectiveTaxRate)}
              </strong>
            </div>
          </div>
        </div>

        {/* Right Column: Tax Donut Chart (5 Cols on LG) */}
        <div className="lg:col-span-5 flex flex-col">
          <TaxDonutChart
            result={donutResult}
            activeRegime={donutRegime}
            onRegimeChange={setDonutRegime}
          />
        </div>
      </div>

      {/* Bottom Row: Progressive Tax Slab Rail (Full Width) */}
      <TaxSlabRail taxableIncome={newRegime.taxableIncome} />
    </div>
  );
}
