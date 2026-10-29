"use client";

import React, { useState, useMemo, useRef } from "react";
import {
  TaxpayerProfile,
  IncomeInputs as IncomeInputsType,
  DeductionsInputs,
} from "../engine/types";
import { compareRegimes } from "../engine/taxEngine";
import { BasicDetailsCard } from "./BasicDetailsCard";
import { IncomeInputs } from "./IncomeInputs";
import { DeductionsAndHRA } from "./DeductionsAndHRA";
import { TDSInputs } from "./TDSInputs";
import { TaxResultSection } from "./TaxResultSection";
import { FormulaExplanation } from "./FormulaExplanation";
import { RotateCcw, Check, Calculator, Info } from "lucide-react";

const INITIAL_PROFILE: TaxpayerProfile = {
  financialYear: "2025-26",
  ageCategory: "regular",
  residentialStatus: "resident",
  employmentType: "salaried",
  tdsPaid: 0,
};

const INITIAL_INCOME: IncomeInputsType = {
  grossSalary: 1200000,
  basicSalary: 600000,
  hraReceived: 240000,
  rentPaidAnnual: 300000,
  cityType: "metro",
  rentalIncome: 0,
  savingsInterest: 15000,
  fixedDepositInterest: 0,
  otherIncome: 0,
  annualCTC: 1500000,
};

const INITIAL_DEDUCTIONS: DeductionsInputs = {
  section80C: 150000,
  section80D_Self: 25000,
  isSelfSenior: false,
  section80D_Parents: 25000,
  isParentsSenior: false,
  section80CCD1B: 50000,
  section80CCD2: 0,
  section24b: 0,
  section80G: 0,
  section80E: 0,
};

const STEPS = [
  { id: 1, label: "Basic Details" },
  { id: 2, label: "Income Details" },
  { id: 3, label: "Deductions & HRA" },
  { id: 4, label: "TDS / Advance Tax" },
];

export function TaxCalculatorView() {
  const [currentStep, setCurrentStep] = useState(1);
  const [profile, setProfile] = useState<TaxpayerProfile>(INITIAL_PROFILE);
  const [income, setIncome] = useState<IncomeInputsType>(INITIAL_INCOME);
  const [deductions, setDeductions] =
    useState<DeductionsInputs>(INITIAL_DEDUCTIONS);

  const resultsRef = useRef<HTMLDivElement>(null);
  const topRef = useRef<HTMLDivElement>(null);

  // Pure deterministic mathematical calculation engine
  const comparison = useMemo(() => {
    return compareRegimes(profile, income, deductions);
  }, [profile, income, deductions]);

  const handleReset = () => {
    setProfile(INITIAL_PROFILE);
    setIncome(INITIAL_INCOME);
    setDeductions(INITIAL_DEDUCTIONS);
    setCurrentStep(1);
  };

  const scrollToResults = () => {
    resultsRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const scrollToTop = () => {
    topRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div ref={topRef} className="space-y-6 text-left pb-16">
      {/* Title & Reset Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <Calculator size={18} />
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100">
              Income Tax Planning Calculator
            </h1>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Simulate and evaluate statutory tax liability across New (115BAC)
            and Old tax regimes for Indian direct tax compliance.
          </p>
        </div>

        <button
          type="button"
          onClick={handleReset}
          className="inline-flex items-center gap-1.5 min-h-10 px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 transition-all self-start sm:self-auto cursor-pointer shadow-xs hover:border-slate-400"
        >
          <RotateCcw size={13} />
          <span>Reset All Values</span>
        </button>
      </div>

      {/* Safety Notice Banner */}
      <div className="p-3.5 rounded-xl bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900 flex items-start gap-3">
        <Info
          size={16}
          className="text-blue-600 dark:text-blue-400 mt-0.5 shrink-0"
        />
        <p className="text-xs text-blue-900 dark:text-blue-200 leading-relaxed">
          <strong className="font-semibold">Statutory Utility:</strong> All
          calculations are executed client-side based on Finance Act provisions
          for FY 2025–26 (Budget 2025) and FY 2026–27. This tool does not
          automatically post journal entries, record GST, or adjust employee
          payroll ledgers.
        </p>
      </div>

      {/* Step Indicator Header */}
      <div className="py-2">
        <div className="flex items-center justify-between max-w-2xl relative px-2">
          {/* Connecting Track Line */}
          <div className="absolute top-1/2 left-6 right-6 h-0.5 bg-slate-200 dark:bg-slate-800 -translate-y-1/2 -z-10" />
          <div
            className="absolute top-1/2 left-6 h-0.5 bg-blue-600 -translate-y-1/2 -z-10 transition-all duration-300"
            style={{
              width: `${((currentStep - 1) / (STEPS.length - 1)) * 92}%`,
            }}
          />

          {STEPS.map((step) => {
            const isPast = step.id < currentStep;
            const isCurrent = step.id === currentStep;

            return (
              <button
                key={step.id}
                type="button"
                onClick={() => setCurrentStep(step.id)}
                className="flex items-center gap-2 group cursor-pointer focus-visible:outline-none bg-white dark:bg-slate-900 px-2 py-1 rounded-full"
              >
                <div
                  className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all shrink-0 ${
                    isCurrent
                      ? "bg-blue-600 text-white shadow-md ring-2 ring-blue-500/30 scale-105"
                      : isPast
                        ? "bg-blue-100 dark:bg-blue-950/50 text-blue-700 dark:text-blue-400"
                        : "bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-500"
                  }`}
                >
                  {isPast ? <Check size={13} strokeWidth={2.5} /> : step.id}
                </div>
                <span
                  className={`text-xs font-semibold hidden md:inline transition-colors ${
                    isCurrent
                      ? "text-slate-900 dark:text-slate-100 font-bold"
                      : "text-slate-500 group-hover:text-slate-900 dark:group-hover:text-slate-100"
                  }`}
                >
                  {step.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Interactive Form Card (No overflow-hidden to allow dropdown popovers) */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 sm:p-8 shadow-xs relative focus-within:z-30">
        {currentStep === 1 && (
          <BasicDetailsCard
            profile={profile}
            onChange={(upd) => setProfile((prev) => ({ ...prev, ...upd }))}
            onNext={() => setCurrentStep(2)}
          />
        )}

        {currentStep === 2 && (
          <IncomeInputs
            income={income}
            onChange={(upd) => setIncome((prev) => ({ ...prev, ...upd }))}
            onNext={() => setCurrentStep(3)}
            onPrev={() => setCurrentStep(1)}
          />
        )}

        {currentStep === 3 && (
          <DeductionsAndHRA
            deductions={deductions}
            income={income}
            onDeductionsChange={(upd) =>
              setDeductions((prev) => ({ ...prev, ...upd }))
            }
            onIncomeChange={(upd) => setIncome((prev) => ({ ...prev, ...upd }))}
            onNext={() => setCurrentStep(4)}
            onPrev={() => setCurrentStep(2)}
          />
        )}

        {currentStep === 4 && (
          <TDSInputs
            tdsPaid={profile.tdsPaid}
            onChange={(val) =>
              setProfile((prev) => ({ ...prev, tdsPaid: val }))
            }
            onPrev={() => setCurrentStep(3)}
            onFinish={scrollToResults}
          />
        )}
      </div>

      {/* Results Section */}
      <div ref={resultsRef}>
        <TaxResultSection comparison={comparison} onEditDetails={scrollToTop} />
      </div>

      {/* Mathematical Breakdown Section */}
      <FormulaExplanation comparison={comparison} />
    </div>
  );
}
