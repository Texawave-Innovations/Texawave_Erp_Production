"use client";

import React, { useState } from "react";
import { ComparisonResult, TaxRegime } from "../engine/types";
import { formatINR } from "../engine/formatters";
import {
  ChevronDown,
  Wallet,
  Tag,
  FileText,
  Percent,
  ShieldCheck,
  Award,
} from "lucide-react";

interface Props {
  comparison?: ComparisonResult;
}

interface StatutoryStage {
  title: string;
  formula: string;
  explanation: string;
  statutoryReference: string;
}

const STATUTORY_STAGES: StatutoryStage[] = [
  {
    title: "1. Gross Income Base",
    formula:
      "Gross Total Income = Salary + Net House Property + Other Sources (Interest, Dividends)",
    explanation:
      "Consolidates all assessable earnings across statutory heads under Section 14 of the Income-tax Act.",
    statutoryReference: "Section 14 & Section 17(1)",
  },
  {
    title: "2. Statutory Deductions & Exemptions",
    formula:
      "Taxable Base = Gross Total Income − (Standard Deduction + HRA Exemption + Chapter VI-A)",
    explanation:
      "Applies standard deductions (₹75k New Regime, ₹50k Old Regime) and eligible investments (80C, 80D, 24b).",
    statutoryReference: "Section 16(ia) & Chapter VI-A",
  },
  {
    title: "3. Progressive Slab Calculation",
    formula: "Slab Tax = Σ [ (Taxable Income in Slab Tier) × (Slab Rate %) ]",
    explanation:
      "Segments the taxable base into progressive tiers (0%, 5%, 10%, 15%, 20%, 25%, 30%) and sums each tranche.",
    statutoryReference: "Section 115BAC & Finance Act Schedule",
  },
  {
    title: "4. Section 87A Rebate & Marginal Relief",
    formula:
      "Tax after Rebate = Max( 0, Slab Tax − Min(Slab Tax, Statutory Rebate Ceiling) )",
    explanation:
      "Full rebate up to ₹12 Lakh taxable income under New Regime (₹5L under Old Regime), with marginal relief cap.",
    statutoryReference: "Section 87A Proviso",
  },
  {
    title: "5. Health & Education Cess & Final Liability",
    formula:
      "Final Estimated Tax = (Tax after Rebate + Surcharge) + 4% Health & Education Cess",
    explanation:
      "Statutory 4% levy added uniformly to fund healthcare and educational infrastructure in India.",
    statutoryReference: "Finance Act Annual Enactment",
  },
];

