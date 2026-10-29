"use client";

import React from "react";
import { formatINR } from "../engine/formatters";

interface Props {
  taxableIncome: number;
}

export function TaxSlabRail({ taxableIncome }: Props) {
  // Slabs ceiling: 24 Lakh +
  // Position mapped from 0 to 2,400,000 (with max cap 2,800,000)
  const maxScale = 2_400_000;
  const clampedPercent = Math.min(
    96,
    Math.max(4, (taxableIncome / maxScale) * 100),
  );

  const milestones = [
    { label: "₹0", rate: "0%", pct: 0 },
    { label: "₹4L", rate: "0%", pct: (400_000 / maxScale) * 100 },
    { label: "₹8L", rate: "5%", pct: (800_000 / maxScale) * 100 },
    { label: "₹12L", rate: "10%", pct: (1_200_000 / maxScale) * 100 },
    { label: "₹16L", rate: "15%", pct: (1_600_000 / maxScale) * 100 },
    { label: "₹20L", rate: "20%", pct: (2_000_000 / maxScale) * 100 },
    { label: "₹24L", rate: "25%", pct: (2_400_000 / maxScale) * 100 },
    { label: ">₹24L", rate: "30%", pct: 100 },
  ];

  return (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 sm:p-8 shadow-sm">
      <div className="flex items-center justify-between pb-6 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h4 className="font-bold text-sm sm:text-base text-slate-900 dark:text-slate-100">
            Progressive Tax Slab Bracket (Section 115BAC New Regime)
          </h4>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Your taxable income plotted across statutory Finance Act progressive
            tiers.
          </p>
        </div>
        <span className="text-xs font-bold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 px-3 py-1 rounded-full">
          Taxable: {formatINR(taxableIncome)}
        </span>
      </div>

      {/* Track & Dynamic Marker Pin */}
      <div className="relative pt-12 pb-8 px-2 sm:px-4">
        {/* Dynamic Tooltip Marker Pin */}
        <div
          className="absolute top-1 -translate-x-1/2 flex flex-col items-center transition-all duration-500 ease-out z-20 pointer-events-none"
          style={{ left: `${clampedPercent}%` }}
        >
          <div className="px-3 py-1 rounded-full bg-blue-600 text-white font-bold text-[11px] shadow-md whitespace-nowrap flex items-center gap-1.5">
            <span>Taxable Income:</span>
            <span>{formatINR(taxableIncome)}</span>
          </div>
          {/* Downward triangle pointer */}
          <div className="w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[7px] border-t-blue-600" />
        </div>

        {/* The Track Rail Line */}
        <div className="relative h-2.5 w-full rounded-full bg-slate-200 dark:bg-slate-800">
          {/* Active filled gradient portion */}
          <div
            className="absolute top-0 left-0 h-full rounded-full bg-gradient-to-r from-blue-600 via-sky-500 to-cyan-400 transition-all duration-500"
            style={{ width: `${clampedPercent}%` }}
          />

          {/* Tick Checkpoints */}
          {milestones.map((m, idx) => (
            <div
              key={idx}
              className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 flex flex-col items-center"
              style={{ left: `${m.pct}%` }}
            >
              <div
                className={`w-3.5 h-3.5 rounded-full border-2 transition-all ${
                  taxableIncome >= (idx === 0 ? 0 : idx * 400_000)
                    ? "bg-blue-600 border-white dark:border-slate-900 shadow-sm"
                    : "bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-700"
                }`}
              />
            </div>
          ))}
        </div>

        {/* Milestone Tick Labels below rail */}
        <div className="relative w-full flex justify-between text-[11px] text-slate-500 dark:text-slate-400 mt-3.5">
          {milestones.map((m, idx) => (
            <div
              key={idx}
              className={`flex flex-col items-center ${
                idx === 0
                  ? "items-start"
                  : idx === milestones.length - 1
                    ? "items-end"
                    : "items-center"
              }`}
            >
              <span className="font-semibold text-slate-700 dark:text-slate-300">
                {m.label}
              </span>
              <span className="text-[10px] text-slate-500 dark:text-slate-400">
                {m.rate}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
