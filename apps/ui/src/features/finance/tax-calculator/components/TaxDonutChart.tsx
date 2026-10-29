"use client";

import React from "react";
import { RegimeTaxResult, TaxRegime } from "../engine/types";
import { formatINR } from "../engine/formatters";

interface Props {
  result: RegimeTaxResult;
  activeRegime: TaxRegime;
  onRegimeChange: (regime: TaxRegime) => void;
}

// Strictly compliant with AGENTS.md: TexaOne Prime Blue, Cyan, Sky, Emerald, Amber, Slate (NO purple/indigo)
const SLAB_COLORS = [
  "#1769F5", // TexaOne Prime Blue
  "#0284c7", // Sky Blue
  "#12CFE3", // Cyan
  "#0d9488", // Teal
  "#10b981", // Emerald
  "#f59e0b", // Amber
  "#64748b", // Slate
];

export function TaxDonutChart({ result, activeRegime, onRegimeChange }: Props) {
  const activeSlabs = result.slabBreakdown.filter((s) => s.taxGenerated > 0);
  const totalTax = result.totalTaxLiability;
  const isZeroTax = totalTax === 0;

  // Build segments data
  const segments: {
    label: string;
    amount: number;
    color: string;
    pct: number;
  }[] = [];

  if (isZeroTax) {
    segments.push({
      label: "Zero Tax (Rebate S. 87A)",
      amount: 0,
      color: "#10b981",
      pct: 100,
    });
  } else {
    activeSlabs.forEach((slab, idx) => {
      const pct = Math.max(1, (slab.taxGenerated / totalTax) * 100);
      segments.push({
        label: `${slab.ratePercent}% Slab`,
        amount: slab.taxGenerated,
        color: SLAB_COLORS[idx % SLAB_COLORS.length] ?? "#1769F5",
        pct,
      });
    });

    if (result.healthAndEducationCess > 0) {
      const cessPct = Math.max(
        1,
        (result.healthAndEducationCess / totalTax) * 100,
      );
      segments.push({
        label: "Cess (4%)",
        amount: result.healthAndEducationCess,
        color: "#12CFE3",
        pct: cessPct,
      });
    }

    if (result.surchargeAmount > 0) {
      const surPct = Math.max(1, (result.surchargeAmount / totalTax) * 100);
      segments.push({
        label: "Surcharge",
        amount: result.surchargeAmount,
        color: "#f59e0b",
        pct: surPct,
      });
    }
  }

  // Calculate SVG stroke-dasharray & stroke-dashoffset for the circular donut
  const radius = 54;
  const circumference = 2 * Math.PI * radius; // ~339.29
  let accumulatedOffset = 0;

  return (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm flex flex-col justify-between">
      {/* Header with Title & Regime Switcher */}
      <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800">
        <h4 className="font-bold text-sm text-slate-900 dark:text-slate-100">
          Tax Composition (
          {activeRegime === "new" ? "New Regime" : "Old Regime"})
        </h4>
        <select
          value={activeRegime}
          onChange={(e) => onRegimeChange(e.target.value as TaxRegime)}
          className="text-xs font-semibold px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 cursor-pointer focus:outline-none"
        >
          <option value="new">New Regime</option>
          <option value="old">Old Regime</option>
        </select>
      </div>

      {/* Donut & Legend Container */}
      <div className="flex flex-col sm:flex-row items-center justify-center gap-6 py-4">
        {/* SVG Donut */}
        <div className="relative w-36 h-36 shrink-0 flex items-center justify-center">
          <svg
            className="w-full h-full -rotate-90 transform"
            viewBox="0 0 140 140"
          >
            {/* Background Track Circle */}
            <circle
              cx="70"
              cy="70"
              r={radius}
              stroke="currentColor"
              strokeWidth="14"
              fill="transparent"
              className="text-slate-100 dark:text-slate-800"
            />

            {/* Segment Circles */}
            {isZeroTax ? (
              <circle
                cx="70"
                cy="70"
                r={radius}
                stroke="#10b981"
                strokeWidth="14"
                fill="transparent"
                strokeDasharray={`${circumference} ${circumference}`}
                strokeDashoffset="0"
                strokeLinecap="round"
              />
            ) : (
              segments.map((seg, idx) => {
                const strokeLength = (seg.pct / 100) * circumference;
                const offset = -accumulatedOffset;
                accumulatedOffset += strokeLength;
                return (
                  <circle
                    key={idx}
                    cx="70"
                    cy="70"
                    r={radius}
                    stroke={seg.color}
                    strokeWidth="14"
                    fill="transparent"
                    strokeDasharray={`${strokeLength} ${circumference}`}
                    strokeDashoffset={offset}
                    className="transition-all duration-700 ease-out"
                  />
                );
              })
            )}
          </svg>

          {/* Center Text in Donut */}
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none px-2">
            <span className="font-extrabold text-sm sm:text-base text-slate-900 dark:text-slate-100 leading-tight">
              {formatINR(totalTax)}
            </span>
            <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mt-0.5">
              Total Tax
            </span>
          </div>
        </div>

        {/* Legend List */}
        <div className="space-y-2 text-xs w-full max-w-[210px]">
          {isZeroTax ? (
            <div className="flex items-center justify-between text-slate-600 dark:text-slate-400">
              <span className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-600 shrink-0" />
                <span>Rebate 87A:</span>
              </span>
              <span className="font-bold text-emerald-700 dark:text-emerald-400">
                100% Tax Free
              </span>
            </div>
          ) : (
            segments.map((seg, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between text-slate-600 dark:text-slate-400"
              >
                <span className="flex items-center gap-2">
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: seg.color }}
                  />
                  <span>{seg.label}</span>
                </span>
                <span className="font-bold text-slate-900 dark:text-slate-100">
                  {formatINR(seg.amount)}
                </span>
              </div>
            ))
          )}

          {result.section87ARebate > 0 && (
            <div className="flex items-center justify-between text-slate-600 dark:text-slate-400 pt-1 border-t border-slate-200 dark:border-slate-800 text-[11px]">
              <span className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-slate-400 shrink-0" />
                <span>Rebate (87A)</span>
              </span>
              <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                -{formatINR(result.section87ARebate)}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