export function FormulaExplanation({ comparison }: Props) {
  const [viewRegime, setViewRegime] = useState<TaxRegime>("new");
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  const res = comparison
    ? viewRegime === "new"
      ? comparison.newRegime
      : comparison.oldRegime
    : null;

  const gross = res ? res.grossTotalIncome : 1200000;
  const deductions = res
    ? res.totalEligibleDeductions + res.totalExemptions
    : 175000;
  const taxable = res ? res.taxableIncome : 1025000;
  const slabTax = res ? res.slabTaxBeforeRebate : 25000;
  const cess = res ? res.healthAndEducationCess : 1200;
  const finalTax = res ? res.totalTaxLiability : 31200;

  const toggle = (idx: number) => {
    setExpandedIndex(expandedIndex === idx ? null : idx);
  };

  return (
    <section className="mt-12 pt-8 border-t border-slate-200 dark:border-slate-800 text-left">
      <div className="w-full">
        {/* Section Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">
              MATHEMATICAL TRANSPARENCY
            </span>
            <h3 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100 mt-1">
              Statutory Calculation Workflow
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Step-by-step breakdown of how progressive tax liability is
              computed under Indian tax provisions.
            </p>
          </div>

          {/* Regime Selector Dropdown */}
          <div className="flex items-center gap-2 self-start md:self-auto">
            <span className="text-xs text-slate-500 font-medium">
              View for:
            </span>
            <select
              value={viewRegime}
              onChange={(e) => setViewRegime(e.target.value as TaxRegime)}
              className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-sm cursor-pointer focus:outline-none focus:border-blue-500"
            >
              <option value="new">New Regime (Section 115BAC)</option>
              <option value="old">Old Regime</option>
            </select>
          </div>
        </div>

        {/* Live Mathematical Horizontal Equation Bar */}
        <div className="pb-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 p-4 rounded-2xl bg-slate-50/80 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800">
            {/* Block 1: Gross Income */}
            <div className="p-3 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-xs flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                <Wallet size={16} />
              </div>
              <div>
                <span className="text-[10px] font-semibold text-slate-500 uppercase block">
                  Gross Income
                </span>
                <span className="font-bold text-sm text-slate-900 dark:text-slate-100">
                  {formatINR(gross)}
                </span>
              </div>
            </div>

            {/* Block 2: Deductions */}
            <div className="p-3 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-xs flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                <Tag size={16} />
              </div>
              <div>
                <span className="text-[10px] font-semibold text-slate-500 uppercase block">
                  Deductions
                </span>
                <span className="font-bold text-sm text-slate-900 dark:text-slate-100">
                  -{formatINR(deductions)}
                </span>
              </div>
            </div>

            {/* Block 3: Taxable Income */}
            <div className="p-3 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-xs flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-sky-50 dark:bg-sky-950/40 text-sky-600 dark:text-sky-400 flex items-center justify-center shrink-0">
                <FileText size={16} />
              </div>
              <div>
                <span className="text-[10px] font-semibold text-slate-500 uppercase block">
                  Taxable Base
                </span>
                <span className="font-bold text-sm text-slate-900 dark:text-slate-100">
                  {formatINR(taxable)}
                </span>
              </div>
            </div>

            {/* Block 4: Slab Tax */}
            <div className="p-3 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-xs flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-cyan-50 dark:bg-cyan-950/40 text-cyan-600 dark:text-cyan-400 flex items-center justify-center shrink-0">
                <Percent size={16} />
              </div>
              <div>
                <span className="text-[10px] font-semibold text-slate-500 uppercase block">
                  Slab Tax
                </span>
                <span className="font-bold text-sm text-slate-900 dark:text-slate-100">
                  {formatINR(slabTax)}
                </span>
              </div>
            </div>

            {/* Block 5: Cess (4%) */}
            <div className="p-3 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-xs flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 flex items-center justify-center shrink-0">
                <ShieldCheck size={16} />
              </div>
              <div>
                <span className="text-[10px] font-semibold text-slate-500 uppercase block">
                  Cess (4%)
                </span>
                <span className="font-bold text-sm text-slate-900 dark:text-slate-100">
                  +{formatINR(cess)}
                </span>
              </div>
            </div>

            {/* Block 6: Final Tax Highlight Card */}
            <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-500/60 shadow-xs flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center shrink-0">
                <Award size={16} />
              </div>
              <div>
                <span className="text-[10px] font-bold text-blue-700 dark:text-blue-300 uppercase block">
                  Final Tax
                </span>
                <span className="font-extrabold text-sm text-slate-900 dark:text-white">
                  {formatINR(finalTax)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Expandable Statutory Details Accordion */}
        <div className="mt-6 space-y-2">
          <span className="text-xs uppercase tracking-wider font-semibold text-slate-600 dark:text-slate-400 block mb-2">
            Statutory References & Governing Provisions
          </span>
          {STATUTORY_STAGES.map((stage, idx) => {
            const isExpanded = expandedIndex === idx;
            return (
              <div
                key={idx}
                className="border-b border-slate-200 dark:border-slate-800 pb-2"
              >
                <button
                  type="button"
                  onClick={() => toggle(idx)}
                  className="w-full py-2.5 flex items-center justify-between text-left group cursor-pointer focus-visible:outline-none"
                >
                  <div className="flex items-center gap-3">
                    <span className="w-5 text-xs font-bold text-blue-600 dark:text-blue-400">
                      0{idx + 1}
                    </span>
                    <span className="font-bold text-xs sm:text-sm text-slate-900 dark:text-slate-100 group-hover:text-blue-600 transition-colors">
                      {stage.title}
                    </span>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="text-xs text-slate-500 hidden sm:inline">
                      {stage.statutoryReference}
                    </span>
                    <ChevronDown
                      size={15}
                      className={`text-slate-400 transition-transform duration-200 ${
                        isExpanded ? "rotate-180 text-blue-600" : ""
                      }`}
                    />
                  </div>
                </button>

                {isExpanded && (
                  <div className="pl-8 pr-4 pb-3 pt-1 text-xs text-slate-600 dark:text-slate-400 space-y-2">
                    <div className="p-3 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 text-xs">
                      {stage.formula}
                    </div>
                    <p className="leading-relaxed">{stage.explanation}</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
