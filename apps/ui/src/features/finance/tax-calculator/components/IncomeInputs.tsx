"use client";

import React, { useState } from "react";
import { IncomeInputs as IncomeInputsType } from "../engine/types";
import { CurrencyInput } from "./CurrencyInput";
import { Plus } from "lucide-react";

interface Props {
  income: IncomeInputsType;
  onChange: (updated: Partial<IncomeInputsType>) => void;
  onNext: () => void;
  onPrev: () => void;
}

export function IncomeInputs({ income, onChange, onNext, onPrev }: Props) {
  const [showOtherSources, setShowOtherSources] = useState(
    Boolean(
      income.rentalIncome ||
      income.savingsInterest ||
      income.fixedDepositInterest ||
      income.otherIncome,
    ),
  );

  const handleNumberChange = (field: keyof IncomeInputsType, value: number) => {
    onChange({ [field]: value });
  };

  return (
    <div className="space-y-6 text-left relative focus-within:z-30">
      <div>
        <h3 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100">
          Income Details
        </h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          Specify gross annual salary and additional income streams for normal
          slab calculation.
        </p>
      </div>

      <div className="space-y-6">
        {/* Primary Gross Salary Input */}
        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/60 focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500 transition-colors">
          <label className="block text-xs uppercase tracking-wider font-semibold text-slate-700 dark:text-slate-300 mb-1">
            Annual Gross Salary (Form 16 Part B) *
          </label>
          <CurrencyInput
            value={income.grossSalary}
            onValueChange={(v) => handleNumberChange("grossSalary", v)}
            placeholder="12,00,000"
            symbolClassName="text-2xl font-bold text-slate-500 mr-2"
            className="text-2xl sm:text-3xl font-bold"
          />
          <span className="text-[11px] text-slate-500 dark:text-slate-400 mt-1.5 block">
            Annual salary earned before statutory standard deduction and
            exemptions.
          </span>
        </div>

        {/* Basic Salary (for HRA) */}
        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 focus-within:border-blue-500 transition-colors">
          <label className="block text-xs uppercase tracking-wider font-semibold text-slate-700 dark:text-slate-300 mb-1">
            Annual Basic Salary (for HRA calculation)
          </label>
          <CurrencyInput
            value={income.basicSalary}
            onValueChange={(v) => handleNumberChange("basicSalary", v)}
            placeholder="6,00,000"
            symbolClassName="text-lg font-semibold text-slate-500 mr-2"
            className="text-xl font-semibold"
          />
          <span className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 block">
            Typically 40%–50% of CTC. Used to compute House Rent Allowance
            exemption u/s 10(13A).
          </span>
        </div>

        {/* Other Income Sources Toggle */}
        {!showOtherSources ? (
          <button
            type="button"
            onClick={() => setShowOtherSources(true)}
            className="inline-flex items-center gap-1.5 min-h-11 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
          >
            <Plus size={15} />
            <span>+ Add Interest, House Property, or Other Incomes</span>
          </button>
        ) : (
          <div className="space-y-4 pt-2 border-t border-slate-200 dark:border-slate-800">
            <span className="text-xs uppercase tracking-wider font-semibold text-slate-600 dark:text-slate-400 block">
              Additional Normal Incomes
            </span>

            {/* Savings Interest */}
            <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 focus-within:border-blue-500 transition-colors">
              <label className="block text-xs text-slate-600 dark:text-slate-400 mb-1">
                Savings Bank Account Interest
              </label>
              <CurrencyInput
                value={income.savingsInterest}
                onValueChange={(v) => handleNumberChange("savingsInterest", v)}
                placeholder="0"
                symbolClassName="text-base font-semibold text-slate-500 mr-2"
                className="text-lg font-medium"
              />
              <span className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 block">
                Eligible for deduction u/s 80TTA (up to ₹10,000) or 80TTB
                (seniors up to ₹50,000).
              </span>
            </div>

            {/* Fixed Deposit Interest */}
            <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 focus-within:border-blue-500 transition-colors">
              <label className="block text-xs text-slate-600 dark:text-slate-400 mb-1">
                Fixed Deposit (FD) / Term Deposit Interest
              </label>
              <CurrencyInput
                value={income.fixedDepositInterest}
                onValueChange={(v) =>
                  handleNumberChange("fixedDepositInterest", v)
                }
                placeholder="0"
                symbolClassName="text-base font-semibold text-slate-500 mr-2"
                className="text-lg font-medium"
              />
            </div>

            {/* Other Incomes */}
            <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 focus-within:border-blue-500 transition-colors">
              <label className="block text-xs text-slate-600 dark:text-slate-400 mb-1">
                Other Taxable Income (Dividends, Consulting)
              </label>
              <CurrencyInput
                value={income.otherIncome}
                onValueChange={(v) => handleNumberChange("otherIncome", v)}
                placeholder="0"
                symbolClassName="text-base font-semibold text-slate-500 mr-2"
                className="text-lg font-medium"
              />
            </div>
          </div>
        )}

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
            onClick={onNext}
            className="min-h-11 px-6 py-2.5 rounded-xl text-xs font-bold bg-blue-600 text-white hover:bg-blue-700 active:scale-95 transition-all shadow-sm cursor-pointer inline-flex items-center gap-2"
          >
            <span>Proceed to Deductions & HRA</span>
            <span>→</span>
          </button>
        </div>
      </div>
    </div>
  );
}
