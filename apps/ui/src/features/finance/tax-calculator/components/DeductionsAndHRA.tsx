"use client";

import React, { useState } from "react";
import {
  DeductionsInputs,
  IncomeInputs as IncomeInputsType,
} from "../engine/types";
import { formatINR } from "../engine/formatters";
import { CurrencyInput } from "./CurrencyInput";
import { calculateHRAExemption } from "../engine/rules/fy-2025-26/deductions";

interface Props {
  deductions: DeductionsInputs;
  income: IncomeInputsType;
  onDeductionsChange: (updated: Partial<DeductionsInputs>) => void;
  onIncomeChange: (updated: Partial<IncomeInputsType>) => void;
  onNext: () => void;
  onPrev: () => void;
}

export function DeductionsAndHRA({
  deductions,
  income,
  onDeductionsChange,
  onIncomeChange,
  onNext,
  onPrev,
}: Props) {
  const [activeTab, setActiveTab] = useState<"investments" | "hra">(
    "investments",
  );

  const handleDeductionNumber = (
    field: keyof DeductionsInputs,
    value: number,
  ) => {
    onDeductionsChange({ [field]: value });
  };

  const handleIncomeNumber = (field: keyof IncomeInputsType, value: number) => {
    onIncomeChange({ [field]: value });
  };

  const hraCalc = calculateHRAExemption(
    income.basicSalary || 0,
    income.hraReceived || 0,
    income.rentPaidAnnual || 0,
    income.cityType,
  );

  return (
    <div className="space-y-6 text-left relative focus-within:z-30">
      <div>
        <h3 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100">
          Deductions & HRA Exemptions
        </h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          Specify eligible investments under Chapter VI-A and House Rent
          Allowance (applicable to Old Regime).
        </p>
      </div>

      {/* Internal Subtabs: Investments vs HRA */}
      <div className="inline-flex p-1 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700">
        <button
          type="button"
          onClick={() => setActiveTab("investments")}
          className={`min-h-10 py-1.5 px-4 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
            activeTab === "investments"
              ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-sm border border-slate-200 dark:border-slate-700"
              : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100"
          }`}
        >
          Chapter VI-A (80C, 80D, NPS)
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("hra")}
          className={`min-h-10 py-1.5 px-4 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
            activeTab === "hra"
              ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-sm border border-slate-200 dark:border-slate-700"
              : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100"
          }`}
        >
          HRA & Housing (24b)
        </button>
      </div>

      {activeTab === "investments" ? (
        <div className="space-y-5">
          {/* Section 80C */}
          <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 focus-within:border-blue-500 transition-colors">
            <div className="flex justify-between items-baseline mb-1">
              <label className="text-xs uppercase tracking-wider font-semibold text-slate-700 dark:text-slate-300">
                Section 80C (EPF, PPF, ELSS, Life Insurance, Tuition)
              </label>
              <span className="text-[11px] text-slate-500 font-medium">
                Statutory Max: ₹1,50,000
              </span>
            </div>
            <CurrencyInput
              value={deductions.section80C}
              onValueChange={(v) => handleDeductionNumber("section80C", v)}
              placeholder="1,50,000"
              symbolClassName="text-xl font-semibold text-slate-500 mr-2"
              className="text-xl font-bold"
            />
            <span className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 block">
              Allowable deduction:{" "}
              {formatINR(Math.min(deductions.section80C, 150000))}
            </span>
          </div>

          {/* Section 80D (Self & Family) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 focus-within:border-blue-500 transition-colors">
              <label className="text-xs text-slate-700 dark:text-slate-300 font-semibold block mb-1">
                80D Health Insurance (Self & Family)
              </label>
              <CurrencyInput
                value={deductions.section80D_Self}
                onValueChange={(v) =>
                  handleDeductionNumber("section80D_Self", v)
                }
                placeholder="25,000"
                symbolClassName="text-base font-semibold text-slate-500 mr-2"
                className="text-lg font-semibold"
              />
              <label className="flex items-center gap-1.5 mt-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={deductions.isSelfSenior}
                  onChange={(e) =>
                    onDeductionsChange({ isSelfSenior: e.target.checked })
                  }
                  className="rounded text-blue-600 focus:ring-blue-500"
                />
                <span className="text-[11px] text-slate-600 dark:text-slate-400">
                  Self is Senior Citizen (₹50,000 limit)
                </span>
              </label>
            </div>

            <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 focus-within:border-blue-500 transition-colors">
              <label className="text-xs text-slate-700 dark:text-slate-300 font-semibold block mb-1">
                80D Health Insurance (Parents)
              </label>
              <CurrencyInput
                value={deductions.section80D_Parents}
                onValueChange={(v) =>
                  handleDeductionNumber("section80D_Parents", v)
                }
                placeholder="25,000"
                symbolClassName="text-base font-semibold text-slate-500 mr-2"
                className="text-lg font-semibold"
              />
              <label className="flex items-center gap-1.5 mt-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={deductions.isParentsSenior}
                  onChange={(e) =>
                    onDeductionsChange({ isParentsSenior: e.target.checked })
                  }
                  className="rounded text-blue-600 focus:ring-blue-500"
                />
                <span className="text-[11px] text-slate-600 dark:text-slate-400">
                  Parents are Senior Citizens (₹50,000 limit)
                </span>
              </label>
            </div>
          </div>

          {/* Section 80CCD(1B) - NPS */}
          <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 focus-within:border-blue-500 transition-colors">
            <div className="flex justify-between items-baseline mb-1">
              <label className="text-xs uppercase tracking-wider font-semibold text-slate-700 dark:text-slate-300">
                Section 80CCD(1B) (Additional Self NPS Contribution)
              </label>
              <span className="text-[11px] text-slate-500 font-medium">
                Statutory Max: ₹50,000
              </span>
            </div>
            <CurrencyInput
              value={deductions.section80CCD1B}
              onValueChange={(v) => handleDeductionNumber("section80CCD1B", v)}
              placeholder="50,000"
              symbolClassName="text-lg font-semibold text-slate-500 mr-2"
              className="text-lg font-semibold"
            />
            <span className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 block">
              Exclusive deduction over and above the ₹1.5L Section 80C limit.
            </span>
          </div>

          {/* Section 80CCD(2) - Employer NPS Contribution */}
          <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 focus-within:border-blue-500 transition-colors">
            <div className="flex justify-between items-baseline mb-1">
              <label className="text-xs uppercase tracking-wider font-semibold text-slate-700 dark:text-slate-300">
                Section 80CCD(2) (Employer NPS Contribution — Allowed in Both
                Regimes)
              </label>
              <span className="text-[11px] text-slate-500 font-medium">
                Max 14% of Basic
              </span>
            </div>
            <CurrencyInput
              value={deductions.section80CCD2}
              onValueChange={(v) => handleDeductionNumber("section80CCD2", v)}
              placeholder="0"
              symbolClassName="text-lg font-semibold text-slate-500 mr-2"
              className="text-lg font-semibold"
            />
            <span className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 block">
              Deduction permitted in both Old and New regimes up to 14% of Basic
              Salary.
            </span>
          </div>
        </div>
      ) : (
        <div className="space-y-5">
          {/* HRA Received & Rent Paid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 focus-within:border-blue-500 transition-colors">
              <label className="text-xs text-slate-700 dark:text-slate-300 font-semibold block mb-1">
                Annual HRA Received from Employer
              </label>
              <CurrencyInput
                value={income.hraReceived}
                onValueChange={(v) => handleIncomeNumber("hraReceived", v)}
                placeholder="2,40,000"
                symbolClassName="text-lg font-semibold text-slate-500 mr-2"
                className="text-lg font-semibold"
              />
            </div>

            <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 focus-within:border-blue-500 transition-colors">
              <label className="text-xs text-slate-700 dark:text-slate-300 font-semibold block mb-1">
                Annual Rent Actually Paid by Employee
              </label>
              <CurrencyInput
                value={income.rentPaidAnnual}
                onValueChange={(v) => handleIncomeNumber("rentPaidAnnual", v)}
                placeholder="3,00,000"
                symbolClassName="text-lg font-semibold text-slate-500 mr-2"
                className="text-lg font-semibold"
              />
            </div>
          </div>

          {/* City Type */}
          <div>
            <label className="block text-xs uppercase tracking-wider font-semibold text-slate-600 dark:text-slate-400 mb-2">
              Rental City Classification
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => onIncomeChange({ cityType: "metro" })}
                className={`min-h-11 py-2 px-3 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                  income.cityType === "metro"
                    ? "bg-blue-50 dark:bg-blue-950/40 border border-blue-500 text-blue-700 dark:text-blue-300 font-bold"
                    : "border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900"
                }`}
              >
                Metro City (50% of Basic — Delhi/Mum/Kolk/Chen)
              </button>
              <button
                type="button"
                onClick={() => onIncomeChange({ cityType: "non_metro" })}
                className={`min-h-11 py-2 px-3 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                  income.cityType === "non_metro"
                    ? "bg-blue-50 dark:bg-blue-950/40 border border-blue-500 text-blue-700 dark:text-blue-300 font-bold"
                    : "border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900"
                }`}
              >
                Non-Metro City (40% of Basic)
              </button>
            </div>
            {income.hraReceived > 0 && income.rentPaidAnnual > 0 && (
              <span className="text-xs text-emerald-700 dark:text-emerald-400 font-semibold mt-2.5 block">
                ✓ Calculated Rule 2A HRA Exemption:{" "}
                {formatINR(hraCalc.exemptAmount)}
              </span>
            )}
          </div>

          {/* Section 24(b) - Home Loan Interest */}
          <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 focus-within:border-blue-500 transition-colors">
            <div className="flex justify-between items-baseline mb-1">
              <label className="text-xs uppercase tracking-wider font-semibold text-slate-700 dark:text-slate-300">
                Section 24(b) (Home Loan Interest on Self-Occupied Property)
              </label>
              <span className="text-[11px] text-slate-500 font-medium">
                Max Loss: ₹2,00,000
              </span>
            </div>
            <CurrencyInput
              value={deductions.section24b}
              onValueChange={(v) => handleDeductionNumber("section24b", v)}
              placeholder="0"
              symbolClassName="text-lg font-semibold text-slate-500 mr-2"
              className="text-lg font-semibold"
            />
            <span className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 block">
              Permitted set-off against salary income under Old Regime (capped
              at ₹2,00,000 loss).
            </span>
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
          <span>Proceed to TDS / Advance Tax</span>
          <span>→</span>
        </button>
      </div>
    </div>
  );
}
