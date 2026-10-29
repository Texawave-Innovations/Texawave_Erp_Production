"use client";

import React from "react";
import { CurrencyInput } from "./CurrencyInput";

interface Props {
  tdsPaid: number;
  onChange: (val: number) => void;
  onPrev: () => void;
  onFinish: () => void;
}

export function TDSInputs({ tdsPaid, onChange, onPrev, onFinish }: Props) {
  return (
    <div className="space-y-6 text-left relative focus-within:z-30">
      <div>
        <h3 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100">
          TDS & Advance Taxes Paid
        </h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          Optional: Enter tax already deducted at source by your employer or
          deposited as advance tax.
        </p>
      </div>

      <div className="space-y-6">
        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/60 focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500 transition-colors">
          <label className="block text-xs uppercase tracking-wider font-semibold text-slate-700 dark:text-slate-300 mb-1">
            Total TDS Deducted / Advance Tax Paid
          </label>
          <CurrencyInput
            value={tdsPaid}
            onValueChange={onChange}
            placeholder="0"
            symbolClassName="text-2xl font-bold text-slate-500 mr-2"
            className="text-2xl sm:text-3xl font-bold"
          />
          <span className="text-[11px] text-slate-500 dark:text-slate-400 mt-1.5 block">
            Corresponds to total credits reflected in your Form 26AS or annual
            AIS statement.
          </span>
        </div>

        {/* Navigation Buttons */}
        <div className="flex items-center justify-between pt-4">
          <button
            type="button"
            onClick={onPrev}
            className="min-h-11 px-5 py-2.5 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 border border-slate-200 dark:border-slate-800 hover:border-slate-400 transition-all cursor-pointer"
          >
            ← Back
          </button>
          <button
            type="button"
            onClick={onFinish}
            className="min-h-11 px-6 py-2.5 rounded-xl text-xs font-bold bg-blue-600 text-white hover:bg-blue-700 active:scale-95 transition-all shadow-sm cursor-pointer inline-flex items-center gap-2"
          >
            <span>View Comparative Tax Result</span>
            <span>↓</span>
          </button>
        </div>
      </div>
    </div>
  );
}
